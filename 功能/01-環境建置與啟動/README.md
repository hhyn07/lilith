# 01 環境建置與啟動

> 狀態：✅ 完成　｜　基底：HedgeDoc **1.10.8**（AGPL-3.0）　｜　程式碼位置：`hedgedoc-1x/`

## 需求來源
- prompt 2、3：以 HedgeDoc 1.x 為基底修改，專案資料夾為 `個人自用線上筆記系統\`。
- prompt 6：安裝依賴並把 HedgeDoc 跑起來。

## 說明

### 取得原始碼
```bash
git clone --branch 1.10.8 --depth 1 https://github.com/hedgedoc/hedgedoc hedgedoc-1x
```
- HEAD 為 tag `1.10.8`（commit `b09975a`），淺層 clone。外層資料夾不是 git repo。

### 環境（2026-10-16 實測）
| 項目 | 版本 / 說明 |
|---|---|
| Node.js | v22.20.0（需求 >= 18） |
| npm | 10.9.3 |
| yarn | 系統沒裝 → 使用專案內附 `.yarn/releases/yarn-4.13.0.cjs`（`.yarnrc.yml` 指定） |
| 資料庫 | SQLite：`hedgedoc-1x/db.hedgedoc.sqlite`（`config.json` 的 development 區段） |

### 架構摘要（已在原始碼與依賴清單中查證）
| 項目 | 內容 |
|---|---|
| 後端 | Express 4.22、Sequelize 5.22.5、socket.io 4.8 |
| 即時協作 | 自家 Operational Transformation：`lib/ot/`、`lib/realtime.js` |
| 資料模型 | `lib/models/`：note、revision、user、author、temp；遷移在 `lib/migrations/` |
| 前端 | jQuery 3.7 + Bootstrap 3.4.1 + Less，Webpack 4.47 打包（`public/js`、`public/css`、`public/views`） |
| 編輯器 | `@hedgedoc/codemirror-5` 5.65.12 |
| 渲染 | markdown-it 13、Mermaid 9.1.7、MathJax 2.7.9、reveal.js 3.9.2 等 |

## 使用方式
```bash
# 安裝依賴（約 3 分鐘）
node .yarn/releases/yarn-4.13.0.cjs install --immutable
# 建置前端（改了 public/js 裡會被打包的檔案才需要）
node .yarn/releases/yarn-4.13.0.cjs run webpack --config webpack.prod.js
# 啟動（未設 NODE_ENV 時預設 development，見 lib/config/index.js:14）
node app.js
```
- 網址：http://localhost:3000
- 開發時可用 `--config webpack.dev.js --watch` 自動重建。
- `public/js/catppuccin.js`、`public/css/catppuccin.css` 是直接提供的靜態檔，**不需要**重新打包。

## 檢測

### 自動檢測：`check.ps1`
```bash
powershell -ExecutionPolicy Bypass -File 功能/01-環境建置與啟動/check.ps1
```
| ID | 檢查內容 |
|---|---|
| ENV-1 | Node.js >= 18 |
| ENV-2 | 內附 yarn 4.13.0 存在 |
| ENV-3 | 已安裝依賴，`sqlite3` 原生模組可載入 |
| ENV-4 | `config.json` 存在 |
| ENV-5 | 前端已建置（`public/build/index-pack*.js`） |
| ENV-6 | SQLite 資料庫檔存在 |
| ENV-7 | 伺服器 `GET /status` 回 200 |
| ENV-8 | `SequelizeMeta` 筆數 = `lib/migrations` 檔案數（所有 migration 已套用） |

### 最近一次檢測結果（2026-10-16）
- 8 PASS / 0 WARN / 0 FAIL

## 錯誤紀錄與處理

| # | 日期 | 現象 | 原因 | 處理方式 | 狀態 |
|---|---|---|---|---|---|
| E1 | 10-16 | `yarn` 指令不存在 | 系統沒有全域 yarn | 改用專案內附的 `node .yarn/releases/yarn-4.13.0.cjs` | ✅ 已處理 |
| E2 | 10-16 | 安裝時出現 peer dependency 警告（eslint 版本；`connect-session-sequelize` 要求 sequelize >= 6，但專案用 5.22.5） | 上游依賴版本本身不一致 | 只是警告，不影響執行；不處理，避免偏離上游 | ⚠️ 保留 |
| E3 | 10-16 | 啟動 log 有 `DEP0044 util.isArray` 棄用警告 | 上游依賴使用舊 API | 不影響功能，不處理 | ⚠️ 保留 |
| E4 | 10-16 | 開新筆記後顯示 OFFLINE、編輯器空白 | Windows 路徑造成的建置錯誤 | 詳見 [02-Windows建置修正](../02-Windows建置修正/README.md) | ✅ 已處理 |
| E5 | 10-16 | 背景伺服器工作顯示「failed, exit code 127」 | 為了重啟伺服器而主動結束舊的程序，不是錯誤 | 無需處理；重啟後以 ENV-7 確認伺服器正常 | ℹ️ 說明 |
| E6 | 10-16 | 第一次跑檢測時 `SEC-12`（mocha）誤判 FAIL | 檢測腳本問題：PowerShell 5.1 在 `ErrorActionPreference=Stop` 下，會把原生程式的 stderr 警告（Node `DEP0170`）當成例外 | 在 `_lib/common.ps1` 新增 `Invoke-Native`，呼叫原生程式時暫時改用 `Continue`，改為依 exit code 判斷；所有檢測腳本都改用它 | ✅ 已處理 |

## 2026-10-17 從零安裝測試（prompt 159）
hhyn 問：別人照 README 做能不能啟動？
- **原本不行**：README 的「啟動」只寫了 `node app.js`。從 GitHub 重新下載公開版照做，立刻出現 `Cannot find module 'express'`（沒安裝依賴）；而且沒有 `config.json`（含密鑰，不進 repo）、前端沒建置（`public/build/` 不進 repo）。
- **修正**：README 改成「安裝與啟動」五步（安裝依賴 → 建置前端 → 複製 `config.lilith.example.json` 成 `config.json` 並設定 `sessionSecret` → `node app.js` → 打開並註冊）；新增 `hedgedoc-1x/config.lilith.example.json`（Lilith 用的最小設定，沒有任何真的密鑰）。
- **實測**（在全新資料夾 clone 公開版、port 3010，不碰正式資料庫）：安裝 1 分 54 秒、建置 0 錯誤、啟動後 25 個 migration 全部套用並自動建立資料庫、註冊 → 登入 → 建立筆記都成功、首頁外觀與正式站一樣。測完刪除。
