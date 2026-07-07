# 旅遊口袋清單 📍

看到 IG／部落格的景點、餐廳、小店時隨手記下來，累積一批後一次匯出成 CSV 匯入 Google My Maps，依國家分圖層。

- 平台：iPhone / Android（Expo 原生 App）
- 資料：**存在手機本機**，不需要帳號、離線可用
- 功能：**貼文字 → AI 自動整理成清單**（看懂 @帳號、分好 notes/地址、偵測國家城市）、每個地點一鍵開 **Google Maps**、手動輸入、依國家/城市分類、狀態標記、CSV 匯出
- AI 用 **Google Gemini 免費版**（免費、不用信用卡），跑一個在你電腦上的小後端；沒開後端時自動退回本機 Basic 模式

> 📋 **主要用法**：把 IG 貼文／部落格整段複製 → 貼進 App → 按 Organize → AI 上網查、整理好 → 你微調 → 每個都能點 🗺️ 開 Google Maps。設定見下方「貼文字匯入」。

---

## 第一次怎麼跑起來

### 1. 手機裝「Expo Go」

- iPhone：App Store 搜尋 **Expo Go**
- Android：Play 商店搜尋 **Expo Go**

### 2. 電腦啟動開發伺服器

打開「終端機」App，貼上下面兩行（第一次每次開新視窗都要先載入 node）：

```bash
cd "/Users/ashleylin/Downloads/bucket list app"
npm start
```

> 如果出現 `command not found: npm`，先執行一次：
> ```bash
> source ~/.nvm/nvm.sh && nvm use --lts
> ```
> 再重跑 `npm start`。

### 3. 用手機掃 QR Code

- 終端機會出現一個 QR Code
- **iPhone**：用「相機」App 掃 → 點跳出的連結，會用 Expo Go 打開
- **Android**：打開「Expo Go」→ 選 Scan QR code → 掃描

> 手機和電腦要連**同一個 Wi-Fi**。第一次載入要等十幾秒。

App 就會出現在你手機上了。之後改程式，手機會自動重新載入。

---

## 怎麼用（介面全英文）

1. **List / Map 切換**（上方）：Map = 地圖，點依狀態上色（**Visited 綠色 = 你去過的**），iPhone 用 Apple 地圖、不用金鑰。
2. **可收合三層清單**：先只看到**國家** → 點開看**城市** → 再點開看**地點**，多國混搭也不亂。
3. **兩種篩選（可疊加）**：狀態（Want to go 想去 / Confirmed 已確定要去 / Visited 去過）＋ 類型（Attraction / Restaurant / Cafe / Shop）。想只看餐廳就點 Restaurant。
4. 名字下有**小標註**（類型＋城市）；點進去看 notes、address、**🗺️ Google Maps**、**🔗 來源連結（你貼的 IG 貼文）**、Edit / Delete。
5. 貼文字時可順便貼**來源網址**，之後點該地點就能回去看原貼文。右下 **📋** 貼文字整理、**＋** 手動新增、右上 **Export CSV**。

---

## 貼文字匯入 📋（用免費 AI，Google Gemini）

按 **📋** 貼文字 → App 送到你電腦上的小後端 → **Gemini AI 上網查、看懂 @帳號、把「店名 / 推薦菜(notes) / 地址」分開、偵測國家城市** → Review → Add all。這能處理像 IG「☕ coffee at @bonanzacoffee」這種只給帳號的貼文,查出真正的店名並給對的 Google Maps 連結。

**設定一次（免費、不用信用卡）：**

1. **拿免費金鑰**：開 [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → Create API key → 複製那串。
2. **填金鑰**：把 `server/.env.example` 複製成 `server/.env`，貼在 `GEMINI_API_KEY=` 後面。
3. **開後端**（另開一個終端機視窗，跟 Expo 那個並存）：
   ```bash
   cd "/Users/ashleylin/Downloads/bucket list app/server"
   npm install    # 第一次才需要
   npm start
   ```
   看到「✅ Bucket List backend running … key=set」就好，視窗一直開著。
4. **用**：手機和電腦同一 Wi-Fi → App 按 📋 → 貼文字 → Organize（會顯示「🔎 Looking up places…」）→ Review → Add all。

**沒開後端也能用**：如果後端沒跑，App 會自動退回「Basic mode」（本機規則,不用 AI、不用網路,但比較笨,像 @帳號 就查不到）。Review 頁上方會顯示 ✨ AI-detected 或 ⚙️ Basic mode。

> 費用：Gemini 免費額度對個人用量很夠。若預設模型不能用,在 `server/.env` 加 `GEMINI_MODEL=...`（可先開 `http://<電腦IP>:8787/models` 看你的金鑰有哪些模型）。

---

## （進階、要花錢）截圖 → AI 自動抓 🖼️

也可以用「截圖丟進去、AI 讀圖」的版本(Claude,要綁卡、一張約幾分錢)。程式在 `server/`，預設不顯示。開啟:在 `server/.env` 填 `ANTHROPIC_API_KEY=`,並在 `src/HomeScreen.tsx` 把 `<PasteImport />` 換成 `<ScreenshotImport />`。

---

## 匯入 Google My Maps

1. 電腦開 [Google My Maps](https://www.google.com/mymaps) → 建立新地圖 → **匯入**，選剛剛匯出的 CSV。
2. **選擇地標位置的欄位**：勾「**地址**」（若你有填經緯度，也可改用「緯度」＋「經度」）。
3. **選擇標題欄位**：選「**名稱**」。
4. 匯入後，可在左側點該圖層 →「**樣式**」→「依資料欄分組」選 **國家**，就會依國家用不同顏色分類。

> **關於定位**：這版還沒串 Google 評分／自動抓座標，所以：
> - 有填「地址」→ My Maps 用地址定位（最準）。
> - 沒填地址 → CSV 會自動放「名稱＋城市＋國家」讓 Google 猜位置（多數知名地點找得到，小店可能要手動微調）。
>
> 想更準，就在新增時順手把地址貼上。

---

## 之後可以加的功能

- 串 Google Places API：自動顯示評分⭐／評論數、自動帶入精準座標
- App 內地圖檢視
- 跨裝置雲端同步
- iOS 分享鍵：從 IG 直接「分享 → 存進 App」（需改成 dev build，不能用 Expo Go）

---

## 技術備忘

- 前端：Expo SDK 54 / React Native 0.85 / TypeScript
- 本機儲存：AsyncStorage（`bucketlist.places.v1`）
- CSV 匯出：`expo-file-system` 寫暫存檔 + `expo-sharing` 系統分享
- AI 抓地點：`server/`（Node + Express）呼叫 Claude 視覺模型（`@anthropic-ai/sdk`），用結構化輸出回傳地點清單；金鑰放後端，不進 App
- 免費核心：`parseText.ts`（貼上文字切成候選地點）、`maps.ts`（產生 Google Maps 搜尋連結）、`components/PasteImport.tsx`（貼文字流程）
- 前端主要程式在 `src/`：`types.ts`（資料模型）、`store.tsx`（狀態）、`storage.ts`（本機）、`csv.ts`／`export.ts`（匯出）、`HomeScreen.tsx` 與 `components/`（畫面）
- 選用付費：`api.ts`／`config.ts`（連後端）、`components/ScreenshotImport.tsx`（截圖 AI，預設不顯示）

### 常用指令

```bash
npm start          # 啟動開發伺服器（掃 QR 用 Expo Go 開）
npx tsc --noEmit   # 型別檢查
```
