# Lilith

個人自用的線上 Markdown 筆記系統，以 [HedgeDoc](https://github.com/hedgedoc/hedgedoc) 1.10.8（AGPL-3.0）為基底修改。

| 路徑 | 說明 |
|---|---|
| `hedgedoc-1x/` | 程式碼（HedgeDoc 1.10.8 修改版；2026-10-16 起併入本 repo，保留完整歷史） |
| [`功能/`](功能/README.md) | 每個功能一個資料夾：說明、檢測腳本 `check.ps1`、錯誤紀錄與處理方式 |
| [`ISSUES.md`](ISSUES.md) | 待解決問題（逐步改善） |
| [`PLAN.md`](PLAN.md) | 規劃與路線圖 |
| [`DEVLOG.md`](DEVLOG.md) | 開發時間軸 |
| `prompt.txt` | 使用者需求紀錄 |
| `備份/` | 資料庫備份（不進版控） |
| [`網站總覽.md`](網站總覽.md) | 一頁看懂網站現況：設定、頁面、功能、外觀 |
| [`品牌資產/`](品牌資產/README.md) | Logo、圖示、字體成品與品牌指南（顏色、字體、Logo 使用規則） |

## 啟動
```bash
cd hedgedoc-1x
node app.js
```
開啟 http://localhost:3000（請用 `localhost`，不要用 `127.0.0.1`）。

## 檢測
```bash
powershell -ExecutionPolicy Bypass -File 功能/run-all-checks.ps1
```
