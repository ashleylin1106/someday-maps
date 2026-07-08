// Local backend for the bucket list app.
//   /extract-text : (primary, FREE) Google Gemini reads pasted text, resolves
//                    @handles to real places via web search, splits notes/address,
//                    infers country/city. Needs GEMINI_API_KEY.
//   /extract      : (optional, paid) Claude reads a screenshot. Needs ANTHROPIC_API_KEY.

import "dotenv/config";
import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI, createPartFromBase64, createUserContent } from "@google/genai";
import sharp from "sharp";

const PORT = process.env.PORT || 8787;
// Free-tier friendly default. Change with GEMINI_MODEL if this one isn't available to you.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
// Only used by the optional screenshot route.
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";

if (!process.env.GEMINI_API_KEY) {
  console.error(
    "\n⚠️  GEMINI_API_KEY is not set. Create server/.env with:\n" +
      "   GEMINI_API_KEY=...   (free key from https://aistudio.google.com/apikey)\n"
  );
}

// Lazy clients so the server still boots (and /health works) before keys are set.
let _gemini = null;
function getGemini() {
  if (!process.env.GEMINI_API_KEY) {
    const err = new Error(
      "GEMINI_API_KEY is not set. Put your free Google AI Studio key in server/.env and restart the server."
    );
    err.status = 500;
    throw err;
  }
  if (!_gemini) _gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return _gemini;
}

let _anthropic = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error(
      "ANTHROPIC_API_KEY is not set. Put your Claude key in server/.env and restart the server."
    );
    err.status = 500;
    throw err;
  }
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}

const app = express();
app.use(cors());
// Screenshots are large once base64-encoded — allow big JSON bodies
app.use(express.json({ limit: "60mb" }));

// JSON schema that constrains Claude's output to a clean list of places
const PLACE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    places: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", description: "Place name, most searchable form" },
          country: { type: "string", description: "Country, or empty if unknown" },
          city: { type: "string", description: "City, or empty if unknown" },
          type: { type: "string", enum: ["attraction", "restaurant", "shop"] },
          note: {
            type: "string",
            description: "Short English note: why it's notable / what to get. Translate if needed.",
          },
          originalText: {
            type: "string",
            description: "Short snippet of the original caption relevant to this place (any language)",
          },
        },
        required: ["name", "country", "city", "type", "note", "originalText"],
      },
    },
  },
  required: ["places"],
};

const PROMPT = `You are looking at a screenshot the user saved from social media (often Instagram), a blog, or a maps app. The text may be in ANY language.

Find every distinct real-world place the user might want to save and visit later — restaurants, cafés, bars, shops, bakeries, hotels, attractions, viewpoints, etc.

For each place, provide:
- name: the place's name in its most searchable form (keep the original name; you may add a romanization in parentheses if the original is non-Latin).
- country and city: infer from visible context (location tags, landmarks, language, currency). Leave empty if you truly cannot tell.
- type: one of attraction, restaurant, shop (use "restaurant" for any food/drink spot, "shop" for stores/boutiques/markets, "attraction" for everything else like sights, parks, viewpoints, hotels).
- note: a SHORT English summary of why it's worth visiting or what to order/see. Translate the key point if the caption is in another language.
- originalText: a short snippet of the original caption text that refers to this place (keep it in the original language).

Ignore usernames, hashtags, follower counts, app UI text, and anything that isn't an actual place. If there are no real places in the image, return an empty list.`;

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    geminiModel: GEMINI_MODEL,
    geminiKey: !!process.env.GEMINI_API_KEY,
  });
});

// Debug: list the Gemini models your key can use (helps if the default 404s).
app.get("/models", async (_req, res) => {
  try {
    const pager = await getGemini().models.list();
    const names = [];
    for await (const m of pager) {
      if (m?.name) names.push(m.name);
      if (names.length >= 80) break;
    }
    res.json({ models: names });
  } catch (err) {
    res.status(err?.status || 500).json({ error: err?.message || "Could not list models" });
  }
});

// --- PRIMARY: text extraction with Gemini + Google Search grounding -----------

