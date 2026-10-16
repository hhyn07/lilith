# 13 使用者資料（編輯、登出）

> 狀態：✅ 完成　｜　Commit：`d0c211e`　｜　檔案：`lib/web/profileRouter.js`、`app.js`、`public/js/lib/profile.js`、`public/js/cover.js`、`public/views/shared/profile-modal.ejs`、`public/views/index/body.ejs`、`public/css/catppuccin.css`

## 需求來源
- prompt 25：新增「可編輯使用者資料」功能。
- prompt 27：（附首頁右上角使用者選單截圖）編輯使用者功能新增在這裡，並且也可以登出。

## 說明

### 入口
- 首頁右上角的使用者選單，第一項是「**編輯使用者資料**」；原本的「功能簡介、匯出使用者資料、刪除使用者、**登出**」都保留。
- 編輯對話框的左下角也有「**登出**」按鈕。

### 可以編輯的項目
| 欄位 | 規則 |
|---|---|
| 顯示名稱 | 必填，最多 50 字；控制字元會被移除，連續空白合併成一個 |
| E-Mail | 格式要正確，不能和其他帳號重複；**要輸入目前的密碼** |
| 新密碼 | 至少 8 個字元，要輸入兩次（前端比對）；**要輸入目前的密碼**；留空表示不變更 |

- 儲存後，對話框和右上角的名稱、頭像會立即更新。
- 沒有密碼的帳號（第三方登入）不顯示 E-Mail／密碼欄位。

### 資料怎麼存
- Email 帳號原本沒有 `profile`，名稱是由 email 推算的。編輯後會存成 `profile` JSON：`{ provider: 'email', displayName, username, emails }`。頭像的算法和原本一樣（都是用 email 算），所以頭像不會變，只有名稱改變。
- 第三方登入（Google、GitHub……）的帳號：只覆寫 `displayName`。這些平台每次登入都會用自己的資料覆寫 `profile`，所以名稱可能被改回去，對話框裡會顯示提示。
- 名稱照輸入的原樣儲存；所有顯示的地方都經過上游的 `User.getProfile → filterXSS` 消毒。

