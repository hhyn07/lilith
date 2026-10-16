# 09 歡迎筆記

> 狀態：✅ 完成　｜　Commit：`3f7d3e7`　｜　檔案：`lib/welcome.md`、`lib/welcome.js`、`lib/models/user.js`、`bin/welcome_notes`

## 需求來源
- prompt 18：首頁「紀錄」頁，給每個使用者預設一篇歡迎筆記。

## 說明
- **內容**：`lib/welcome.md` 是一份快速上手指南，涵蓋建立筆記、三種檢視模式與快捷鍵、標籤、常用語法、主題切換、權限。第一行有標記 `<!-- lilith:welcome -->`，用來辨識「這是歡迎筆記」。要改內容直接編輯這個檔，只會影響之後新建的使用者。
- **建立規則**（`lib/welcome.js` 的 `ensureWelcomeNote`）：
  - 權限是 **private**，擁有者就是該使用者。
  - 加到該使用者紀錄的**最上方並置頂**，原有紀錄保留。
  - 如果使用者已經有歡迎筆記（依標記判斷）就不建立，所以可以重複執行。
- **新使用者**：`User` 的 `afterCreate` hook 會自動建立。
  - 註冊時，使用者是在交易（`findOrCreate`）裡建立的。SQLite 在交易提交前會鎖住資料庫，所以改成**提交之後**才建立筆記。
  - 建立失敗只會寫 log，不會讓註冊失敗。
- **既有使用者**：`node bin/welcome_notes`（在 `hedgedoc-1x` 目錄執行，**請先停止伺服器**，可以重複執行）。已有歡迎筆記但不在紀錄裡的，會把它加回紀錄並置頂。
  - 2026-10-16 已經對當時唯一的使用者 `（使用者的 Email）` 執行過：建立 1 篇，原有的 2 筆紀錄都保留。

## 檢測

### 自動檢測：`check.ps1`
| ID | 檢查內容 |
|---|---|
| WEL-1 | 整合測試（`test-welcome.js`，使用**記憶體資料庫**，不會動到真實資料）：註冊路徑（交易內）會建立、權限 private、有標記、在紀錄中且置頂、重複執行不會建立第二篇、非交易路徑（如 `manage_users`）也會建立 |
| WEL-2 | 真實資料庫中，每個使用者都有歡迎筆記 |
| WEL-3 | 歡迎筆記都是 private（使用者自己改過時顯示 WARN） |
| WEL-4 | 範本第一行是標記 |
| WEL-5 | `eslint lib/welcome.js lib/models/user.js` 通過 |

另外，mocha 測試（[04](../04-安全設定/README.md) SEC-12）建立使用者時也會觸發這個 hook，15 項全數通過。

### 最近一次檢測結果（2026-10-16）
- 自動：5 PASS / 0 WARN / 0 FAIL
- 手動：預覽瀏覽器沒有登入 hhyn 的帳號，所以無法看到 hhyn 的紀錄列表；改以資料庫確認紀錄 JSON 的第一筆是置頂的「歡迎來到 Lilith」。**hhyn 重新整理首頁即可看到。**

## 錯誤紀錄與處理

| # | 日期 | 現象 | 原因 | 處理方式 | 狀態 |
|---|---|---|---|---|---|
| E1 | 10-16 | （設計時預防）註冊時在 hook 裡直接寫入其他資料表，SQLite 可能等待交易的鎖而卡住 | `findOrCreate` 在交易中建立使用者 | 有交易時改用 `transaction.afterCommit()`；WEL-1 會測試這條路徑 | ✅ 已處理 |
| E2 | 10-16 | （開發時發現）`models.Sequelize.Op` 是 undefined | hook 傳入的 `sequelize.models` 只是模型集合，沒有 `Sequelize` | 在 `welcome.js` 直接 `require('sequelize').Op` | ✅ 已處理 |
| E4 | 10-16 | Code review：伺服器運作中執行 `bin/welcome_notes` 時，若同時有人在編輯筆記，即時存檔的 `updateHistory` 可能蓋掉剛加入的歡迎紀錄；而且舊版再執行一次也不會補回（筆記已存在就跳過） | `users.history` 是整包 JSON，讀取、修改、寫回時都沒有鎖（上游設計） | `ensureWelcomeNote` 改成：筆記已存在但不在紀錄裡時，把它加回紀錄並置頂；腳本開頭註明要先停止伺服器；WEL-1 新增 `repairs_history` 測試（`fc22143`）。取捨：使用者若是**故意**把歡迎筆記從紀錄移除，再執行腳本會被加回來 | ✅ 已處理 |
| E3 | 10-16 | WEL-2 誤判 FAIL（「missing for:」後面是空的） | 檢測腳本的問題：PowerShell 5.1 的 `ConvertFrom-Json` 把空陣列當成一個物件輸出，外面包 `@()` 後數量變成 1 | 先展開再計數：`@((... | ConvertFrom-Json) | ForEach-Object { $_ })` | ✅ 已處理 |
