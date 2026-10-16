# 05 Catppuccin 主題

> 狀態：✅ 完成　｜　Commit：`365a522`、`89e9958`（移除 emoji）　｜　檔案：`public/js/catppuccin.js`、`public/css/catppuccin.css`

## 需求來源
- prompt 10：UI/UX 改成部落格風格，主題用 Catppuccin；選擇「四種 flavor 全部可切換」，套用到首頁、閱讀模式、編輯器。
- prompt 11：切換選單不要 emoji。

## 說明
- **色票**：取自官方 `catppuccin/palette` 的 `palette.json`，共 26 色 × 4 種配色。
- **做法**：外掛式覆寫，上游 CSS/JS 都不改，也不需要重新打包。
  - CSP 允許從 `/js/`、`/css/` 載入（`lib/csp.js:15-21`），所以做成兩個靜態檔。
  - `catppuccin.js` 在 `<head>` 同步執行，首次繪製前就把 flavor 寫到 `<html data-ctp="...">`，避免畫面閃一下舊配色。
  - 選擇存在 localStorage 的 `ctpFlavor`（`auto` 或 flavor id）。`auto` 依系統深淺色選 Latte 或 Mocha。
  - 同步 HedgeDoc 原本的 `nightMode`，讓上游依 `.night` 判斷的地方（例如 logo）也正確。
  - 切換選單：編輯頁取代原本的月亮按鈕；首頁放在導覽列；發表頁是左下角的浮動按鈕。
  - `catppuccin.css`：四套色票變數＋各頁覆寫，所有規則都以 `html[data-ctp]` 開頭。
- **掛載位置**：`index/head.ejs`、`hedgedoc/head.ejs`、`pretty.ejs`，放在打包 CSS 之後。網址帶 `?v=N`，因為靜態檔會被瀏覽器快取 1 天，**每次改這兩個檔都要把 N 加 1**。
- **編輯器**：CodeMirror 依 Catppuccin 慣例上色（h1 紅、h2 橘、h3 黃、h4 綠……）；隱藏狀態列原本的編輯器主題切換。

## 檢測

### 自動檢測：`check.ps1`
| ID | 檢查內容 |
|---|---|
| CTP-1 | CSS 裡 4 × 26 個色值都和官方色票一致 |
| CTP-2 | `/css/catppuccin.css`、`/js/catppuccin.js` 回 200 |
| CTP-3 | 三個 head 模板都有載入，而且版本號一致 |
| CTP-4 | 主題腳本沒有 `defer`/`async`（要在繪製前執行） |
| CTP-5 | 選單有「跟隨系統」＋4 種配色，而且沒有 emoji |
| CTP-6 | `eslint public/js/catppuccin.js` 通過 |
| CTP-7 | 過去 bug 的防回歸檢查（E1、E3～E5） |
| CTP-8 | 改過的模板沒有 UTF-8 BOM（E2） |
| CTP-9 | 原本的夜間切換與編輯器主題切換已隱藏 |

### 手動檢測（瀏覽器）
1. 點畫筆圖示，依序選 Latte、Frappé、Macchiato、Mocha、跟隨系統。
2. 每種配色下檢查：首頁、編輯器（雙欄）、閱讀模式、發表頁 `/s/<id>`。
3. 重新整理後，選擇應該被保留。

### 最近一次檢測結果（2026-10-16）
- 自動：9 PASS / 0 WARN / 0 FAIL
- 手動：四種配色下，編輯區、行號欄、閱讀區的背景都是 base，導覽列和狀態列都是 mantle，色值和官方一致 ✅

## 錯誤紀錄與處理

