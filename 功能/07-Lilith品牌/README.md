# 07 Lilith 品牌

> 狀態：✅ 完成　｜　Commit：`89e9958`、`9e99bb4`、`12966d4`（簡介標題）

## 需求來源
- prompt 11：「hhyn 的筆記」改成其他名字，不要 emoji。討論過程：中二 → 英文 → 英文人名 → 女生名 → 選定 **Lilith**。
- prompt 12：瀏覽器分頁標題和導覽列的 HedgeDoc logo 也改成 Lilith。

## 說明
| 位置 | 修改 |
|---|---|
| 首頁站名 | `index/body.ejs` 的 `masthead-brand` → `Lilith` |
| 首頁簡介 | HedgeDoc 大 logo → `<h1>Lilith</h1>`（原 logo 的白色文字在 Latte 淺色下看不見） |
| 分頁標題（伺服器） | `lib/models/note.js` `Note.generateWebTitle` → `<筆記標題> - Lilith`，沒有標題時為 `Lilith` |
| 分頁標題（前端） | `public/js/extra.js` `renderTitle`（在打包檔內，**改了要重新 build**） |
| 首頁標題 | `index/head.ejs` 的 `<title>`、`og:title` |
| App 名稱 | `includes/favicon.ejs` 的 `apple-mobile-web-app-title`、`application-name` |
| 編輯頁導覽列 | `hedgedoc/header.ejs`：HedgeDoc banner 圖片 → 文字標誌 `Lilith` |

**尚未更改**：favicon 圖示、簡介的英文標語「Ideas grow better together」、頁尾的「由 HedgeDoc 強力驅動」（AGPL 授權下保留出處是好習慣）。

## 檢測

### 自動檢測：`check.ps1`
| ID | 檢查內容 |
|---|---|
| BRAND-1 | 首頁 `<title>` 是 Lilith |
| BRAND-2 | 首頁站名是 Lilith |
| BRAND-2b | 簡介用 Logo（[18](../18-Logo/README.md)），標題是隨機名言（I-23）或標語（[17 E5](../17-首頁改版/README.md) 之後名字只在導覽列），不再有 HedgeDoc banner |
| BRAND-3 | 筆記頁（編輯網址與 `/s/` 發表頁）的標題以 ` - Lilith` 結尾 |
| BRAND-4 | 原始碼中產生標題的地方不再加 ` - HedgeDoc` |
| BRAND-5 | 打包檔已包含新的前端標題（有重新 build） |
| BRAND-6 | 編輯頁導覽列是 Lilith 文字標誌 |
| BRAND-7 | App 名稱 meta 是 Lilith |

### 最近一次檢測結果（2026-10-16）
- 自動：8 PASS / 0 WARN / 0 FAIL

## 錯誤紀錄與處理

| # | 日期 | 現象 | 原因 | 處理方式 | 狀態 |
|---|---|---|---|---|---|
| E1 | 10-16 | 用 curl 檢查時，筆記頁標題「含有 HedgeDoc」 | 測試筆記的標題本身就有「HedgeDoc」這個字，不是後綴沒改到 | 檢測改成判斷「是否以 ` - Lilith` 結尾」（BRAND-3） | ✅ 已處理 |
| E2 | 10-16 | Latte 下簡介的 HedgeDoc logo 文字看不見 | logo 的文字是白色 | 換成文字標題 Lilith（BRAND-2b） | ✅ 已處理 |
| E3 | 10-16 | favicon 仍是 HedgeDoc 圖示（I-7） | 沒有換 `public/icons` | 用 System.Drawing 重畫所有 PNG（Mocha `#1e1e2e` 圓角方塊＋mauve `#cba6f7`「L」），favicon.ico 含 16／32／48 三張；新增 `lilith.svg` 並放在 favicon 清單第一個；manifest、browserconfig、theme-color 改為 Lilith 與 `#1e1e2e`（`af4922f`） | ✅ 已處理 |
| E4 | 10-16 | 簡介標語仍是英文（I-8） | 上游文字 | 首頁 lead、meta description、og:description 改為「記下一切，封存於此。」，文字是我擬的，hhyn 可再換（`af4922f`） | ✅ 已處理 |
