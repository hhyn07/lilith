# Lilith — 規劃與路線圖

> 基底：HedgeDoc **1.10.8**（HackMD 開源核心的後代，AGPL-3.0）
> 各功能的實作、檢測、錯誤紀錄 → [功能/README.md](功能/README.md)　｜　待解決問題 → [ISSUES.md](ISSUES.md)　｜　時間軸 → [DEVLOG.md](DEVLOG.md)

## 1. 目標與範圍
個人自用的線上 Markdown 筆記系統，在 HedgeDoc 1.x 上改進：
1. 介面與外觀
2. 組織與搜尋
3. 編輯體驗

非目標（暫定）：多人協作強化、對外公開服務。

## 2. 架構摘要
詳見 [01 環境建置與啟動](功能/01-環境建置與啟動/README.md)。前端是 jQuery + Bootstrap 3 + Webpack 4，後端是 Express + Sequelize 5 + SQLite，即時協作用自家的 OT。

## 3. 路線圖

### 階段 0：環境就緒 — ✅ 完成
- [01 環境建置與啟動](功能/01-環境建置與啟動/README.md)、[02 Windows 建置修正](功能/02-Windows建置修正/README.md)、[03 版本控制](功能/03-版本控制/README.md)、[04 安全設定](功能/04-安全設定/README.md)

### 階段 1：介面與外觀 — ✅ 主體完成
- [05 Catppuccin 主題](功能/05-Catppuccin主題/README.md)、[06 部落格排版](功能/06-部落格排版/README.md)、[07 Lilith 品牌](功能/07-Lilith品牌/README.md)、[08 帳號註冊](功能/08-帳號註冊/README.md)、[09 歡迎筆記](功能/09-歡迎筆記/README.md)
- ~~進行中：分享對話框~~ 已完成（I-3）。之後的功能（書本模式、團隊、通知、公開頁、團隊設定…）見 [功能/README.md](功能/README.md) 與 [完成度報告.md](完成度報告.md)。
- 剩餘細節：見 [ISSUES.md](ISSUES.md)

### 階段 2：組織與搜尋（需動後端與資料庫）
- 規劃與現況查證：[10 筆記組織與搜尋](功能/10-筆記組織與搜尋/README.md)
- 資料夾／標籤：新增 migration 與資料表，不再塞進 `users.history` JSON。
- 全文搜尋：SQLite `LIKE` 或 FTS5（待評估）。
- 筆記互連：`[[筆記名稱]]` 語法（擴充 markdown-it）＋反向連結索引表。
- 注意：Sequelize 5 版本老舊，新增功能時留意 API 差異。

### 階段 3：編輯體驗（最接近核心，風險最高）
- 快捷鍵、自動補全、手機操作（CodeMirror 5 設定與外掛層）。
- 即時預覽／分欄改善。
- 不輕易動 OT 同步層（`lib/ot/`）。

### 備案：自用精簡化（使用者未選）
- 移除不用的登入方式、多人權限，簡化部署。

## 4. 做法原則
- **外掛式修改**：盡量新增檔案、用覆寫的方式改外觀，少改上游檔案，方便日後合併上游的安全修補。
- **每個功能一個 commit**，記錄在 [03 版本控制](功能/03-版本控制/README.md)。
- **每次修改都主動 code review**，發現的問題記在對應功能的錯誤紀錄。
- **每個功能都有檢測**（`check.ps1`），改完要跑 `功能/run-all-checks.ps1`。

## 5. 風險與注意事項
- **授權**：AGPL-3.0。若修改版對外提供網路服務，須公開修改後的原始碼；純個人自用、不對外則無此問題。
- **上游維護**：1.x 已不加新功能，安全修補要自己追蹤上游 tag。
- **技術債**：Bootstrap 3、Webpack 4、CodeMirror 5、Sequelize 5 都是舊世代，避免大範圍重構。
- **備份**：`hedgedoc-1x/db.hedgedoc.sqlite` 與 `public/uploads/` 要定期備份。

## 6. 待決定
1. ~~是否在 GitHub 建立私有 repo~~ 已決定：整個專案一個 repo，推到 `hhyn07/lilith-notes`（Private，2026-10-16）。
2. 資料庫：繼續用 SQLite，或換 PostgreSQL（搜尋能力較強）？
3. 是否需要多裝置／手機使用、離線？
4. 部署方式：本機、NAS、VPS、Docker？

## 7. 專案檔案
| 路徑 | 說明 |
|---|---|
| `hedgedoc-1x/` | HedgeDoc 1.10.8 修改版（2026-10-16 起併入專案 repo，分支 `main`） |
| `功能/` | 各功能的說明、檢測腳本、錯誤紀錄 |
| `ISSUES.md` | 待解決問題清單（逐步改善） |
| `DEVLOG.md` | 時間軸 |
| `PLAN.md` | 本檔 |
| `prompt.txt` | 使用者需求紀錄 |
