# 04 安全設定

> 狀態：✅ 完成　｜　Commit：`ff6b535`（freely 修正）　｜　設定檔：`hedgedoc-1x/config.json`（不進版控）

## 需求來源
- prompt 8：只綁 localhost、關閉匿名編輯。
- prompt 9：修正 `ifMayEdit` 的 freely 漏洞，驗證後 commit。

## 說明

### config.json（development 區段）
| 設定 | 值 | 作用（依 `lib/config/default.js`、`lib/config/index.js` 查證） |
|---|---|---|
| `host` | `"127.0.0.1"` | 原預設 `0.0.0.0`（全網卡），改為只聽本機 |
| `allowAnonymous` | `false` | 未登入不能建立筆記 |
| `allowAnonymousEdits` | `false` | 未登入不能編輯 |
| `email` | `true` | E-Mail 是唯一的登入方式 |
| `allowEmailRegister` | `false` | 關閉網頁註冊（曾為了讓 hhyn 註冊而暫時開啟，見 E5） |
| `sessionSecret` | 隨機 128 字元 hex | 未設定時每次重啟都會隨機產生，所有人會被登出 |
| `defaultPermission` | `"private"` | 新筆記預設只有自己能看與編輯（原本是 editable；code review 後加入，見 E6） |

- 兩個 allow 都關閉後，`index.js:76-77` 會從可選權限中移除 `freely`，上傳權限自動變成 `registered`（`:82-84`）。
- 改設定後要重啟伺服器才會生效。

### freely 漏洞修正（`lib/realtime.js` `ifMayEdit()`）
- **問題**：`ifMayEdit()` 遇到 `freely` 筆記時完全不檢查設定，所以關閉匿名之後，**已經存在的 freely 筆記仍然可以被匿名編輯**。這類筆記多半是先前匿名建立、沒有擁有者的，也無法從介面改權限。
- **修正**：在 `allowAnonymous` 和 `allowAnonymousEdits` 都是 false 時，`freely` 比照 `editable` 處理，只有登入的人能編輯。設定允許匿名時，行為和原本一樣。

```js
case 'freely':
  // not blocking anyone, unless anonymous editing is disabled
  if (!config.allowAnonymous && !config.allowAnonymousEdits &&
    (!socket.request.user || !socket.request.user.logged_in)) { mayEdit = false }
  break
```

### 建立帳號
- 指令：`node bin/manage_users --add <email>`（會提示輸入密碼；不建議用 `--pass`，密碼會留在 shell 歷史）。
- 或暫時打開網頁註冊（見 08）。

## 檢測

### 自動檢測：`check.ps1`
| ID | 檢查內容 |
|---|---|
| SEC-1 | `host` 是 127.0.0.1 |
| SEC-2 | 匿名建立、匿名編輯都已關閉 |
| SEC-3 | 網頁註冊的開關和 `功能/_lib/policy.json` 記錄的決定一致（目前：**長期開放**） |
| SEC-4 | sessionSecret 已固定且長度 >= 64 |
| SEC-5 | port 3000 只在 loopback 上監聽 |
| SEC-6 | 從本機的非 loopback IP 連不到伺服器 |
| SEC-7 | 匿名 `GET /new` 會被導走（不能建立筆記） |
| SEC-8 | `POST /register` 依決定：關閉時 404；開放時用無效 email 測試，會被擋下並導回 `/register`，不會建立帳號 |
| SEC-9 | `realtime.js` 的 freely 修正還在 |
| SEC-10 | 資料庫中沒有 freely 筆記（有的話顯示 WARN） |
| SEC-11 | `eslint lib/realtime.js` 通過 |
| SEC-12 | mocha 測試全部通過 |
| SEC-13 | 新筆記預設權限為 private |

### 手動檢測（freely 修正）
1. 先讓瀏覽器離開該筆記並停止伺服器，把一篇測試筆記改成 `freely`。
2. 啟動伺服器，以**未登入**狀態開啟該筆記並打字。
3. 等存檔週期過後查 DB，重新整理頁面：內容應該沒有變。
4. 做完後把權限改回 `editable`。

### 最近一次檢測結果（2026-10-16）
- 自動：13 PASS / 0 WARN / 0 FAIL（註冊已關閉）
- 手動（freely）：匿名的修改沒有被存進去 ✅（修正前同樣的操作會被存進去）

