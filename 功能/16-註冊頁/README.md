# 16 註冊頁（參考 HackMD）

> 狀態：✅ 完成　｜　Commit：`9fb04cc`　｜　檔案：`lib/web/accountRules.js`（新）、`public/views/register.ejs`（新）、`lib/web/loginRouter.js`、`lib/web/auth/email/index.js`、`lib/web/profileRouter.js`、`public/views/index/body.ejs`、`public/views/login.ejs`、`public/views/shared/profile-modal.ejs`、`public/css/catppuccin.css`；刪除 `public/views/shared/register-modal.ejs`

## 需求來源
- prompt 33：（附 HackMD 註冊頁截圖）註冊頁面參考（I-19）。

## 說明

### 版面（對照 HackMD 截圖）
| HackMD | Lilith |
|---|---|
| 上方 logo 列、置中標題「註冊」 | 同（和 [15 登入頁](../15-登入頁/README.md) 共用樣式） |
| 使用者名稱＋規則提示 | 同：「僅允許 a-Z、0-9 以及 - 號（- 不能是第一個字元）」 |
| Email | 同 |
| 密碼＋規則提示 | 同：「密碼長度須為 8 到 128 個字，且包含大小寫英文字母及數字」 |
| （沒有） | **多一個「確認密碼」**：這個站沒有寄信重設密碼，打錯就只能用指令重設，所以保留原本的確認欄位 |
| 紫色「註冊」按鈕 | 同（mauve，隨配色變化） |
| 「或是」＋透過 Google／GitHub 登入 | 同；只顯示已設定金鑰的平台，沒有就不顯示分隔線 |
| 已經有帳號了？登入 | 同，連到 `/login` |
| 註冊即表示您同意服務條款 | 只有 `public/docs/terms-of-use.md` 存在時才顯示。10-16 已依 hhyn 要求擬好條款（`15307b3`），現在會顯示並連到 `/s/terms-of-use` |
| 左下角語言選單 | 改放主題切換鈕（同 15 E2，不做） |

### 行為
- `GET /register`：已登入 → 回首頁；**註冊關閉時 → 導到 `/login` 並顯示「目前沒有開放註冊。」**（目前就是關閉狀態）。
- `POST /register`（只在 `allowEmailRegister: true` 時存在，關閉時 404，和上游相同）：
  - 依序檢查使用者名稱、Email 格式、密碼規則、兩次密碼一致；有錯就回到 `/register`，顯示中文訊息，**使用者名稱與 Email 保留**（密碼不保留）。
  - Email 已存在 →「這個 Email 已經註冊過了，請直接登入。」
  - 成功 → 建立帳號、**直接登入**、回首頁（上游是要求再登入一次）。歡迎筆記照常建立（[09](../09-歡迎筆記/README.md)）。
- 使用者名稱存成顯示名稱（`profile` JSON 和「編輯使用者資料」改名時的格式相同），之後可在 [13](../13-使用者資料/README.md) 改。
- 規則集中在 `lib/web/accountRules.js`；「編輯使用者資料」改密碼也改用同一個規則（原本只要求 8 個字）。舊密碼不受影響，登入照常。
- 首頁兩個「註冊」按鈕改連到 `/register`，舊的註冊對話框刪除；登入頁的「還沒有帳號？」也連到這裡。

## 檢測

### 自動檢測：`check.ps1`
| ID | 檢查內容 |
|---|---|
| SIGNUP-1 | 離線測試 `test-register.js`（11 項）：使用者名稱與密碼規則的邊界、表單欄位、提示文字、登入連結、有無平台時的分隔線、服務條款、錯誤訊息與回填值的跳脫 |
| SIGNUP-2 | `GET /register` 依設定：開放時 200，關閉時導到 `/login` |
| SIGNUP-3 | 註冊程式有檢查名稱、密碼規則、確認密碼，成功後登入，失敗回 `/register` |
| SIGNUP-4 | 改密碼也用同一個規則 |
| SIGNUP-5 | eslint 通過 |

