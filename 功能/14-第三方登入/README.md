# 14 第三方登入（GitHub）與帳號連結

> **🚫 已移除（2026-10-16，prompt 40–41）**：hhyn 決定 GitHub、Google 都不要了，並選擇「整個移除」。Commit `15307b3`：
> - 刪除 `lib/web/auth/linking.js`、`lib/models/userIdentity.js`、解除連結的 API，以及「編輯使用者資料」中的「已連結的帳號」區塊。
> - `lib/web/auth/github/index.js` 還原成上游 1.10.8 的檔案（沒有金鑰就不會載入）。
> - `config.json` 的空白 `github` 欄位刪除。
> - 資料表 `UserIdentities` **保留**：它的 migration 已在正式資料庫執行過，移除時是空的（0 筆），現在不再使用。
> - Google 連結原本正要實作，hhyn 中途喊停，檔案沒有寫入。
> - 注意：如果之後又在 `config.json` 填了任何第三方金鑰，會回到**上游**行為：註冊關閉也擋不住第三方建帳號（原本 E 方案 B 處理的問題）。
> - 檢測 `check.ps1` 改成確認移除完整（GH-1～5），`test-linking.js` 刪除。
>
> 以下是移除前的紀錄，保留作為歷史。


> 狀態：✅ 方案 B 已實作並以記憶體資料庫測試；🔧 真實的 GitHub 登入等 hhyn 填入金鑰後測試　｜　Commit：`cd00514`　｜　檔案：`lib/migrations/20261016120000-lilith-user-identities.js`、`lib/models/userIdentity.js`、`lib/web/auth/linking.js`、`lib/web/auth/github/index.js`、`lib/web/profileRouter.js`、`public/js/lib/profile.js`、`public/views/shared/profile-modal.ejs`

## 需求來源
- prompt 22：登入能加入 Google／GitHub／Facebook，並和帳號連結。
- prompt 28：先做 GitHub 登入（hhyn 自己申請金鑰），並評估帳號連結要怎麼做。
- prompt 29：實作方案 B：登入後在編輯使用者資料中連結 GitHub；未連結的第三方帳號在註冊關閉時不能建帳號；先用記憶體資料庫測試，拿到金鑰後再做真實測試。

## 〇、方案 B 實作摘要（2026-10-16）
- **資料表** `UserIdentities`（migration `20261016120000`）：`userId`、`provider`、`providerUserId`、`profile`；`(provider, providerUserId)` 唯一；刪除使用者時一併刪除（model 的 `afterDestroy`）。
- **OAuth callback**（`lib/web/auth/linking.js` 的 `resolveLogin`），依序判斷：
  1. 已連結 → 登入連結的帳號。
  2. 已登入者按「連結」發起（session 標記、同一個使用者、10 分鐘內）→ 連結到目前帳號；已被別人連結則拒絕。
  3. 上游舊版建立的帳號（`profileid` 相同）→ 照舊登入並補上連結紀錄。
  4. 其他情況 → `allowOAuthRegister`（預設跟 `allowEmailRegister` 一樣，目前是**關閉**）允許才建新帳號，否則拒絕並顯示「這個 GitHub 帳號尚未連結。請先用 E-Mail 登入，再到『編輯使用者資料』連結。」
- **GitHub 路由**：改用這個 callback（`passReqToCallback: true`），並新增 `GET /auth/github/link`（未登入時回首頁）。
- **編輯使用者資料**多了「已連結的帳號」：列出已設定金鑰的平台和既有的連結；［連結］導向 `/auth/github/link`，［解除連結］呼叫 `DELETE /api/lilith/me/identities/github`。解除時至少要保留一種登入方式；上游舊帳號會一併清掉 `profileid`，避免下次登入又被自動連回去。
- **尚未改**：Google、Facebook 等其他平台仍用上游的 callback（目前沒有金鑰、不會啟用）；之後新增時要一起換掉（GH-9 會在它們被啟用時提出警告）。
- **資料庫備份**：重啟套用 migration 前，已把資料庫備份到 `備份/db.hedgedoc.sqlite.bak-20261016-before-identities`（放在 repo 外）。