const TEXT_PROMPT = `You extract real-world places from a pasted social-media caption, blog snippet, list, a URL, and/or SCREENSHOTS. The text may be in ANY language and often uses line breaks, emojis, hashtags, and @mentions.

If the input contains a URL (e.g. a blog post or itinerary article), READ that page and extract the places from its full content — the user pasted the link because the article is too long to copy.
If screenshots are attached (often of Instagram posts/reels), READ the text visible in the images — captions, location tags, on-screen labels — and extract places from them the same way. Ignore app UI (like/comment counts, usernames of the poster).

Your job:
0. Detect if this is a shared ITINERARY / ROUTE (a numbered day-by-day trip, a hiking route, a road-trip itinerary, a "things to do in order" list where the stops connect into one journey). If so, set every place's "trip" to a short name for that route (infer one, e.g. "Tour du Mont Blanc" or "Dolomites road trip") and "order" to its position in the sequence (1,2,3…). If it's just scattered/unrelated places, leave trip "" and order 0.
1. Find every distinct real place worth saving to visit (restaurant, café, bar, bakery, shop, market, attraction, viewpoint, village, mountain, trailhead, refuge, hotel, etc.).
2. When a place is referenced by an Instagram @handle (e.g. "coffee at @bonanzacoffee"), USE GOOGLE SEARCH to find the real business name and where it is. The place NAME must be the real business name (e.g. "Bonanza Coffee"), NOT the descriptive phrase ("coffee at") and NOT the raw @handle.
3. Separate the pieces correctly:
   - name: the real place name only.
   - note: recommended dishes / what to order / why it's good / any description. Combine all descriptive bits for that place here — PRESERVE the poster's own recommendations and comments (the user wants to see what the original post said about this place). Keep it readable; translate the key point to English if helpful but you may keep original dish names.
   - address: a street address if present or findable.
   - country and city: infer from the caption context and/or your search. Use the FULL country name ("United Kingdom" not "UK", "United States" not "USA"). Fill these in whenever you reasonably can — do NOT leave them empty just because the exact line didn't say it.
   - category: the SPECIFIC category this place has on Google Maps, as a short human label. Examples: "Coffee shop", "Bookstore", "Park", "Ramen restaurant", "Sushi restaurant", "Art museum", "Cocktail bar", "Bakery", "Boutique". Be specific — for restaurants include the cuisine when you can.
   - type: the broad bucket for filtering — one of "cafe", "restaurant", "shop", "activity", "attraction" — consistent with the category above. "activity" = things you DO (hiking trails, treks, tours, spas/onsen, surf/dive/ski, classes, experiences); "attraction" = places you SEE (sights, museums, parks, landmarks, viewpoints, hotels). Coffee shop → cafe, Bookstore → shop, Hiking area → activity, Museum → attraction.
   - lat and lng: the place's approximate latitude and longitude as numbers, from your search. Use null if you can't find them.
   - rating and ratingCount: the place's Google Maps star rating (a number like 4.6) and its approximate review count (a number like 2100), from your search. Use null for both if you can't find them.
4. Descriptive lines like "必點：海鮮 mama 麵" belong in the NOTE of the place they describe — they are NOT separate places.
5. Ignore pure hashtags, follower counts, usernames of the poster, generic hype ("PERFECT!"), and anything that isn't an actual place.
6. Do NOT extract countries, regions, states, provinces, or border crossings as places. "France", "crossed into Switzerland", "the Alps" are NOT places — only save specific named venues, landmarks, villages, refuges, trailheads, viewpoints, etc.

Return ONLY a JSON object, no markdown, no commentary, in exactly this shape:
{"places":[{"name":"","country":"","city":"","category":"","type":"cafe|restaurant|shop|activity|attraction","trip":"","order":0,"note":"","address":"","lat":null,"lng":null,"rating":null,"ratingCount":null}]}
If there are no real places, return {"places":[]}.`;

// Derive the broad type from the specific Google category, so filtering is
// consistent even if the model's own "type" is off. Order matters (cafe before shop).
function typeFromCategory(category, fallback) {
  const c = (category || '').toLowerCase();
  if (!c) return fallback;
  if (/coffee|caf[eé]|espresso|tea house|tea room|bakery|patisserie|dessert|ice cream|gelato|juice|boba|bubble tea/.test(c))
    return 'cafe';
  if (/book|store|shop|market|boutique|\bmall\b|grocery|supermarket|deli\b|pharmacy|florist/.test(c))
    return 'shop';
  if (/hik|trail|trek|\btour\b|tours\b|spa\b|massage|onsen|hot spring|bath|class|workshop|experience|kayak|surf|dive|snorkel|\bski\b|climb|rafting|paraglid|safari|cruise|zipline|cycling|bike rental/.test(c))
    return 'activity';
  if (/museum|park|monument|memorial|gallery|garden|viewpoint|landmark|tourist|hotel|historic|church|temple|shrine|palace|castle|square|zoo|aquarium|beach|theater|theatre|cathedral|library|bridge/.test(c))
    return 'attraction';
  if (/restaurant|\bbar\b|pub|bistro|eatery|diner|steakhouse|ramen|sushi|pizz|grill|noodle|bbq|barbecue|izakaya|brasserie|tavern|kitchen|food/.test(c))
    return 'restaurant';
  return fallback;
}

