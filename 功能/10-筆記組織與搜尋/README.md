# 10 筆記組織與搜尋（規劃中）

> 狀態：🟡 部分完成（資料夾、收藏已在 [20](../20-筆記卡片選單與資料夾/README.md) 實作；全文搜尋尚未做）　｜　對應 PLAN.md 階段 2

## 需求來源
- prompt 2：改進重點之一是「組織與搜尋」。
- prompt 5：讀程式碼驗證 PLAN.md 中未驗證的項目。

## 現況（2026-10-16 讀碼查證）
- **筆記本體**：`notes` 表的欄位有 id、shortid、alias、permission、viewcount、title、content、authorship、lastchangeAt、savedAt（`lib/models/note.js:29-86`）。**沒有**資料夾或父子層級，也沒有獨立的標籤欄位。
- **標籤**：每次存檔時由 `Note.extractNoteTags` 從內容解析，來源是 YAML 的 `tags:` 或以 `tags` 開頭的標題（`note.js:367-398`）。資料庫沒有標籤表。
- **筆記清單（「紀錄」）**：
  - 已登入：存在 `users.history`，是一整包 JSON 字串（`lib/history.js:66-99`）；置頂也存在這裡。
  - 未登入：存在瀏覽器的 localStorage `notehistory`（`public/js/history.js:67-69`）。
  - 也就是說，**清單是每位使用者的 JSON，不是對 notes 表的查詢**。
- **搜尋**：只有前端 list.js 對清單做關鍵字搜尋（`public/js/cover.js`），欄位是 id、標題、時間、標籤、置頂。**不能搜尋內文**。
- **標籤篩選**：已有前端多選（select2，符合任一標籤即顯示）。
- ⚠️ 未驗證：是否有其他檔案（如 views）存在資料夾的介面概念；我沒有全域搜尋 folder。

## 規劃
- **全文搜尋**要從零做：後端新增查詢 `notes.content` 的 API。個人使用的資料量小，SQLite 的 `LIKE` 或 FTS5 都可以（尚未評估選哪個）。
- **資料夾／標籤**不要再塞進 `users.history` 那包 JSON（無法查詢、容易互相覆蓋），改為新增資料表並寫 migration。
- 沿用「標籤寫在筆記內容裡」的方式（和 Markdown 一致），另外在後端建立索引表加速查詢。

## 檢測
- 尚未實作，沒有檢測腳本。實作時請在這個資料夾加上 `check.ps1`。

## 錯誤紀錄與處理
- 尚無。

## 2026-10-16 更新
- **資料夾、收藏**：已在 [功能 20](../20-筆記卡片選單與資料夾/README.md) 實作，依本頁規劃另建資料表（`LilithFolders`、`LilithNoteMetas`）與 migration，沒有塞進 `users.history`。
- **標籤**：仍寫在筆記內容裡；功能 20 讓擁有者可以從紀錄卡片直接改。尚未建立後端索引表。
- **全文搜尋**：尚未實作。