### API（`lib/web/profileRouter.js`）
| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/api/lilith/me` | 回傳 `{ email, displayName, photo, hasPassword, provider }`（不含密碼） |
| POST | `/api/lilith/me` | body `{ displayName?, email?, newPassword?, currentPassword? }` |

- 兩者都要登入，未登入回 401（JSON，不轉址）。
- POST 只接受 `application/json`（415），防止 CSRF。
- POST 套用登入端點的頻率限制（5 分鐘 10 次），防止暴力猜「目前的密碼」。
- 錯誤碼：沒填目前的密碼 400、密碼錯誤 403、email 已被使用 409、格式或長度錯誤 400。

### 大頭貼（2026-10-16 確認）
- 依登入信箱產生：把信箱轉小寫後取 MD5，向 Libravatar（`cdn.libravatar.org/avatar/<雜湊>?default=identicon`）取圖；信箱在 Libravatar 沒有設定頭像時，顯示依雜湊產生的幾何圖案（`lib/letter-avatars.js`，`allowGravatar` 預設開啟）。
- 瀏覽器會向 Libravatar 送出信箱的 MD5 雜湊（不是信箱本身）。
- hhyn 決定**維持現狀**（prompt 84）。若要改成完全本機產生的字母頭像，在 `config.json` 設 `"allowGravatar": false` 即可。

## 檢測

### 自動檢測：`check.ps1`
| ID | 檢查內容 |
|---|---|
| PROF-1 | 使用者選單有「編輯使用者資料」，也還有「登出」 |
| PROF-2 | 對話框有登出按鈕 |
| PROF-3 | 未登入時 GET、POST 都回 401 |
| PROF-4 | 改 E-Mail／密碼時會驗證目前的密碼 |
| PROF-5 | POST 只收 JSON，並有頻率限制 |
| PROF-6 | 回應不含密碼 |
| PROF-7 | eslint 通過 |
| PROF-8 | 首頁打包檔包含此功能，且比原始碼新 |
| PROF-9 | 對話框中 `[hidden]` 會蓋過 Bootstrap 的 display（E1 的防回歸） |

### 手動檢測（瀏覽器，2026-10-16）
用**臨時測試帳號**測試，測完已刪除帳號、筆記和密碼檔，並確認沒有殘留；hhyn 的帳號沒有被動到。

| 步驟 | 結果 |
|---|---|
| 使用者選單 | 編輯使用者資料／功能簡介／匯出使用者資料／刪除使用者／登出 ✅ |
| 開啟對話框 | 帶入名稱、E-Mail、頭像 ✅ |
| 表單格式 POST | 415 ✅ |
| 名稱含 `<img src=x onerror=alert(1)>` | 經 filterXSS 變成無害文字 ✅ |
| 改 E-Mail 沒填目前的密碼 | 400「請輸入目前的密碼」✅ |
| 目前的密碼錯誤 | 403 ✅ |
| 改成 hhyn 的 E-Mail | 409「這個 E-Mail 已經被使用」✅（沒有變更任何資料） |
| 新密碼太短 | 400 ✅ |
| 改密碼 | 200；之後用舊密碼驗證失敗（403）、新密碼成功 ✅ |
| 改 E-Mail | 200，頭像依新 email 更新 ✅ |
| 在對話框改名稱並儲存 | 顯示「已儲存」，右上角名稱立刻更新，`/me` 也回傳新名稱 ✅ |
| 對話框的「登出」 | 回到首頁，`/me` 為未登入 ✅ |

### 最近一次檢測結果（2026-10-16）
- 自動：9 PASS / 0 WARN / 0 FAIL

## 錯誤紀錄與處理

| # | 日期 | 現象 | 原因 | 處理方式 | 狀態 |
|---|---|---|---|---|---|
| E1 | 10-16 | Email 帳號也顯示「這個帳號由第三方登入……」的提示 | Bootstrap 的 `.help-block { display: block }` 蓋過了 `hidden` 屬性 | 在分享、使用者資料兩個對話框內加上 `[hidden] { display: none !important }`；PROF-9 會檢查 | ✅ 已處理 |
| E2 | 10-16 | 沒填目前的密碼時，訊息是「目前的密碼不正確」 | 沒有區分「沒填」和「填錯」 | 沒填回 400「請輸入目前的密碼」，填錯才回 403 | ✅ 已處理 |
| E3 | 10-16 | 刪除測試帳號的腳本找不到帳號 | 測試時把測試帳號的 email 改掉了 | 刪除腳本改成比對 `lilith-ui-test%@example.com` | ✅ 已處理 |
| E4 | 10-16 | 檢測 PROF-1 報錯：ScriptBlock 沒有 Contains 方法 | 變數 `$body` 和 `Test-Check` 的參數 `$Body` 衝突（PowerShell 變數不分大小寫） | 改名為 `$indexBody` | ✅ 已處理 |
| E5 | 10-16 | 檢測 PROF-6 誤判 | `-notmatch 'password:'` 不分大小寫，會比對到 `hasPassword:` | 改用 `-cnotmatch '\bpassword:'` | ✅ 已處理 |
| E6 | 10-16 | Code review：email 唯一性是「先查再寫」，兩個請求同時送出時理論上可能都通過 | 沒有資料庫唯一約束 | 單人實例不會發生，暫不處理 | ⚠️ 已知 |
| E7 | 10-16 | 第三方登入的帳號改名後，下次登入可能被覆寫 | 上游每次登入都更新 `profile` | 對話框顯示提示；要完整支援需要另外的欄位 | ⚠️ 已知 |
| E9 | 10-16 | 「已連結的帳號」區塊移除 | GitHub 連結功能移除（[14](../14-第三方登入/README.md)） | 對話框、API（`identities`／`linkable`、解除連結）一併刪除，前端重新打包（`15307b3`） | ✅ 已處理 |
| E8 | 10-16 | 改密碼的規則和新的註冊頁不一致（只要求 8 個字） | 註冊頁採用 HackMD 的規則 | 共用 `lib/web/accountRules.js`：8～128 字，含大小寫字母與數字；新密碼欄位下方顯示規則（[16](../16-註冊頁/README.md)，`9fb04cc`） | ✅ 已處理 |
