# Lilith 品牌指南

> 這個資料夾保存網站外觀的**成品**（Logo、圖示、字體）與使用規則。網站實際使用的檔案在 `hedgedoc-1x/public/`，這裡是副本；[18 LOGO-6](../功能/18-Logo/README.md) 會檢查兩邊是否一致。
> 最後更新：2026-10-16

## 名稱
- **Lilith**（莉莉絲）：猶太傳說中亞當的第一任妻子，常被視為獨立、不受支配的象徵，也和「夜晚」連結。選名過程見 [07](../功能/07-Lilith品牌/README.md)。
- 站名只出現在導覽列（左上角），首頁主視覺不再重複。

## Logo
| 檔案 | 用途 |
|---|---|
| `logo/lilith-logo-source.webp` | 原圖（hhyn 用 **Gemini** 生成，1024×991，白底） |
| `logo/lilith-logo.png` | 去背後的 Logo（512 px，透明背景） |
| `icons/` | favicon（16／32、`favicon.ico` 含 16／32／48）、apple-touch 180、android 192／512、Windows tile 70／144／150／310／310×150、`site.webmanifest`、`browserconfig.xml` |

- 內容：魔法少女風的少女側臉剪影（臉朝左），剪影內是星空與星座線，新月星星蝴蝶結、小翅膀、荷葉領。
- **使用規則**：剪影是深紫色，**一律放在淡色圓盤 `#f2eef9` 上**（深色主題才看得見）；Logo 寬度約為圓盤直徑的 **0.66 倍**，置中（再大會超出圓框）。圓角方形（apple-touch）可放到 0.8 倍。
- 製作方式（可重做）：`python 功能/18-Logo/make-logo.py 品牌資產/logo/lilith-logo-source.webp hedgedoc-1x`。去背只去掉和外框相連的白色，所以蝴蝶結白線、翅膀會保留。
- 已知限制：16 px 只看得出頭部輪廓。
- 選定過程：A–D 符號、E–V 多種自畫剪影都沒採用，最後用 hhyn 提供的圖。詳見 [18](../功能/18-Logo/README.md)。

## 字體
| 用途 | 字體 | 檔案 | 授權 |
|---|---|---|---|
| 站名「Lilith」 | **Marcellus** 400（古典但清爽） | `fonts/wordmark.woff2`（只含 L、i、t、h，1.3 KB） | SIL OFL 1.1 |
| 首頁日文名言 | **Noto Serif JP** 600（明朝體） | `fonts/noto-serif-jp-quotes.woff2`（只含四句的 45 個字） | SIL OFL 1.1 |
| 內文 | **DM Sans**（可變字重） | `fonts/dmsans-latin*.woff2` | SIL OFL |
| 程式碼 | **Lilex**（可變字重） | `fonts/lilex.woff2` | SIL OFL 1.1 |

- 中文沒有另外載入字體，依序使用系統上有的 Noto Sans TC → 蘋方（PingFang TC）→ 微軟正黑體（字體清單在 `catppuccin.css` 的 `--ctp-font-sans`）；一般 Windows 沒裝 Noto Sans TC 時會是微軟正黑體。
- 精簡字型只含特定字：**改站名或新增日文名言後，要重跑** `功能/18-Logo/make-wordmark-font.js` 或 `功能/17-首頁改版/make-quote-font.js`，否則新字會退回其他字體。
- 授權說明：`fonts/LICENSES.md`。若要散布網站，需附上 OFL 全文。

## 顏色
以 [Catppuccin](https://catppuccin.com/palette) 為基礎，四種配色（Latte 淺色、Frappé、Macchiato、Mocha 深色）可在右上角刷子切換，預設跟隨系統。

| 角色 | 變數 | Mocha 值 | 用在哪 |
|---|---|---|---|
| 強調色 | `--ctp-accent` = mauve | `#cba6f7` | 連結 hover、圖示、按鈕、標籤、游標 |
| 小記號 | `--ctp-primary` = pink（2026-10-16 起，原本 green） | `#f5c2e7` | 置頂圖釘、選單勾選、連線狀態、收藏書籤、導覽列目前頁面的點 |
| 背景 | `--ctp-base`／`mantle`／`crust` | `#1e1e2e`／`#181825`／`#11111b` | 頁面、卡片、深色陰影 |
| 文字 | `--ctp-fg`／`muted`／`faint` | text／subtext0／overlay1 | 標題、說明、日期 |
| Logo 圓盤 | 固定值 | `#f2eef9` | 所有配色都一樣 |

### 卡片：星空紫（統一）
- 首頁「推薦文章」與紀錄頁的卡片**全部同一種**封面：mauve → 靛藍（blue 混 crust）的 135° 漸層，左上一團 mauve 光暈，加上 6 顆小星點（深色配色為 `#f5e0dc`、Latte 為白色）。
- 標籤：mauve 底、base 色字。
- 以前是依第一個標籤分 8 種顏色，hhyn 要求統一後改成現在這樣（[17 E11](../功能/17-首頁改版/README.md)）。

## 首頁主視覺
- 光暈背景（mauve／blue／pink 三團模糊光）＋ Logo 圓盤 ＋ **隨機日文名言**（打字效果，明朝體）＋出處＋說明文字＋按鈕。
- 名言清單：`hedgedoc-1x/lib/quotes.js`（目前 4 句：岡部倫太郎、葛城美里、芙莉蓮、碇真嗣）。
