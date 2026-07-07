// Turn a pasted blob of text into structured places — no AI, just heuristics.
//
// Two modes, chosen automatically:
//   • Block mode  (text has blank lines between chunks): each chunk = one place.
//     First line = name, address-looking lines = address, the rest = notes.
//   • Line mode   (no blank lines): each non-empty line = one place name.
//
// Country/city are detected from the surrounding text via geo.ts.

import { PlaceType } from './types';
import { detectLocation } from './geo';

export interface ParsedPlace {
  name: string;
  city: string;
  country: string;
  type: PlaceType;
  category: string;
  trip: string;
  order: number;
  note: string;
  address: string;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  ratingCount: number | null;
}

function cleanLine(s: string): string {
  let l = (s || '').trim();
  l = l.replace(/^[\s\-*•·・▪◦►▶>]+/, ''); // bullets
  l = l.replace(/^\d+[.)\]、:：]\s*/, ''); // "1." / "2)" numbering
  l = l.replace(/[#＃]\S+/g, ''); // hashtags
  l = l.replace(/[@＠]\S+/g, ''); // @mentions
  l = l.replace(/\s+/g, ' ').trim();
  return l;
}

// Does this line look like a street address rather than a place name?
function isAddress(s: string): boolean {
  const hasDigit = /\d/.test(s);
  const hasStreetWord =
    /(丁目|番地|号|號|区|區|路|街|巷|弄|大道|樓|楼|F\b|floor|blvd|street|\bst\.?\b|\bave\.?\b|avenue|\broad\b|\brd\.?\b|\bdr\.?\b|번지|로\b|길\b|시\b|구\b)/i.test(
      s
    );
  const postal = /〒?\s*\d{3}-?\d{4}/.test(s) || /\b\d{5}(-\d{4})?\b/.test(s);
  const streetNumberStart = /^\s*\d{1,5}\s+[A-Za-zÀ-￿]/.test(s);
  const asianBlockNumber = /\d+[-–]\d+([-–]\d+)?/.test(s); // e.g. 1-16-11
  return (hasDigit && hasStreetWord) || postal || streetNumberStart || asianBlockNumber;
}

const CAFE_WORDS =
  /(咖啡|咖啡廳|咖啡店|café|cafe|coffee|espresso|latte|甜點|甜点|dessert|茶屋|茶店|brunch|烘焙|bakery|patisserie|froyo|gelato|冰淇淋)/i;
const RESTAURANT_WORDS =
  /(餐廳|餐厅|拉麵|拉面|restaurant|bar\b|居酒屋|食堂|燒肉|烧肉|壽司|寿司|ramen|bistro|noodle|dining|kitchen|pizz|酒吧|燒鳥|串燒|火鍋|火锅|小吃|eatery|diner|steakhouse|燒烤|烤肉)/i;
const SHOP_WORDS =
  /(\bshop\b|\bstore\b|市場|市场|market|百貨|百货|boutique|\bmall\b|超市|藥妝|药妆|書店|书店|文具|select shop|concept store|買|买)/i;
const ACTIVITY_WORDS =
  /(hike|hiking|trail|trek|登山|步道|健行|\btour\b|spa\b|massage|按摩|溫泉|温泉|onsen|diving|snorkel|surf|kayak|\bski\b|climb|rafting|cooking class|workshop)/i;

function detectType(text: string): PlaceType {
  if (CAFE_WORDS.test(text)) return 'cafe';
  if (RESTAURANT_WORDS.test(text)) return 'restaurant';
  if (SHOP_WORDS.test(text)) return 'shop';
  if (ACTIVITY_WORDS.test(text)) return 'activity';
  return 'attraction';
}

function tidyName(s: string): string {
  // strip a leading emoji/symbol run and surrounding quotes
  let n = s.replace(/^[\s"'“”「」『』（(【\[]+/, '').replace(/["'“”」』）)】\]\s]+$/, '');
  return n.trim();
}

export function parsePlaces(text: string): ParsedPlace[] {
  const global = detectLocation(text);
  const seen = new Set<string>();
  const results: ParsedPlace[] = [];

  const push = (name: string, note: string, address: string, contextText: string) => {
    const clean = tidyName(name);
    if (!clean) return;
    if (!/[0-9A-Za-zÀ-￿]/.test(clean)) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const local = detectLocation(contextText);
    const loc = local.city || local.country ? local : global;
    results.push({
      name: clean,
      city: loc.city,
      country: loc.country,
      type: detectType(`${name} ${note}`),
      category: '',
      trip: '',
      order: 0,
      note: note.trim(),
      address: address.trim(),
      lat: null,
      lng: null,
      rating: null,
      ratingCount: null,
    });
  };

  const blocks = text
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);
  const blockMode = blocks.length >= 2;

  if (blockMode) {
    for (const block of blocks) {
      const lines = block.split(/\r?\n/).map(cleanLine).filter(Boolean);
      if (lines.length === 0) continue;
      const name = lines[0];
      const addr: string[] = [];
      const notes: string[] = [];
      for (const l of lines.slice(1)) {
        if (/^https?:\/\//i.test(l)) continue;
        if (isAddress(l)) addr.push(l);
        else notes.push(l);
      }
      push(name, notes.join(' · '), addr.join(', '), block);
    }
  } else {
    for (const raw of text.split(/\r?\n/)) {
      const line = cleanLine(raw);
      if (!line) continue;
      if (/^https?:\/\//i.test(line)) continue;
      if (isAddress(line)) continue; // a lone address line isn't a place name
      push(line, '', '', line);
    }
  }

  return results.slice(0, 80);
}