// Best-effort: fetch a social/blog URL server-side and pull the page's meta
// text (og:title / og:description often contain the caption for public pages).
// Instagram frequently blocks anonymous fetches of post pages — then this
// returns null and we rely on Gemini's web search instead.
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

function decodeEntities(s) {
  return (s || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

// Instagram via Apify (paid-tier scraper with a monthly free credit).
// Given a post/reel URL, returns { text, image } — the real caption and a
// thumbnail. Needs APIFY_TOKEN in server/.env; without it we skip straight
// to the meta/search fallbacks.
const APIFY_TOKEN = process.env.APIFY_TOKEN || "";

// Cache scrape results per URL for a while — re-importing the same post
// (or a friend importing it too) is then instant and costs nothing.
const apifyCache = new Map(); // url -> { result, ts }
const APIFY_CACHE_MS = 6 * 60 * 60 * 1000;

// IG image URLs expire after a few weeks. To keep the preview forever, we
// download the image NOW, shrink it, and return it as an embedded data URI —
// it then lives on the phone and never depends on Instagram again.
async function toDataUri(imageUrl) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(imageUrl, {
      headers: { "User-Agent": BROWSER_UA },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const small = await sharp(buf).resize({ width: 480 }).jpeg({ quality: 60 }).toBuffer();
    return `data:image/jpeg;base64,${small.toString("base64")}`;
  } catch {
    return null;
  }
}

async function fetchInstagramViaApify(url) {
  if (!APIFY_TOKEN) return null;
  const hit = apifyCache.get(url);
  if (hit && Date.now() - hit.ts < APIFY_CACHE_MS) return hit.result;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 35000); // fail fast — don't leave the user waiting
    const r = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directUrls: [url],
          resultsType: "posts",
          resultsLimit: 1,
          addParentData: false,
        }),
        signal: ctrl.signal,
      }
    );
    clearTimeout(t);
    if (!r.ok) {
      console.error("apify error:", r.status, (await r.text()).slice(0, 200));
      return null;
    }
    const items = await r.json();
    const it = Array.isArray(items) && items.length > 0 ? items[0] : null;
    if (!it) return null;
    const caption = it.caption || "";
    const imageUrl =
      it.displayUrl || (Array.isArray(it.images) && it.images[0]) || it.thumbnailUrl || "";
    const loc = it.locationName ? `Location tag: ${it.locationName}` : "";
    const text = [caption, loc].filter(Boolean).join("\n");
    // Convert to a permanent embedded image (IG URLs expire); fall back to the raw URL.
    const image = imageUrl ? (await toDataUri(imageUrl)) || imageUrl : null;
    // Reels: keep the video URL — Gemini can watch/listen to it when the
    // caption alone doesn't name the places (the "Yaay can read reels" trick).
    const result = { text: text || null, image, videoUrl: it.videoUrl || null };
    apifyCache.set(url, { result, ts: Date.now() });
    if (apifyCache.size > 200) apifyCache.delete(apifyCache.keys().next().value);
    return result;
  } catch (e) {
    console.error("apify fetch failed:", e?.message || e);
    return null;
  }
}

// Download a reel's video so Gemini can watch/listen to it. Inline uploads
// are capped around 20MB — larger reels are skipped (caption/search still run).
async function fetchVideoBase64(url, maxBytes = 19 * 1024 * 1024) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    const r = await fetch(url, { headers: { "User-Agent": BROWSER_UA }, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > maxBytes) return null;
    return buf.toString("base64");
  } catch {
    return null;
  }
}

async function fetchPageMeta(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, "Accept-Language": "en" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const html = await r.text();
    const grab = (re) => {
      const m = html.match(re);
      return m ? decodeEntities(m[1]).trim() : null;
    };
    const title =
      grab(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i) ||
      grab(/<title[^>]*>([^<]*)<\/title>/i);
    const desc =
      grab(/<meta[^>]+property="og:description"[^>]+content="([^"]*)"/i) ||
      grab(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i);
    // og:image gives us a free preview thumbnail (works on Xiaohongshu, blogs…)
    const image =
      grab(/<meta[^>]+property="og:image"[^>]+content="([^"]*)"/i) ||
      grab(/<meta[^>]+name="og:image"[^>]+content="([^"]*)"/i);
    const text = [title, desc].filter(Boolean).join("\n");
    if (text.length <= 20 && !image) return null; // useless stub
    return { text: text.length > 20 ? text : null, image: image || null };
  } catch {
    return null;
  }
}