## 錯誤紀錄與處理

| # | 日期 | 現象 | 原因 | 處理方式 | 狀態 |
|---|---|---|---|---|---|
| E1 | 10-16 | 關閉匿名後，舊的 freely 筆記仍可被匿名編輯 | 上游 `ifMayEdit()` 沒有檢查設定 | 先用一次性腳本把 2 篇 freely 筆記改成 `editable`，再修正程式（`ff6b535`），並加入 SEC-9／SEC-10 | ✅ 已處理 |
| E2 | 10-16 | 用 `node -e "..."` 改資料庫時出現 SyntaxError | PowerShell 5.1 傳遞含雙引號的參數給原生程式時，會把引號拆掉 | 改成先把 Node 腳本寫成檔案再執行（`_lib/db-query.js` 也是這樣做的） | ✅ 已處理 |
| E3 | 10-16 | 修正後，匿名者在 freely 筆記上打字不會跳出登入框，只是存不進去 | 前端仍以為 freely 可以編輯 | 10-16（I-4）：`/config` 多輸出 `window.anonymousEdits`；`index.js` 的 `havePermission()` 在關閉匿名時把 freely 視為要登入。被擋時：freely／editable／limited 跳登入框，locked／private／protected 跳鎖定框（上游漏了 limited 與 protected）。瀏覽器實測：訪客打字跳出登入框、輸入被取消（`1f189df`） | ✅ 已處理 |
| E4 | 10-16 | 第一次跑檢測時 SEC-12 誤判 FAIL | 檢測腳本的問題（見 [01 E6](../01-環境建置與啟動/README.md)） | 改用 `Invoke-Native` | ✅ 已處理 |
| E5 | 10-16 | SEC-3、SEC-8 FAIL | hhyn 要求暫時打開網頁註冊 | hhyn 確認註冊完成後，把 `allowEmailRegister` 改回 `false` 並重啟伺服器，重跑檢測：13 PASS | ✅ 已處理 |
| E6 | 10-16 | Code review：註冊開著時，任何能連到 127.0.0.1:3000 的人（本機其他使用者，或透過 DNS rebinding 的網頁）都能註冊，然後編輯所有 `editable` 筆記（原本新筆記的預設權限就是 editable）。`/register` 沒有 CSRF token（上游原本就這樣） | 預設權限＋暫時開放註冊 | 在 `config.json` 加上 `"defaultPermission": "private"`，新筆記預設只有自己能看與編輯（也和 HackMD 的預設「只有我」一致）；新增 SEC-13 檢查。註冊的部分見 E5 | ✅ 已處理（註冊待關） |
| E7 | 10-16 | Code review：`domain` 是 `localhost`，伺服器卻綁在 `127.0.0.1`。從 `http://127.0.0.1:3000` 進入時，表單會送到 `http://localhost:3000`，session 和提示訊息會落在另一個 origin | 上游設定方式，不是這次修改造成的 | 一律用 **http://localhost:3000** 開啟 | ℹ️ 說明 |
| E9 | 10-16 | 為了讓 `localhost` 不再先卡 IPv6（[17 E13](../17-首頁改版/README.md)），伺服器另外在 `[::1]:3000` 收連線並轉送到 127.0.0.1 | 效能修正 | 只聽迴路位址 `::1`，SEC-5（只聽迴路）、SEC-6（外部 IP 連不到）仍然 PASS；`config.json` 的 host 仍是 127.0.0.1（`cf7c729`） | ✅ 已處理 |
| E8 | 10-16 | hhyn 決定**長期開放網頁註冊**（prompt 43） | 需求變更 | 決定寫在 `功能/_lib/policy.json`（`registrationOpen: true`），SEC-3／SEC-8／REG-6 改成「設定與決定一致」才 PASS；以後要關，改 `config.json` 和 policy 兩處。影響：伺服器仍只綁 127.0.0.1（SEC-5／SEC-6），**只有這台電腦能註冊**；新筆記預設「只有我」；`/register` 沒有 CSRF token（上游）與 DNS rebinding 的風險見 E6；GitHub／Google 已移除，所以沒有第三方建帳號的問題 | ✅ 已處理 |