| # | 日期 | 現象 | 原因 | 處理方式 | 狀態 |
|---|---|---|---|---|---|
| E1 | 10-16 | 切換按鈕沒有出現；主控台出現 `Cannot access 'switchers' before initialization` | `switchers` 的宣告放在第一次 `apply()` 之後（TDZ） | 把宣告移到最前面；CTP-7 會檢查 | ✅ 已處理 |
| E2 | 10-16 | 模板的 diff 第一行被改到 | PowerShell 5.1 `Set-Content -Encoding UTF8` 會加上 BOM | 改用 .NET `UTF8Encoding($false)` 寫回；CTP-8 會檢查 | ✅ 已處理 |
| E3 | 10-16 | 編輯頁一載入，「選單」下拉就自動展開 | 我寫的 `.list { display:block }` 也套到了 HedgeDoc 的下拉選單（它們同樣有 `list` class） | 規則限定在 `#history .list`；CTP-7 會檢查 | ✅ 已處理 |
| E4 | 10-16 | 深色配色時，帶行號的程式碼區塊變成淺色 | `markdown.css:16-17` 在夜間模式對 `pre` 用 `filter: invert(100%)` | 覆寫成 `filter: none`；CTP-7 會檢查 | ✅ 已處理 |
| E5 | 10-16 | Latte 下編輯區和狀態列仍是深色 | one-dark 主題把 `.CodeMirror-scroll` 寫死為 `#1e2126`；`index.css:497` 把狀態列寫死為 `#1c1c1e` | 兩處都補上覆寫；CTP-7 會檢查 | ✅ 已處理 |
| E6 | 10-16 | 使用者不要 emoji | 需求變更 | 移除 flavor 的 emoji，只保留色塊與名稱；CTP-5 會檢查 | ✅ 已處理 |
| E7 | 10-16 | 主控台看到舊的 `?v=1` 錯誤 | 那是修正前留下的紀錄 | 以版本號區分新舊紀錄 | ℹ️ 說明 |
| E8 | 10-16 | 簡報模式沒有套用主題（I-6） | `slide.ejs` 沒有載入主題檔 | 載入 catppuccin.js／css，並在 `<html>` 標記 `data-ctp-slides`：沒指定主題為 `lilith`（套用配色、字型、程式碼高亮，切換按鈕調淡），筆記自己指定 reveal.js 主題為 `custom`（主題腳本直接結束，完全不動）。CTP-3 已加入 slide.ejs（`af4922f`） | ✅ 已處理 |
| E9 | 10-16 | 修改簡報樣式後畫面還是舊的 | 忘了更新 `?v=`，之後瀏覽器又快取了 HTML | 每次改 CSS／JS 都要更新版本號（目前 v=27），測試時帶查詢字串重新載入 | ✅ 已處理 |
| E10 | 10-16 | 自訂 white 主題的簡報變成深底深字 | 全域的 body 背景仍套用 | 改成 `custom` 時整個主題腳本不執行 | ✅ 已處理 |
| E11 | 10-16 | 帶行號程式碼的分隔線（I-9） | 來源為 `markdown.css:49` `border-right: 3px solid #6ce26c !important`，顏色早已覆寫 | 再把寬度改成 1px（`af4922f`） | ✅ 已處理 |
| E12 | 10-16 | hhyn：整個頁面的字都要再放大一點（prompt 110；確認範圍「全站」、幅度「約 10%」） | 字級分散在 `catppuccin.css` 的 209 處 px 設定，以及 Bootstrap（內文 14px）、HedgeDoc（編輯器 18px）的預設值 | `catppuccin.css` 所有 px 字級 ×1.1（取到 0.5px，72px 的卡片裝飾字不動）；內文基準 15.5px、編輯器 20px。手機寬度頂部列加上鈴鐺後放不下 → 480px 以下縮小間距並允許換行。瀏覽器檢查紀錄頁、編輯器（游標位置正常）、發表頁、垃圾桶、手機頂部列；BLOG-3、LIST-3 改成新的字級（`cbb3368`） | ✅ 已處理 |
| E13 | 10-16 | hhyn：YAML 寫的 tags 要像 HackMD 一樣在標題旁出現，存檔（Ctrl+S）時出現（prompt 120） | HedgeDoc 只認 `tags: a, b` 和 `###### tags:`，**不認 YAML 清單寫法**（`tags:` 下一行 `- notes`），所以標籤完全沒出現 | 伺服器 `extractNoteTags` 與前端 `renderTags` 都支援 YAML 清單；編輯器頂部列標題旁顯示標籤（最多 5 個），筆記載入與按 Ctrl+S／Cmd+S 時更新；Ctrl+S 不再跳出瀏覽器「儲存網頁」，改顯示「已儲存」（離線時顯示「目前離線，連線後會自動儲存」）（`0089cad`） | ✅ 已處理 |
| E14 | 10-16 | hhyn：首頁頂部列要跟 Blowfish 一樣長（prompt 122） | 頂部列在 1120px 的頁面容器裡 | 實際量 Blowfish：`max-w-7xl` 1280px、離視窗邊 24px（手機 12px），與內容寬度無關。照做：1600px 視窗下寬 1280px；手機 375px 下寬 351px、沒有橫向捲動（`0089cad`） | ✅ 已處理 |
| E15 | 10-16 | hhyn：淺色模式的顏色跟 Mocha 一樣（prompt 146；確認是「淺色用 Mocha 的重點色」） | — | Latte 的紫色系（mauve、pink、lavender、blue）與 teal 改用 Mocha 的值；紅、綠、黃維持 Latte（狀態文字要看得清楚）；卡片星空封面在淺色也用 Mocha 的深紫；新增 `--ctp-on-accent`（重點色上的文字，淺色用深色字）。頁尾照 Blowfish：左「© 年份 Lilith」、右「由 HedgeDoc 強力驅動…」（prompt 145、150）（`d41965c2`） | ✅ 已處理 |