另外 [08](../08-帳號註冊/README.md) 的 REG-2／REG-4／REG-5 已改成檢查新頁面；[05](../05-Catppuccin主題/README.md) 的主題檔版本為 v=28。

### 手動檢測（2026-10-16）
註冊在正式伺服器是關閉的，所以另外開一個**臨時伺服器**：port 3001、`CMD_DB_URL=sqlite::memory:`、只在這個行程打開註冊。

> **更正（10-16）**：這個臨時伺服器其實**用的是正式資料庫**（見 E4）。測試建立的帳號 `lilith-ui-test-reg@example.com` 與它的歡迎筆記留在正式資料庫裡，之後清理測試帳號時發現並刪除；確認沒有其他測試帳號、沒有孤兒筆記。驗證失敗的那幾次嘗試沒有建立帳號。
| 步驟 | 結果 |
|---|---|
| Mocha 下開 `/register` | 版面同 HackMD 截圖 ✅ |
| 密碼 `weakpass123`（沒有大寫） | 回到表單，顯示密碼規則，名稱與 Email 保留 ✅ |
| 正確填寫 | 直接登入回首頁；`/me` 名稱為輸入的使用者名稱；紀錄裡有歡迎筆記 ✅ |
| 重複 Email／兩次密碼不同／名稱 `-bad`／中文名稱／Email 格式錯／密碼全大寫 | 各自顯示對應訊息 ✅ |
| 使用者名稱 `x"><script>…` | 回填時被跳脫 ✅ |
| 用新帳號登入；已登入開 `/register` | 登入成功；被導回首頁 ✅ |
| Latte、手機寬度 375px | 沒有橫向捲動 ✅ |
| 正式伺服器（註冊關閉）開 `/register` | 導到 `/login` ✅；`POST /register` 為 404 ✅ |

### 最近一次檢測結果（2026-10-16）
- 自動：5 PASS / 0 WARN / 0 FAIL

## 錯誤紀錄與處理

| # | 日期 | 現象 | 原因 | 處理方式 | 狀態 |
|---|---|---|---|---|---|
| E1 | 10-16 | 用 curl 測中文名稱時，回填值變成 `%A4%A4…` 亂碼 | Git Bash 用 Big5 編碼送出參數（測試環境問題，不是伺服器） | 只確認被擋下並顯示規則訊息；跳脫另用 `"><script>` 測 | ℹ️ 說明 |
| E2 | 10-16 | 使用者名稱不保證唯一 | 1.x 沒有使用者名稱欄位，只存成顯示名稱 | 個人使用不需要唯一；若之後要用名稱當網址再加欄位 | ⚠️ 已知 |
| E3 | 10-16 | Email 大小寫不同會被當成不同帳號 | 上游就是用原字串比對（登入也是） | 維持上游行為，註冊時請用一致的寫法 | ⚠️ 已知 |
| E4 | 10-16 | 以為是記憶體資料庫的臨時伺服器，其實寫進了正式資料庫 | `lib/models/index.js:25` 用 `new Sequelize(config.dbURL, dbconfig)`，`dbconfig` 來自 `config.json` 的 `db`，其中的 `storage: ./db.hedgedoc.sqlite` 蓋過了網址裡的 `:memory:`。我沒有先驗證就假設成功隔離 | 刪除遺留的測試帳號與歡迎筆記並確認沒有孤兒資料；README 更正。**之後要隔離測試，必須同時覆寫 storage**（例如另外指定 `CMD_DB_URL` 以外，用獨立的 config 檔，或用 node 腳本直接以記憶體資料庫建立 models），並在測試前先查資料庫確認 | ✅ 已處理 |
| E5 | 10-16 | 服務條款文字 | hhyn 選「幫我擬一份」 | 寫在 `public/docs/terms-of-use.md`，hhyn 可再改。原本想寫「刪除使用者會一起刪除筆記」，查程式（`lib/models/note.js:137-143` 為 `constraints: false`）無法確認會連帶刪除，所以改成請使用者自行刪除或聯絡站長 | ✅ 已處理 |
