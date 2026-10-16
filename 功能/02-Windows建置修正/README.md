# 02 Windows 建置修正

> 狀態：✅ 完成　｜　Commit：`99dc634`　｜　修改檔案：`hedgedoc-1x/webpack.common.js`

## 需求來源
- prompt 6（把 HedgeDoc 跑起來）時發現的問題；prompt 7 要求 commit。

## 說明
- **現象**：開新筆記後狀態顯示 OFFLINE、編輯器空白；瀏覽器主控台錯誤 `Cannot read properties of undefined (reading 'ot')`。
- **根因**：`webpack.common.js` 中 babel-loader 的排除規則寫成 `/public\/vendor/`，只認正斜線。Windows 路徑是反斜線，於是 `public/vendor/ot/ot.min.js` 被 babel 當成 ES 模組轉譯，頂層的 `(this)` 被改寫成 `(void 0)`，OT 的 Selection 模組讀 `this.ot` 時崩潰。
- **修正**：改成 `/public[\\/]vendor/`，兩種斜線都能匹配。已確認 webpack 設定檔中沒有其他同類寫法。

```diff
-        exclude: [/node_modules/, /public\/vendor/]
+        exclude: [/node_modules/, /public[\\/]vendor/]
```

## 檢測

### 自動檢測：`check.ps1`
| ID | 檢查內容 |
|---|---|
| WIN-1 | `webpack.common.js` 使用兩種斜線都匹配的規則 |
| WIN-2 | webpack 設定檔中沒有其他「只認正斜線」的路徑正則 |
| WIN-3 | 打包後的 `index-pack` 中，沒有 OT 模組被包成 `(void 0)` 的痕跡 |
| WIN-4 | 打包檔比 `webpack.common.js` 新（改設定後有重新建置） |

### 手動檢測（瀏覽器）
1. 開 `http://localhost:3000/new`（需登入）。
2. 右上角狀態應為 **ONLINE**，編輯器有內容，主控台沒有 `reading 'ot'` 錯誤。

### 最近一次檢測結果（2026-10-16）
- 自動：4 PASS / 0 WARN / 0 FAIL
- 手動：修正後新建筆記顯示 ONLINE，輸入後重新整理內容仍在 ✅

## 錯誤紀錄與處理

| # | 日期 | 現象 | 原因 | 處理方式 | 狀態 |
|---|---|---|---|---|---|
| E1 | 10-16 | 編輯器空白、OFFLINE、`reading 'ot'` | babel 排除規則只認正斜線（見上） | 改正則並重新建置；加入 WIN-1～WIN-3 防止回歸 | ✅ 已處理 |
| E2 | 10-16 | 修正後主控台仍看得到同一個錯誤 | 那是修正前**舊 bundle**（不同 hash）留下的紀錄 | 以新 bundle 的檔名過濾主控台訊息確認；不是新的錯誤 | ℹ️ 說明 |
