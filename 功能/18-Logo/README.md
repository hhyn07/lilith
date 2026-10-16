# 18 Logo（魔法少女剪影）

> 狀態：✅ 完成　｜　Commit：`cd04201`　｜　檔案：`public/icons/lilith-logo.png`（新）、`public/icons/*.png`、`public/icons/favicon.ico`、`public/views/includes/favicon.ejs`、`public/views/index/body.ejs`、`public/views/login.ejs`、`public/views/register.ejs`、`public/css/catppuccin.css`；刪除 `public/icons/lilith.svg`

## 需求來源
- prompt 59：Logo（主題色的「L」）看不太出來是 Logo，要不要換一個（I-24）。
- prompt 60–67：討論過程（見下方「過程」）。
- prompt 68：hhyn 提供一張魔法少女風的側臉剪影圖，**直接當 Logo**；來源是 **Gemini 生成**。

## 說明

### 圖
- 原圖：`lilith-logo-source.webp`（本資料夾，1024×991，白底）。少女側臉剪影，內有星空與星座線，新月星星蝴蝶結、小翅膀、荷葉領。
- 來源與使用：hhyn 用 Gemini 生成，確認可以使用。
- 先前畫過的候選（A–D 符號、E–G／H–L 剪影、M–Q 參考圖風格、R／S／R2／S2 寫實側臉、T–V 魔法少女）都沒採用；hhyn 提供的參考圖有圖庫浮水印，沒有使用也沒有描圖。

### 製作（`make-logo.py`，Python + Pillow）
```
python 功能/18-Logo/make-logo.py 功能/18-Logo/lilith-logo-source.webp hedgedoc-1x
```
- **去背**：從圖片四邊開始，把「和外面相連的白色」設為透明（容許與白色差 60 以內）。蝴蝶結裡的白線、翅膀的白色是被包住的，所以保留。邊緣 2 px 依明暗計算半透明並把白色「反混色」去掉，避免白邊。
- 裁成正方形，輸出 `lilith-logo.png`（512 px，透明背景）。
- **小圖示**：剪影是深紫色，放在深色分頁列或 Mocha 背景上會看不見，所以全部放在**淡色圓形「月亮」底**（`#f2eef9`）上：favicon 16／32、favicon.ico（16／32／48）、apple-touch 180（圓角方形）、android 192／512、Windows tile 70／144／150／310／310×150。

### 套用
| 位置 | 做法 |
|---|---|
| 首頁主視覺 | 原本的「L」換成 Logo（90 px，置中），放在 136 px 淡色圓盤上（手機 68／104 px），外圈一層淡紫光暈；四種配色下都看得清楚 |
| 導覽列 | 首頁、登入頁、註冊頁的「Lilith」前面加 28 px 小 Logo |
| 瀏覽器分頁、書籤、手機桌面 | 新的 favicon／圖示 |
| 拿掉 | SVG favicon `lilith.svg`（舊的 L，瀏覽器會優先用 SVG）已刪除；`safari-pinned-tab.svg` 不再列在 favicon 清單，但檔案保留，因為上游的「匯出 HTML」還會引用 |

### 站名字體（`03f4b2a`）
- prompt 70–72：hhyn 問「Lilith」要不要換字體 → 排出 6 種候選，hhyn 問推薦哪個 → 推薦 **Cormorant Garamond 斜體**（和明朝體名言、Logo 的古典線條一致；小字仍好讀；Cinzel 系列沒有小寫、Great Vibes 小字難讀）→ hhyn 同意。
- `make-wordmark-font.js` 從 Google Fonts 下載只含「Lilith」字母的 Cormorant Garamond Italic 600（1.4 KB，SIL OFL 1.1），`@font-face "Lilith Wordmark"`，套用到首頁、登入、註冊頁頂部與編輯頁導覽列的站名（25 px）。
- 原本 `.login-brand` 後面還有一條設 20 px 的規則會蓋掉新大小，一併拿掉。

### 改成 Marcellus（`6a5fd1a`）
- prompt 73：hhyn 改選 **5 Marcellus（古典但清爽）**。`make-wordmark-font.js` 改為下載 Marcellus 400 只含「Lilith」的精簡字型（1.3 KB），檔名改成通用的 `wordmark.woff2`，Cormorant 的檔案刪除；站名改為正體、22 px、字距 .04em。