### 拿到金鑰後的真實測試步驟
1. 依「一、申請步驟」填入金鑰並重啟，跑 `check.ps1`：GH-1、GH-3 變成 PASS，GH-8 變成「未登入時回首頁」。
2. 先**登出**，到登入頁（`/login`）按「透過 GitHub 登入」→ 應該被拒絕，回到登入頁並顯示「這個 GitHub 帳號尚未連結……」（[15](../15-登入頁/README.md) 之後改為回登入頁），而且**不會**多出新使用者。
3. 用 E-Mail 登入 →「編輯使用者資料」→ GitHub［連結］→ GitHub 授權 → 回到首頁；再開對話框應顯示「已連結：你的 GitHub 帳號」。
4. 登出 → 「透過 GitHub 登入」→ 應該進入**同一個** E-Mail 帳號（筆記都在）。
5. （可選）［解除連結］後再用 GitHub 登入 → 又會被拒絕。

## 一、GitHub 登入

### 上游已內建（2026-10-16 讀碼查證）
- 在 `config.json` 填 `github.clientID`、`github.clientSecret`（或設環境變數 `CMD_GITHUB_CLIENTID`、`CMD_GITHUB_CLIENTSECRET`）。**兩者都有值**才會啟用（`lib/config/index.js:124`）。
- callback：`<serverURL>/auth/github/callback`（`lib/web/auth/github/index.js:15`），已開啟 PKCE 與 state 驗證（`:16-17`）。
- 啟用後，登入框會自動出現「透過 GitHub 登入」（`shared/signin-modal.ejs:21-25`）。
- 另外也會啟用「匯出到 GitHub Gist」功能（同一組金鑰）。

### 申請步驟（hhyn 執行）
1. GitHub → Settings → Developer settings → **OAuth Apps** → **New OAuth App**。
2. 填寫：

   | 欄位 | 值 |
   |---|---|
   | Application name | `Lilith (local)`（隨意） |
   | Homepage URL | `http://localhost:3000` |
   | Authorization callback URL | `http://localhost:3000/auth/github/callback` |

3. 建立後複製 **Client ID**，再按 **Generate a new client secret** 複製 Client secret（只會顯示一次）。
4. 填進 `hedgedoc-1x/config.json` 的 `development.github`（我已經放好空白欄位；這個檔案不進版控）：
   ```json
   "github": {
       "clientID": "你的 Client ID",
       "clientSecret": "你的 Client secret"
   }
   ```
5. 重啟伺服器，執行 `功能/14-第三方登入/check.ps1`：GH-1、GH-3 應該變成 PASS。

