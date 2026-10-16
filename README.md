# Lilith

個人自用的線上 Markdown 筆記系統，以 [HedgeDoc](https://github.com/hedgedoc/hedgedoc) 1.10.8（AGPL-3.0）為基底修改。

| 路徑 | 說明 |
|---|---|
| `hedgedoc-1x/` | 程式碼（HedgeDoc 1.10.8 修改版） |
| [`功能/`](功能/README.md) | 每個功能一個資料夾：說明、檢測腳本 `check.ps1`、錯誤紀錄與處理方式 |
| [`ISSUES.md`](ISSUES.md) | 待解決問題（逐步改善） |
| [`PLAN.md`](PLAN.md) | 規劃與路線圖 |
| [`DEVLOG.md`](DEVLOG.md) | 開發時間軸 |
| `prompt.txt` | 使用者需求紀錄 |
| `備份/` | 資料庫備份（不進版控） |
| [`網站總覽.md`](網站總覽.md) | 一頁看懂網站現況：設定、頁面、功能、外觀 |
| [`品牌資產/`](品牌資產/README.md) | Logo、圖示、字體成品與品牌指南（顏色、字體、Logo 使用規則） |

## 安裝與啟動

需要 **Node.js 18 以上**（實測 v22）。不用另外裝 yarn，專案內附 `.yarn/releases/yarn-4.13.0.cjs`。以下指令都在 `hedgedoc-1x/` 資料夾執行。

1. 安裝依賴（第一次約 3～5 分鐘）：
   ```bash
   cd hedgedoc-1x
   node .yarn/releases/yarn-4.13.0.cjs install --immutable
   ```
2. 建置前端（第一次一定要做；之後改了 `public/js` 裡會被打包的檔案才需要）：
   ```bash
   node .yarn/releases/yarn-4.13.0.cjs run webpack --config webpack.prod.js
   ```
3. 建立設定檔：把 `config.lilith.example.json` 複製成 `config.json`，再把 `sessionSecret` 改成一串隨機長字串（可以用下面這行產生）：
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
   `config.json` 含有密鑰，已被 `.gitignore` 排除，不要把它 commit 進 repo。
4. 啟動（第一次啟動會自動建立 SQLite 資料庫 `db.hedgedoc.sqlite`）：
   ```bash
   node app.js
   ```
5. 打開 http://localhost:3000 （請用 `localhost`，不要用 `127.0.0.1`），按「註冊」建立第一個帳號。

- 預設只綁在本機（`host: 127.0.0.1`），其他電腦連不到；要給別人用之前，請先看 `完成度報告.md` 的「上線」一節。
- 想關閉註冊：`config.json` 裡把 `allowEmailRegister` 改成 `false` 後重新啟動。

## 檢測
```bash
powershell -ExecutionPolicy Bypass -File 功能/run-all-checks.ps1
```