### 編輯器左上角（prompt 80）
- hhyn：「左上角也要加 Logo 圖片」→ 編輯器導覽列的「Lilith」前加 28 px Logo（`aa00b22`）；發表頁新工具列也有（`b85a786`）。

### 紀錄在專案資料夾（prompt 74）
- hhyn：「務必要記得紀錄在資料夾中關於此網站的一切。包含 Logo」。成品原本只在 `hedgedoc-1x`（獨立 repo，外層不追蹤），所以新增 [`品牌資產/`](../../品牌資產/README.md)：Logo 原圖與去背版、所有圖示、所有字體與授權說明，以及**品牌指南**（名稱、Logo 使用規則、字體、顏色、首頁主視覺）。另有 [`網站總覽.md`](../../網站總覽.md)。
- LOGO-6 會比對 `品牌資產/` 的副本和網站實際使用的檔案是否一致，不一致就 FAIL，提醒重新複製。
- 這個要求也寫進長期記憶，之後每次改外觀都會同步更新。

## 檢測

### 自動檢測：`check.ps1`
| ID | 檢查內容 |
|---|---|
| LOGO-1 | Logo 與各尺寸圖示都存在、尺寸正確 |
| LOGO-2 | Logo 背景透明（角落像素 alpha = 0） |
| LOGO-3 | favicon.ico 內含 16、32、48 三種尺寸 |
| LOGO-4 | 首頁主視覺、導覽列、登入頁都有 Logo；favicon 清單不再有 SVG 圖示 |
| LOGO-5 | 站名字體（Marcellus）檔存在、有提供、CSS 有套用 |
| LOGO-6 | `品牌資產/` 的副本與網站使用的檔案一致 |

[07](../07-Lilith品牌/README.md) 的 BRAND-2／BRAND-2b 改成檢查新的 Logo 寫法。

### 手動檢測（2026-10-16）
| 步驟 | 結果 |
|---|---|
| 去背結果疊在深色與淺色背景上看 | 白底完全去掉，蝴蝶結白線、翅膀保留，沒有白邊 ✅ |
| 16／32／70／180 px 圖示 | 32 px 以上認得出側臉與蝴蝶結；16 px 只剩頭部輪廓 ⚠️（E1） |
| 首頁 Mocha／Latte／Frappé | Logo 在淡色圓盤上清楚 ✅ |
| 登入頁導覽列 | 有小 Logo ✅ |
| 圖示網址 | 全部 200 ✅ |

### 最近一次檢測結果（2026-10-16）
- 自動：4 PASS / 0 WARN / 0 FAIL

## 錯誤紀錄與處理

| # | 日期 | 現象 | 原因 | 處理方式 | 狀態 |
|---|---|---|---|---|---|
| E1 | 10-16 | 16 px 的 favicon 只看得出頭部輪廓 | 原圖細節多（星座、翅膀、荷葉領） | 先維持；若要更清楚，可另做只取頭部的簡化小圖 | ⚠️ 已知 |
| E2 | 10-16 | LOGO-4 第一次 FAIL：無法覆寫變數 HOME | 我又把變數取名為 `$home`（同 [08 E4](../08-帳號註冊/README.md)），和 PowerShell 唯讀的 `$HOME` 衝突 | 刪掉那個變數 | ✅ 已處理 |
| E4 | 10-16 | hhyn 回報：圖片超過圓框（翅膀、衣領超出） | 正方形的 Logo 放進圓形，只能佔直徑約 0.7 倍；我原本用 0.82 | 圓形底改用 0.66（首頁 136 px 圓盤內 90 px、手機 104 px 內 68 px），圓形小圖示全部重產；圓角方形的 apple-touch 維持 0.8。用 PIL 合成放大預覽確認四周都有留白、置中（`a32be00`） | ✅ 已處理 |
| E3 | 10-16 | 我自己畫的 SVG 側臉（R、S 等）hhyn 都不滿意，後腦比例也曾畫錯 | 直接寫路徑座標畫人像，精細度有限；一開始沒有先用頭部比例打底 | 改用顱骨圓＋臉三等分打底（R2／S2）；最後採用 hhyn 自己用 Gemini 生成的圖 | ✅ 已處理 |