### 注意事項
- **一律用 `http://localhost:3000` 開啟網站**，不要用 `127.0.0.1`。OAuth 的 state 存在 session cookie 裡，從不同的主機名稱回來，cookie 對不上就會登入失敗（`domain` 設定是 `localhost`，見 [04 E7](../04-安全設定/README.md)）。
- GitHub 對 localhost callback 的規則：我查到的官方文件是 **Enterprise Server 3.0 的舊版本**，內容提到 localhost 網址的 port 可以不同。github.com 現行文件我沒有直接讀到，⚠️ **申請時若被拒絕，請告訴我錯誤訊息**。
  - [Authorizing OAuth apps（GitHub Docs，Enterprise Server 3.0）](https://docs.github.com/en/enterprise-server@3.0/developers/apps/building-oauth-apps/authorizing-oauth-apps)
  - [github/docs issue #13651（localhost 與 127.0.0.1 的討論）](https://github.com/github/docs/issues/13651)

## 二、上游的問題（啟用前要知道）

`passportGeneralCallback`（`lib/web/auth/utils.js:6-46`）的行為：

1. 用 GitHub 的數字 id 當 `profileid`，`findOrCreate` **另建一個新使用者**。和 hhyn 的 Email 帳號沒有任何關係：筆記、紀錄、名稱都分開。
2. **`allowEmailRegister: false` 擋不住它**：任何能連到這台伺服器的 GitHub 帳號，第一次登入都會自動建立使用者（檢測 GH-5 的 WARN）。目前只綁 127.0.0.1，所以實際風險很低，但和「關閉註冊」的本意不符。
3. 每次登入都用 GitHub 的資料覆寫 `profile`（所以名稱會被改回去，見 [13 E7](../13-使用者資料/README.md)）。
4. `profileid` 沒有加上平台前綴，不同平台的使用者 id 理論上可能撞號（例如某個 GitHub id 剛好等於某個 Google id）。

## 三、帳號連結評估

| 方案 | 做法 | 優點 | 缺點／風險 |
|---|---|---|---|
| A. 依 email 自動合併 | GitHub 登入時，若 GitHub 的 email 和現有帳號相同，就登入那個帳號 | 不用操作 | **帳號被盜風險**：passport-github 預設不要求 `user:email` 權限，也不檢查 email 是否已驗證；email 可能是私密的而拿不到。不建議 |
| **B. 登入後手動連結（建議）** | 先用 Email 登入 → 在「編輯使用者資料」按「連結 GitHub」→ 到 GitHub 授權 → 回來後記錄「這個 GitHub id 屬於這個帳號」。之後用 GitHub 登入就直接進同一個帳號 | 安全（只有已登入的本人能連結）；HackMD、HedgeDoc 2 都是這種模式；同一個帳號可以連多個平台 | 要新增資料表與 migration、改 OAuth callback、加介面；工作量中等 |
| C. 維持上游 | 不連結，GitHub 是另一個帳號 | 不用改程式 | 兩套筆記分開，不符合需求 |

### 方案 B 的設計草案
- **資料表** `UserIdentities`（新 migration）：`id`、`userId`、`provider`（`github`…）、`providerUserId`、`profile`、`createdAt`；`(provider, providerUserId)` 唯一。
- **OAuth callback** 的判斷順序：
  1. 有連結紀錄 → 登入連結的帳號。
  2. 這次是「連結」流程（已登入，且 session 中有連結標記）→ 新增連結紀錄，回到原帳號。
  3. 上游舊資料（已有 `profileid` 相同的使用者）→ 照舊登入，相容舊帳號。
  4. 都不是 → 若允許第三方註冊（新設定 `allowOAuthRegister`，預設跟 `allowEmailRegister` 一樣，也就是**關閉**）才建立新帳號，否則顯示「這個 GitHub 帳號尚未連結」並回首頁。**這也一併修掉第二節第 2 點的漏洞。**
- **介面**：「編輯使用者資料」加上「已連結的帳號」區塊：GitHub［連結］／［解除連結］。解除前要確認至少還留有一種登入方式（密碼或其他已連結的平台）。
- **安全**：連結一定要在已登入時主動發起；沿用上游已開的 OAuth `state`／PKCE 防 CSRF；連結標記只放在 server 端 session。
- **檢測**：用記憶體資料庫測 callback 的四條路徑（不需要真的連到 GitHub）；拿到金鑰後再做一次真實的瀏覽器測試。
- **之後加 Google／Facebook**：同一套流程，只要多一個 provider。

## 檢測

### 自動檢測：`check.ps1`
| ID | 檢查內容 |
|---|---|
| GH-1 | `config.json` 有 github 區段且兩個金鑰都有值（沒有值時 WARN） |
| GH-2 | 登入框只有在啟用時才顯示 GitHub 按鈕 |
| GH-3 | `/auth/github` 轉址到 GitHub，且 `redirect_uri` 是 localhost 的 callback（沒有金鑰時略過） |
| GH-4 | 伺服器網址是 `http://localhost:3000` |
| GH-5 | GitHub 使用連結用的 callback（註冊關閉時也擋住第三方建帳號） |
| GH-6 | 整合測試 `test-linking.js`（記憶體資料庫，13 個案例，見下） |
| GH-7 | 真實資料庫已套用 migration（唯一索引存在） |
| GH-8 | `/auth/github/link` 只在啟用時存在；未登入時回首頁 |
| GH-9 | 其他平台若被啟用但還沒換成連結用的 callback 會 WARN |

### 整合測試案例（`test-linking.js`）
不連到 GitHub，直接把假的 OAuth profile 交給 callback（passport 實際交給 callback 的也就是這份資料）：

| 案例 | 預期 |
|---|---|
| 註冊關閉時，陌生的 GitHub 帳號登入 | 拒絕，使用者數不變 |
| 已登入者發起連結 | 建立連結紀錄、回到原帳號、清掉 session 標記 |
| 之後用 GitHub 登入 | 進入連結的帳號 |
| 同一個 GitHub 帳號連到第二個人 | 拒絕，連結紀錄仍只有 1 筆 |
| 連結標記超過 10 分鐘 | 視為一般登入（被拒絕） |
| 連結標記屬於另一個使用者 | 視為一般登入（被拒絕） |
| 上游舊帳號（`profileid`） | 照舊登入並補上連結紀錄 |
| 允許第三方註冊時 | 建立新帳號並連結 |
| `allowOAuthRegister` 預設值 | 跟 `allowEmailRegister` 一樣；明確設定時以它為準 |
| 有密碼的帳號解除連結 | 允許 |
| 沒有密碼、只有這個連結的帳號 | 不允許解除 |
| 刪除使用者 | 連結紀錄一起刪除 |

### 手動檢測（瀏覽器，2026-10-16，臨時測試帳號，測完已刪除）
- 在資料庫插入一筆模擬的 GitHub 連結 → 對話框顯示「GitHub　已連結：lilith-ui-test-gh　［解除連結］」✅（就算沒有金鑰也看得到，才能解除）
- 按［解除連結］→「已解除連結」，該列消失並出現空白提示；再刪一次回 404 ✅
- 沒有金鑰時 `GET /auth/github/link` 回 404 ✅
- 重啟後 migration 成功，hhyn 的資料完整（1 位使用者、6 篇筆記）✅

### 最近一次檢測結果（2026-10-16）
- 7 PASS / 2 WARN / 0 FAIL（WARN 是還沒有金鑰：GH-1、GH-3）
- mocha 15 項通過

## 錯誤紀錄與處理

| # | 日期 | 現象 | 原因 | 處理方式 | 狀態 |
|---|---|---|---|---|---|
| E1 | 10-16 | 關閉註冊後，第三方登入仍可自動建立帳號 | 上游 `passportGeneralCallback` 不看 `allowEmailRegister` | GitHub 改用新的 callback，註冊關閉時拒絕（`cd00514`）；GH-5、GH-6 會檢查。其他平台啟用前也要換（GH-9） | ✅ 已處理（GitHub） |
| E3 | 10-16 | 整合測試第一次有 5 項失敗：註冊明明「關閉」卻建立了新帳號 | HedgeDoc 的設定物件被 `deep-freeze` 凍結（`lib/config/index.js:215`），測試裡的 `config.allowOAuthRegister = false` 完全沒有生效 | `resolveLogin` 增加 `options.allowRegister` 參數，規則抽成純函式 `registrationAllowed(cfg)`；測試改傳參數，13 項全過 | ✅ 已處理 |
| E4 | 10-16 | 資料庫備份檔一開始放在 repo 裡，而且沒被 git 忽略 | `.gitignore` 只忽略 `db.hedgedoc.sqlite` 本身 | 移到 repo 外的 `備份/` 資料夾 | ✅ 已處理 |
| E2 | 10-16 | GitHub localhost callback 的規則只查到舊版文件 | 搜尋結果沒有 github.com 現行文件 | 申請時若被拒，記錄錯誤訊息再處理 | ⚠️ 待確認 |