function parseJsonLoose(raw) {
  let s = (raw || "").trim();
  // strip ```json ... ``` fences
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  // fall back to the first {...} block
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

app.post("/extract-text", async (req, res) => {
  try {
    const { text, images } = req.body || {};
    const imgs = Array.isArray(images)
      ? images
          .filter((im) => im && typeof im.data === "string" && im.data.length > 0)
          .slice(0, 6)
      : [];
    const hasText = typeof text === "string" && text.trim().length > 0;
    if (!hasText && imgs.length === 0) {
      return res.status(400).json({ error: "Missing 'text' or 'images'" });
    }

    // For social links (IG / TikTok / Xiaohongshu): 1) Apify scraper (IG only —
    // real caption + thumbnail), 2) the page's og meta tags (text + og:image,
    // free), 3) tell Gemini to Google it.
    let metaExtra = "";
    let sourceImage = "";
    let readOk = false; // did we actually get the post's caption?
    let videoB64 = null; // reel video for Gemini to watch/listen to
    if (hasText) {
      const socialUrls = (
        text.match(
          /https?:\/\/(?:www\.)?(?:instagram\.com|tiktok\.com|xiaohongshu\.com|xhslink\.com)\/\S+/gi
        ) || []
      ).slice(0, 2);
      // If the user already pasted the caption, the content is right there —
      // skip the slow scrape (it would only add the thumbnail).
      const pastedContent = text
        .replace(/https?:\/\/\S+/g, "")
        .replace(/Read this link and extract the places it's about:/g, "")
        .trim();
      const havePastedCaption = pastedContent.length > 60;
      for (const u of socialUrls) {
        const viaApify =
          u.includes("instagram.com") && !havePastedCaption
            ? await fetchInstagramViaApify(u)
            : null;
        if (viaApify?.text || viaApify?.videoUrl) {
          if (viaApify.text) {
            metaExtra += `\n\nActual caption of ${u}:\n"""${viaApify.text}"""`;
            readOk = true;
          }
          if (viaApify.image && !sourceImage) sourceImage = viaApify.image;
          // Short caption + it's a reel → the places are probably said IN the
          // video. Attach it so Gemini can watch/listen (like Yaay does).
          if (viaApify.videoUrl && (!viaApify.text || viaApify.text.length < 400) && !videoB64) {
            videoB64 = await fetchVideoBase64(viaApify.videoUrl);
            if (videoB64) {
              metaExtra +=
                "\n\n(The reel's VIDEO is attached. Watch and listen to it — extract every place it names in speech, on-screen text, or captions.)";
              readOk = true;
            }
          }
          continue;
        }
        const meta = await fetchPageMeta(u);
        if (meta?.text) {
          metaExtra += `\n\nContent found at ${u}:\n"""${meta.text}"""`;
          readOk = true;
        }
        if (meta?.image && !sourceImage) {
          const embedded = await toDataUri(meta.image);
          if (embedded) sourceImage = embedded;
        }
      }
      if (socialUrls.length > 0 && !metaExtra) {
        metaExtra =
          "\n\n(The social link above could not be fetched directly — use Google Search to find what places that post is about.)";
      }
    }

    const promptText = hasText
      ? `${TEXT_PROMPT}\n\nTEXT:\n"""${text}"""${metaExtra}`
      : `${TEXT_PROMPT}\n\nExtract the places from the attached screenshot(s).`;
    const parts = [
      ...imgs.map((im) => createPartFromBase64(im.data, im.mimeType || "image/jpeg")),
      ...(videoB64 ? [createPartFromBase64(videoB64, "video/mp4")] : []),
      { text: promptText },
    ];

    const gemini = getGemini();
    const doCall = () =>
      gemini.models.generateContent({
        model: GEMINI_MODEL,
        contents: createUserContent(parts),
        config: {
          // web search grounding + read any pasted URL (blogs / itineraries)
          tools: [{ googleSearch: {} }, { urlContext: {} }],
          temperature: 0.2,
          // Extraction doesn't need slow deliberation — turning "thinking" off
          // shaves a good chunk of latency on 2.5-flash.
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

    // The free tier occasionally returns 503/429 (overloaded/rate-limited).
    // Retry a few times with backoff before giving up.
    let response;
    for (let attempt = 0; ; attempt++) {
      try {
        response = await doCall();
        break;
      } catch (e) {
        const msg = String(e?.message || e);
        const transient = /503|429|UNAVAILABLE|overloaded|high demand|RESOURCE_EXHAUSTED/i.test(msg);
        if (!transient || attempt >= 3) throw e;
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }

    const raw = response.text || "";
    let parsed;
    try {
      parsed = parseJsonLoose(raw);
    } catch (e) {
      console.error("gemini bad JSON:", raw.slice(0, 300));
      return res.status(502).json({ error: "Model did not return valid JSON" });
    }

    const places = (Array.isArray(parsed.places) ? parsed.places : [])
      .filter((p) => p && typeof p.name === "string" && p.name.trim())
      .map((p) => {
        const category = String(p.category || "").trim();
        const geminiType = ["attraction", "activity", "restaurant", "cafe", "shop"].includes(p.type)
          ? p.type
          : "attraction";
        return {
          name: String(p.name).trim(),
          country: String(p.country || "").trim(),
          city: String(p.city || "").trim(),
          category,
          type: typeFromCategory(category, geminiType),
          trip: String(p.trip || "").trim(),
          order: Number.isFinite(p.order) ? Number(p.order) : 0,
          note: String(p.note || "").trim(),
          address: String(p.address || "").trim(),
          lat: typeof p.lat === "number" ? p.lat : null,
          lng: typeof p.lng === "number" ? p.lng : null,
          rating: typeof p.rating === "number" ? p.rating : null,
          ratingCount: typeof p.ratingCount === "number" ? Math.round(p.ratingCount) : null,
        };
      });

    res.json({ places, sourceImage, readOk });
  } catch (err) {
    const raw = String(err?.message || err);
    console.error("extract-text error:", raw);
    let message = "Extraction failed";
    if (/503|UNAVAILABLE|overloaded|high demand/i.test(raw)) {
      message = "Google's AI is busy right now — try again in a moment.";
    } else if (/429|RESOURCE_EXHAUSTED|quota/i.test(raw)) {
      message = "Hit today's free Gemini limit. Try again later (it resets daily).";
    } else if (/API key|API_KEY|invalid|permission/i.test(raw)) {
      message = "Gemini API key problem — check GEMINI_API_KEY in server/.env.";
    }
    res.status(err?.status || 500).json({ error: message });
  }
});

// --- OPTIONAL: screenshot extraction with Claude (paid) -----------------------

app.post("/extract", async (req, res) => {
  try {
    const { image, mediaType } = req.body || {};
    if (!image || typeof image !== "string") {
      return res.status(400).json({ error: "Missing 'image' (base64 string)" });
    }

    const media_type = mediaType || "image/jpeg";

    const response = await getClient().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      output_config: { format: { type: "json_schema", schema: PLACE_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type, data: image } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return res.status(422).json({ error: "The model declined to process this image." });
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) {
      return res.status(502).json({ error: "No text in model response" });
    }

    let parsed;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch (e) {
      return res.status(502).json({ error: "Model did not return valid JSON" });
    }

    const places = Array.isArray(parsed.places) ? parsed.places : [];
    res.json({ places });
  } catch (err) {
    console.error("extract error:", err?.message || err);
    const status = err?.status || 500;
    res.status(status).json({ error: err?.message || "Extraction failed" });
  }
});

app.listen(PORT, () => {
  console.log(`\n✅ Bucket List backend running`);
  console.log(`   Text (Gemini): ${GEMINI_MODEL}  key=${process.env.GEMINI_API_KEY ? "set" : "MISSING"}`);
  console.log(`   Listening on http://0.0.0.0:${PORT}`);
  console.log(`   (your phone reaches it at http://<your-mac-ip>:${PORT})\n`);

  // Keep-warm: Render's free tier sleeps after ~15 min idle, which adds a ~50s
  // cold start to the next request. Ping our own public URL every 10 min so the
  // service stays awake and imports feel fast. RENDER_EXTERNAL_URL is set by
  // Render automatically; harmless (no-op) when running locally.
  const selfUrl = process.env.RENDER_EXTERNAL_URL;
  if (selfUrl) {
    setInterval(() => {
      fetch(`${selfUrl}/health`).catch(() => {});
    }, 10 * 60 * 1000);
    console.log(`   Keep-warm ping enabled → ${selfUrl}/health every 10 min`);
  }
});
