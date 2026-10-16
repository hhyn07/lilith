# 功能索引

每個功能一個資料夾。和該功能有關的說明、實作、檢測、錯誤紀錄與處理方式，都寫在該資料夾的 `README.md`；可以自動檢測的功能另有 `check.ps1`。

| # | 功能 | 狀態 | Commit | 自動檢測 |
|---|---|---|---|---|
| 01 | [環境建置與啟動](01-環境建置與啟動/README.md) | ✅ | — | ENV-1～8 |
| 02 | [Windows 建置修正](02-Windows建置修正/README.md) | ✅ | `99dc634` | WIN-1～4 |
| 03 | [版本控制](03-版本控制/README.md) | ✅ | — | GIT-1～7 |
| 04 | [安全設定](04-安全設定/README.md) | ✅ | `ff6b535` | SEC-1～13 |
| 05 | [Catppuccin 主題](05-Catppuccin主題/README.md) | ✅ | `365a522` `89e9958` | CTP-1～9 |
| 06 | [部落格排版](06-部落格排版/README.md) | ✅ | `365a522` `1a63392` | BLOG-1～9 |
| 07 | [Lilith 品牌](07-Lilith品牌/README.md) | ✅ | `89e9958` `9e99bb4` `12966d4` | BRAND-1～7 |
| 08 | [帳號註冊](08-帳號註冊/README.md) | ✅（註冊長期開放） | `12966d4` | REG-1～6 |
| 09 | [歡迎筆記](09-歡迎筆記/README.md) | ✅ | `3f7d3e7` | WEL-1～5 |
| 10 | [筆記組織與搜尋](10-筆記組織與搜尋/README.md) | 🟡 部分完成（全文搜尋未做） | — | — |
| 11 | [分享對話框](11-分享對話框/README.md) | ✅ | `3ff7cbc` `ec4c9c6` | SHARE-1～10 |
| 12 | [筆記連結建議](12-筆記連結/README.md) | ✅ | `2de695e` | LINK-1～7 |
| 13 | [使用者資料（編輯、登出）](13-使用者資料/README.md) | ✅ | `d0c211e` | PROF-1～9 |
| 14 | [第三方登入與帳號連結](14-第三方登入/README.md) | 🚫 已移除 | `cd00514`、移除 `15307b3` | GH-1～5（確認移除） |
| 15 | [登入頁](15-登入頁/README.md)（含顯示密碼） | ✅ | `19034b1`、`139c774` | LOGIN-1～8 |
| 16 | [註冊頁](16-註冊頁/README.md) | ✅ | `9fb04cc` | SIGNUP-1～5 |
| 17 | [首頁改版（Blowfish＋Stack、名言、星空紫卡片）](17-首頁改版/README.md) | ✅ | `f555aba`、`d12c0e1`、`9e9d1d1`、`651c4e2` 等 | HOME-1～9 |
| 18 | [Logo（魔法少女剪影）與站名字體](18-Logo/README.md) | ✅ | `cd04201`、`a32be00`、`6a5fd1a` | LOGO-1～6 |
| 19 | [HackMD 參考介面（頭像／⋯ 選單、版本紀錄、左側目錄、公開個人頁）](19-HackMD參考介面/README.md) | ✅ | `eecda2e` | HMD-1～7 |
| 20 | [筆記卡片選單與資料夾（⋯ 選單、刪除、副本、標題／標籤、資料夾、收藏、粉色）](20-筆記卡片選單與資料夾/README.md) | ✅ | `596345c` | NOTE-1～7 |
| 21 | [書本模式（目錄筆記→左側章節目錄）](21-書本模式/README.md) | ✅ | `751d1cc` | BOOK-1～7 |
| 22 | [筆記列表版面（標籤側欄、分組、排序、格狀／清單）](22-筆記列表版面/README.md) | ✅ | `dd14cf7` | LIST-1～4 |
| 23 | [垃圾桶與我的活動](23-垃圾桶與我的活動/README.md) | ✅ | `be195b3` | TRASH-1～5 |
| 24 | [團隊工作區（角色、邀請連結、團隊筆記、團隊垃圾桶）](24-團隊工作區/README.md) | ✅ | `32dbeca` | TEAM-1～7 |
| 26 | [通知（鈴鐺、一般通知／重要通知、變更內容）](26-通知/README.md) | ✅ | `53c73e5` | NOTIFY-1～6 |
| 27 | [團隊公開頁（釘選、團隊資料、追蹤、喜歡）](27-團隊公開頁/README.md) | ✅ | `dd3cb8c1` | TP-1～6 |
| 28 | [團隊設定（一般設定、團隊網址、隱私性、團隊筆記、社群、工作空間選單）](28-團隊設定/README.md) | ✅ | `16e08513` `d41965c2` | SET-1～5 |

> 沒有 25 號：書本內編輯原本規劃為 25，後來併入 [21 書本模式](21-書本模式/README.md)（E14 起）。

## 執行檢測
伺服器要先啟動（`hedgedoc-1x` 目錄下 `node app.js`）。

```bash
powershell -ExecutionPolicy Bypass -File 功能/run-all-checks.ps1
```

只跑單一功能：

```bash
powershell -ExecutionPolicy Bypass -File 功能/04-安全設定/check.ps1
```

- 結果：`[PASS]` 通過、`[WARN]` 需要注意但不算失敗、`[FAIL]` 失敗。腳本的 exit code 等於 FAIL 數。
- `-ExecutionPolicy Bypass` 只對這次執行有效，不會改變系統設定。
- 檢測只讀取資料；只有 08／04 會送出 `POST /register`，而且用的是無效 email，不會建立帳號。WEL-1 使用記憶體資料庫。

## 共用工具（`_lib/`）
| 檔案 | 用途 |
|---|---|
| `common.ps1` | `Test-Check`（PASS／WARN／FAIL）、`Invoke-Http`（curl，不跟隨轉址）、`Invoke-Native`（避免 PowerShell 5.1 把 stderr 當例外）、`Get-DevConfig` 等 |
| `db-query.js` | 唯讀查詢 SQLite（只接受 SELECT） |

> 腳本內只用 ASCII 字元：Windows PowerShell 5.1 讀取沒有 BOM 的 UTF-8 腳本時，會用 ANSI 解碼而讓中文變亂碼。

### 寫檢測腳本時踩過的坑（PowerShell 5.1）
- 變數名稱不分大小寫：不要用 `$home`（唯讀的 `$HOME`）、`$body`（會和 `Test-Check` 的 `$Body` 衝突）、`$args`。
- 原生程式寫到 stderr 時，在 `ErrorActionPreference=Stop` 下會變成例外 → 一律用 `Invoke-Native`。
- `ConvertFrom-Json` 會把 JSON 陣列當成一個物件輸出 → 先 `| ForEach-Object { $_ }` 展開再計數。
- 雙引號字串中的 `$(...)` 會被執行 → 含 `$` 的比對字串用單引號。
- `-match`／`-notmatch` 不分大小寫 → 需要時用 `-cmatch`／`-cnotmatch`。

## 錯誤紀錄格式
各功能 README 的「錯誤紀錄與處理」表格欄位：編號、日期、現象、原因、處理方式、狀態（✅ 已處理／⏳ 待處理／⚠️ 已知不處理／ℹ️ 說明）。

## Code review
每次修改都要主動做 code review（hhyn 2026-10-16 的要求）。審查發現的問題記在對應功能的錯誤紀錄裡。
