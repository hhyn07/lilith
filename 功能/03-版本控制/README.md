# 03 版本控制

> 狀態：✅ 完成　｜　一個 repo：專案根目錄（分支 `main`），`hedgedoc-1x/` 在裡面　｜　GitHub：`hhyn07/lilith-notes`（Private）

## 2026-10-16 起：整個專案一個 repo（prompt 132～134）
- hhyn 想把整個專案放進 GitHub 的 `hhyn07/lilith-notes`。原本是兩個 repo：外層（文件）忽略 `hedgedoc-1x/`；`hedgedoc-1x/` 自己是 repo（分支 `hhyn/dev`），而且是**淺層複製**（只有 1.10.8 那一版，沒有 HedgeDoc 的歷史），這種 repo 推不上新的遠端。
- hhyn 選 A（保留完整歷史）：
  1. 備份 `hedgedoc-1x/.git` → `備份/hedgedoc-1x.git-before-merge-20261016`（淺層、18MB）。
  2. 從 HedgeDoc 官方下載 tag `1.10.8` 的完整歷史（`git fetch --unshallow`），共 4611 個 commit，`.git` 18MB → 61MB。
  3. 把 `hedgedoc-1x/.git` 移到 `備份/hedgedoc-1x.git-full-20261016`，在外層 repo 用 subtree merge（`merge -s ours` + `read-tree --prefix=hedgedoc-1x/`）併入 `hhyn/dev`：檔案原地不動、commit 編號不變（下表都查得到）。
  4. 外層 `.gitignore` 拿掉 `/hedgedoc-1x/`（第一次的指令接在一個失敗的指令後面沒有執行，`git add hedgedoc-1x` 才發現；已補上，GIT-1 也檢查新檔案不會被忽略）；`hedgedoc-1x/.gitignore` 照樣排除 `config.json`、資料庫、建置檔。
- 之後所有 commit（程式與文件）都在專案根目錄這一個 repo。HedgeDoc 官方（upstream）不再是 remote；要更新 HedgeDoc 時再另外加。
- 檢查 GIT-1～7 改寫：一個 repo、`main`、非淺層且含 1.10.8、commit 都在、私人檔案沒被追蹤、`origin` 是 `hhyn07/lilith-notes` 且沒有 remote 會推到 HedgeDoc 官方。
- 個人資料：`DEVLOG.md`、`功能/09-歡迎筆記/README.md` 有 hhyn 的 Email；repo 是 Private。將來要公開前要先拿掉。

## 2026-10-17 公開版 `hhyn07/lilith`（prompt 155～157）
- **兩個 repo**：`hhyn07/lilith-notes`（Private，完整歷史，平常開發用）；`hhyn07/lilith`（**Public**，乾淨快照，只有一個 commit）。
- 公開前發現的個人資料：每個 commit 的作者 Email、文件裡的另一個 Email、文件裡的 Windows 使用者路徑。直接公開現有 repo 會把這些和整個歷史一起公開，所以 hhyn 選「另開乾淨的公開 repo」。
- **hhyn 要求：絕對不能有任何 gitleak。** 下載官方 gitleaks v8.30.1（`github.com/gitleaks/gitleaks` 的 Windows zip，比對官方 SHA-256 一致），掃描結果：
  - 第一次 2 個：HedgeDoc 文件 `docs/content/guides/auth/twitter.md` 的範例值（`esTCJFXXX…` 這種很像真金鑰的占位字）→ 改成 `your-twitter-consumer-key`（Private repo 也一起改，`5755a4da`）。
  - 之後**檔案與 git 歷史都是 no leaks found**。
- 公開版做法（**以後更新公開版也照這個順序**）：
  1. `git archive HEAD` 匯出到暫存資料夾（不含 `config.json`、資料庫、備份、`node_modules`——這些本來就沒被追蹤）。
  2. 取代個人資料：文件裡的 Email → 「（使用者的 Email）」、`C:\Users\<Windows 帳號>\` → `C:\Users\<使用者>\`；確認兩把外洩過的 API 金鑰值不存在。
  3. `gitleaks dir` 掃檔案、建立 commit（作者與提交者都用 `hhyn07 <hhyn07@users.noreply.github.com>`）、`gitleaks git` 掃歷史，**兩次都要是 0**。
  4. 確認後推送到 `hhyn07/lilith`。
- 公開版包含 `prompt.txt`、`DEVLOG.md`（hhyn 同意）；只剩 HedgeDoc 原本的 `AUTHORS`／`.mailmap` 有上游貢獻者的 Email（上游本來就公開、授權要求保留）。

## 2026-10-16 以前（兩個 repo 的時期）

## 需求來源
- prompt 7：在 hedgedoc-1x 建立自己的開發分支並 commit。

## 說明
- 所有修改都在 `hhyn/dev` 上，每個功能各自 commit：

| Commit | 內容 | 對應功能 |
|---|---|---|
| `99dc634` | fix(build): Windows 路徑分隔符號 | [02](../02-Windows建置修正/README.md) |
| `ff6b535` | fix(realtime): freely 筆記的匿名編輯漏洞 | [04](../04-安全設定/README.md) |
| `365a522` | feat(ui): Catppuccin 主題 | [05](../05-Catppuccin主題/README.md) |
| `89e9958` | feat(ui): 站名 Lilith、移除 emoji | [07](../07-Lilith品牌/README.md) |
| `9e99bb4` | feat(ui): 分頁標題與導覽列 Lilith | [07](../07-Lilith品牌/README.md) |
| `1a63392` | feat(ui): 參考 Astro Scholar 重做排版 | [06](../06-部落格排版/README.md) |
| `12966d4` | feat(ui): 註冊按鈕放在登入旁邊 | [08](../08-帳號註冊/README.md) |
| `3f7d3e7` | feat: 每個使用者預設一篇歡迎筆記 | [09](../09-歡迎筆記/README.md) |
| `fc22143` | fix: code review 發現（置頂分組、歡迎筆記紀錄） | [06](../06-部落格排版/README.md)、[09](../09-歡迎筆記/README.md) |
| `3ff7cbc` | feat(ui): HackMD 風格的分享對話框 | [11](../11-分享對話框/README.md) |
| `ec4c9c6` | feat(ui): 分享對話框的模式選單（HackMD 樣式） | [11](../11-分享對話框/README.md) |
| `2de695e` | feat: 筆記連結建議；修正閱讀頁頂部太擠 | [12](../12-筆記連結/README.md)、[06](../06-部落格排版/README.md) |
| `d0c211e` | feat: 從使用者選單編輯使用者資料 | [13](../13-使用者資料/README.md) |
| `cd00514` | feat: GitHub 帳號連結；註冊關閉時也擋住第三方建帳號 | [14](../14-第三方登入/README.md) |
| `19034b1` | feat(ui): HackMD 風格的獨立登入頁 | [15](../15-登入頁/README.md) |
| `1f189df` | fix: 訪客置頂清空紀錄；freely 筆記要求訪客登入 | [06](../06-部落格排版/README.md)、[04](../04-安全設定/README.md) |
| `af4922f` | feat(ui): 簡報主題、Lilith 圖示、中文標語等 | [05](../05-Catppuccin主題/README.md)、[07](../07-Lilith品牌/README.md) |
| `9fb04cc` | feat(ui): HackMD 風格的獨立註冊頁 | [16](../16-註冊頁/README.md) |
| `15307b3` | revert: 移除 GitHub 帳號連結；新增服務條款 | [14](../14-第三方登入/README.md)、[16](../16-註冊頁/README.md) |
| `f555aba` | feat(ui): Astro 風格首頁＋最近公開的筆記 | [17](../17-首頁改版/README.md) |
| `de13313` | fix(ui): 首頁圖示跟隨主題、名字只出現一次 | [17](../17-首頁改版/README.md) |
| `d12c0e1` | feat(ui): Blowfish 首頁、Stack 卡片與側欄 | [17](../17-首頁改版/README.md) |
| `9e9d1d1` | feat(ui): 首頁隨機名言＋打字效果 | [17](../17-首頁改版/README.md) |
| `827c22f` | feat(ui): 加入《命運石之門》名言 | [17](../17-首頁改版/README.md) |
| `a488c66` | feat(ui): 再加三句動漫名言 | [17](../17-首頁改版/README.md) |
| `99546f9` | feat(ui): 名言只留動漫四句 | [17](../17-首頁改版/README.md) |
| `48d9d89` | feat(ui): 名言改用日文字體、拿掉中文翻譯 | [17](../17-首頁改版/README.md) |
| `d77309d` | feat(ui): 名言改用網站自帶的明朝體（Noto Serif JP 精簡版） | [17](../17-首頁改版/README.md) |
| `cd04201` | feat(ui): 魔法少女剪影 Logo | [18](../18-Logo/README.md) |
| `a32be00` | fix(ui): Logo 縮進圓框內並置中 | [18](../18-Logo/README.md) |
| `03f4b2a` | feat(ui): 站名改用 Cormorant Garamond 斜體 | [18](../18-Logo/README.md) |
| `6a5fd1a` | feat(ui): 站名改用 Marcellus | [18](../18-Logo/README.md) |
| `651c4e2` | feat(ui): 卡片統一星空紫；頁尾加大間距 | [17](../17-首頁改版/README.md) |
| `139c774` | feat(ui): 密碼欄的顯示／隱藏眼睛 | [15](../15-登入頁/README.md) |
| `cf7c729` | perf: 主頁刷新不再卡（IPv6 轉送、名言不閃、字體預載） | [17](../17-首頁改版/README.md) |
| `aa00b22` | feat(ui): 目錄靠左、閱讀字體放大、編輯器 Logo | [06](../06-部落格排版/README.md) |
| `b85a786` | feat(ui): 發表頁頂部工具列（編輯／雙欄／檢視） | [06](../06-部落格排版/README.md) |
| `7b525f7` | feat(ui): HackMD 式頂部列、格式工具列、預覽 | [06](../06-部落格排版/README.md) |
| `0425a6f` | feat(ui): 首頁名言每 3 秒輪播 | [17](../17-首頁改版/README.md) |
| `5b68bc7` | fix(ui): 編輯器頂部列物件對齊同一水平 | [06](../06-部落格排版/README.md) |
| `eecda2e` | feat(ui): HackMD 式頭像／⋯ 選單、版本紀錄、左側目錄、公開個人頁 | [19](../19-HackMD參考介面/README.md) |
| `bab9c74` | style(ui): 首頁名言字體縮小 | [17](../17-首頁改版/README.md) |
| `c702aed` | style(ui): 編輯器周邊文字放大 | [06](../06-部落格排版/README.md) |
| `8b87c22` | style(ui): 導覽列目前頁面的點改用 mauve | [17](../17-首頁改版/README.md) |
| `596345c` | feat(ui): 卡片 ⋯ 選單、資料夾、收藏；強調色改粉色 | [20](../20-筆記卡片選單與資料夾/README.md) |
| `1e181c0` | style(ui): 分享按鈕改用較輕的三點圖示 | [11](../11-分享對話框/README.md) |
| `30631a9` | fix(ui): 公開頁面連結可點、空心分享箭頭、資訊列放大 | [19](../19-HackMD參考介面/README.md) |
| `9458ac5` | feat(ui): 發表頁頂部列仿 HackMD | [06](../06-部落格排版/README.md) |
| `0b4c08f` | feat(ui): 編輯器資訊列改成一行（仿 HackMD） | [19](../19-HackMD參考介面/README.md) |
| `751d1cc` | feat: 書本模式（仿 HackMD） | [21](../21-書本模式/README.md) |
| `63021b3` | fix: 書本模式與資訊列的 code review 修正 | [21](../21-書本模式/README.md) |
| `dd14cf7` | feat(ui): 筆記列表仿 HackMD、列表頁字體放大 | [22](../22-筆記列表版面/README.md) |
| `be195b3` | feat: 垃圾桶與我的活動 | [23](../23-垃圾桶與我的活動/README.md) |
| `32dbeca` | feat: 團隊工作區 | [24](../24-團隊工作區/README.md) |
| `56cc3d2` | feat: 書本模式中編輯章節 | [21](../21-書本模式/README.md) |
| `53c73e5` | feat: 通知面板（一般通知／重要通知） | [26](../26-通知/README.md) |
| `2949217` | fix: 書本內編輯換章節不再整頁刷新 | [21](../21-書本模式/README.md) |
| `cbb3368` | style: 全站字體放大約 10% | [05](../05-Catppuccin主題/README.md) |
| `2de0deb` | fix: 書本換章節顯示轉圈圈；首頁功能卡改書本模式、團隊工作區 | [21](../21-書本模式/README.md)、[17](../17-首頁改版/README.md) |
| `bcebc0f` | feat: 書本／筆記圖示，書本卡片開書本模式 | [21](../21-書本模式/README.md) |
| `c3316da` | fix: code review（團隊書本、轉圈、壞連結、讀不到的筆記） | [21](../21-書本模式/README.md) |
| `d41965c2` | fix: code review 修正、頁尾 ©、淺色用 Mocha 重點色 | [完成度報告](../../完成度報告.md)、[05](../05-Catppuccin主題/README.md) |
| `16e08513` | feat: 團隊設定、工作空間選單；fix: 團隊模式 XSS | [28](../28-團隊設定/README.md) |
| `c416a618` | style: 紀錄重新整理顯示轉圈圈 | [22](../22-筆記列表版面/README.md) |
| `dd3cb8c1` | feat: 團隊公開頁（釘選、團隊資料、追蹤、喜歡） | [27](../27-團隊公開頁/README.md) |
| `aebb53b9` | style: 卡片高度一致 | [22](../22-筆記列表版面/README.md) |
| `d47f9003` | style: 卡片封面拿掉標題大字 | [17](../17-首頁改版/README.md) |
| `9236bed8` | style: 工作空間名稱縮小、與模式按鈕留空 | [24](../24-團隊工作區/README.md) |
| `f08d0576` | style: 書本側欄「目錄」 | [21](../21-書本模式/README.md) |
| `d774aa29` | feat: 編輯器左上角顯示工作空間（我的空間／團隊） | [24](../24-團隊工作區/README.md) |
| `58edf31` | 文件＋fix: 書本刷新圖示不轉（同一個 commit） | [21](../21-書本模式/README.md) |
| `cde5e27` | 合併：hedgedoc-1x 併入專案 repo（保留完整歷史） | 本頁 |
| `2e07339` | fix: 書本刷新的旋轉與完成提示 | [21](../21-書本模式/README.md) |
| `7f7fdcb` | style: 權限圖示放標題前、卡片放大 | [22](../22-筆記列表版面/README.md) |
| `8f50808` | style: 卡片排版參考 Blowfish、圖示與標題對齊 | [22](../22-筆記列表版面/README.md) |
| `3fab8bb` | style: 書本側欄工具列（搜尋、刷新、編輯、收合） | [21](../21-書本模式/README.md) |
| `0089cad` | fix: 卡片用目前標題與標籤、YAML 清單標籤、標題旁標籤、Ctrl+S、單一目錄、圖示、頂部列寬度 | [21](../21-書本模式/README.md)、[05](../05-Catppuccin主題/README.md) |

- **不進版控**（上游 `.gitignore` 已忽略）：`config.json`（含 sessionSecret）、`db.hedgedoc.sqlite`、`public/build/`。
- **Commit 訊息**：PowerShell 5.1 傳多行字串給 git 會出問題，一律先寫入檔案再 `git commit -F <檔案>`。
- **遠端**：上游改名為 `upstream`，push 網址設為 `DISABLED-...`（見 E2）。
- **外層專案資料夾**（文件、檢測腳本）是另一個 repo（分支 `main`，沒有遠端），忽略 `hedgedoc-1x/`、`備份/` 和伺服器 log（見 E4）。

## 檢測

### 自動檢測：`check.ps1`
| ID | 檢查內容 |
|---|---|
| GIT-1 | 目前分支是 `hhyn/dev` |
| GIT-2 | 分支以 tag `1.10.8` 為基底 |
| GIT-3 | 上表所有 commit 都在 |
| GIT-4 | `config.json`、資料庫、`public/build/` 都被忽略 |
| GIT-5 | 工作區乾淨（有未 commit 的變更時顯示 WARN） |
| GIT-6 | 上游遠端叫 `upstream`，且 push 網址以 `DISABLED` 開頭 |
| GIT-7 | 外層資料夾是 git repo，忽略 `hedgedoc-1x/`、`備份/`、伺服器 log（有未 commit 的變更時 WARN） |

### 最近一次檢測結果（2026-10-16）
- 6 PASS / 1 WARN / 0 FAIL
- WARN：GIT-7，跑檢測時外層 repo 還有這次的文件變更未 commit（commit 後即 PASS）。

## 錯誤紀錄與處理

| # | 日期 | 現象 | 原因 | 處理方式 | 狀態 |
|---|---|---|---|---|---|
| E1 | 10-16 | `git commit` 失敗，出現大量 `pathspec ... did not match` | PowerShell 5.1 用 here-string 傳多行訊息給原生程式時，會依引號把字串拆成多個參數 | 先把訊息寫進檔案，再用 `git commit -F <檔案>` | ✅ 已處理 |
| E2 | 10-16 | GIT-6 WARN：`origin` 指向上游 HedgeDoc | `git clone` 預設的遠端 | 10-16（I-5）：`git remote rename origin upstream`，並 `git remote set-url --push upstream DISABLED-do-not-push-to-upstream`，fetch 照常、push 一定失敗。GIT-6 改為檢查這兩點。之後要備份可另外加自己的私有遠端 | ✅ 已處理 |
| E3 | 10-16 | git 提示 `LF will be replaced by CRLF` | `core.autocrlf=true`，新檔案用 LF 寫入 | 只是提示，git 會自動轉換，不影響內容 | ℹ️ 說明 |
| E4 | 10-16 | 外層專案資料夾（文件、檢測）沒有版本控制（I-11） | 一開始只在 `hedgedoc-1x` 建 repo | 外層 `git init -b main`、`core.quotepath false`；`.gitignore` 排除 `/hedgedoc-1x/`（自己的 repo）、`/備份/`（資料庫備份）、`/hedgedoc-server.log`。沒有遠端。新增 GIT-7 檢查 | ✅ 已處理 |
