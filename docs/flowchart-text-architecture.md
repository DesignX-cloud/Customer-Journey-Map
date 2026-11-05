Phase 0 已完成。**建議先以 Stage 05 驗證「保留原圖形、明確標記文字層、由 JSON 渲染文字」；Stage 04 必須先人工辨識文字路徑，不能直接批次轉換。Stage 03 則涉及 HTML 圖形移入 SVG，需另外確認範圍。**

本次僅進行檔案、XML 與程式碼靜態分析，沒有修改任何檔案、教材 URL，也沒有 Commit 或 Push；未進行瀏覽器互動實測。

**1. 現有架構**

目前只有 03、04、05 三個 Stage 資料夾，其他階段尚無實體頁面：

```text
Customer-Journey-Map/
├─ index.html
├─ assets/
│  ├─ css/style.css
│  └─ js/main.js
├─ stages/
│  ├─ 03-consultation/
│  │  ├─ index.html
│  │  ├─ flowchart.svg
│  │  └─ nodes.json
│  ├─ 04-visit/
│  │  ├─ index.html
│  │  ├─ flowchart.svg
│  │  └─ nodes.json
│  └─ 05-contract/
│     ├─ index.html
│     ├─ flowchart.svg
│     ├─ nodes.json
│     └─ guides/e-signature/
│        ├─ index.html
│        ├─ style.css
│        ├─ guide.js
│        └─ images/（9 張教材截圖）
├─ docs/
│  ├─ 04-appointment-analysis.md
│  ├─ 05-contract-analysis.md
│  └─ design-references/05-e-signature-reference.png
└─ Flowchart-Reference-Diagram/
   └─ 03、04、05 原始 SVG 與 PNG
```

參考圖資料夾被 Git 忽略，正式頁面使用 `stages/` 下的檔案。

開始與結束盤點時，工作區均有以下既有變更，本次完整保留：

- 已修改：Stage 05 的 `flowchart.svg`、`nodes.json`。
- 未追蹤：`docs/design-references/`、Stage 05 的 `guides/`。

**2. 各 Stage 的載入、文字與對應關係**

| 項目 | Stage 03 | Stage 04 | Stage 05 |
|---|---|---|---|
| 畫布 | 2400 × 1505 | 2400 × 1581 | 2400 × 1505 |
| 節點呈現 | HTML 節點、CSS 外框 | 完整 SVG 底圖＋透明 HTML 熱區 | 完整 SVG 底圖＋透明 HTML 熱區 |
| SVG 載入 | `<use>` 引用連線群組 | `<img src="./flowchart.svg">` | `<img src="./flowchart.svg">` |
| SVG 結構 | 1 個群組、22 個連線 path | 116 個 path，沒有群組 | 60 個群組、620 個 path、20 個 rect、1 個 text |
| 顯示文字 | HTML `<span>`、`<br>`，部分含 `<strong>` | 輪廓 path | 大部分是輪廓 path；002 已是 `<text>`＋3 個 `<tspan>` |
| JSON Key | `consult-001`～`consult-022` | `visit-001`～`visit-015` | `contract-001`～`contract-014` |
| HTML ID 對應 | 22／22 完整一致 | 15／15 完整一致 | 14／14 完整一致 |
| JSON Key 直接對應 SVG ID | 無 | 無 | 無，另有語意群組 ID |
| 非空教材 URL | 4 筆 | 1 筆 | 1 筆 |

三個 Stage 都透過共用 [main.js](/D:/Work-Collection/Customer-Journey-Map/assets/js/main.js) 讀取畫布的 `data-nodes="./nodes.json"`，沒有獨立的 Stage 流程圖程式。

目前 JSON 都只有 `title`、`url`，沒有 `displayText`。**不能直接把 `title` 當成流程顯示文字**：Stage 05 已有不同內容；Stage 03 的 `consult-015`～017 顯示內容還包含 JSON title 沒有收錄的第二行說明。

另外，04／05 使用 `<img>`，主頁 JavaScript 無法直接查找圖片內部的 SVG 節點；要渲染 `<text>`，需要調整 SVG 載入方式。

**3. Hover、Click、縮放與拖曳現況**

三個 Stage 共用以下行為：

- 有有效 URL：HTML 節點轉為原生 `<a>`，加入教材圖示、Hover／焦點效果，另開分頁。
- 空 URL：不建立教材連結或圖示。
- 相對 URL：以 `nodes.json` 所在位置解析；Stage 05 的本機教材依賴此規則。
- 縮放：整個畫布一起縮放，包含底圖、熱區、圖示及導覽。
- 捲動：容器提供水平與垂直捲動。

有兩項需要區分：

1. **目前沒有教材名稱 Hover 浮窗。** `title` 用於有效教材連結的 `aria-label`；沒有設定 HTML `title` 或自訂 tooltip。未來若要滑入顯示教材完整名稱，屬於新增功能。
2. **目前沒有滑鼠按住拖曳平移程式。** 已有的是捲動。若「拖曳」指滑鼠抓住畫布移動，也屬新增功能。

教材頁自己的 `guide.js` 只處理截圖放大視窗，不參與流程圖互動，建議維持獨立。

**4. 文字分類與群組混合情況**

| 文字類型 | 處理建議 |
|---|---|
| 一般流程、菱形判斷內文、例外結果 | 納入 `displayText` |
| 已有節點 Key 的說明框 | 納入，但保留標題／內文排版需求 |
| 泳道名稱 | 先維持靜態 |
| 連線旁「是／否／操作卡關」等分支文字 | 先維持靜態，不誤認為判斷節點內文 |
| 12 階段導覽、圖表標題、副標、圖例 | 先維持靜態 |
| 底部指標、資料來源、補充備註 | 先維持靜態 |

具體差異：

- **03：**文字與 CSS 圖形同在 HTML 節點內，SVG 沒有文字。015～017 為粗體標題＋一般說明，不能當成相同樣式的多行文字直接替換。
- **04：**沒有 `<g>`、節點 ID 或文字語意標記。不是文字與圖形混在同一 Group，而是整張圖已攤平成 path；目前無法靠結構安全分離。
- **05：**12 個語意節點群組同時包含外框 path 與文字子群組，但兩者仍可區分。013／014 資訊框的外框與多個文字群組分開放置，沒有完整的節點包覆群組。

**5. Stage 05 可用的明確對照**

以下是後續一次性轉換可採用的對照，不需依 path 順序刪字：

| JSON／HTML ID | SVG 節點群組或外框 | 文字元素 ID |
|---|---|---|
| contract-001 | staff-explain-contract | text150 |
| contract-002 | customer-review-contract | text159，原生 text |
| contract-003 | customer-consent | text168 |
| contract-004 | staff-send-contract | text177 |
| contract-005 | customer-sign | text186 |
| contract-006 | signature-complete | text195 |
| contract-007 | staff-confirm-signature | text204 |
| contract-008 | customer-payment-arrangement | text213 |
| contract-009 | next-payment | text220 |
| contract-010 | digital-signing-blocked | text273 |
| contract-011 | contract-stopped | text294 |
| contract-012 | signature-incomplete | text301 |
| contract-013 | rect243，尚無完整包覆群組 | text247、251、255、259、263 |
| contract-014 | rect276，尚無完整包覆群組 | text280、284、288 |

**不能直接刪除所有 `text…` 群組**：同樣命名也用於泳道、導覽、分支及底部資訊。

**6. SVG 文字路徑處理方案**

建議採「人工核對對照表＋一次性結構整理」，執行時不再猜測 path。

對 Stage 05：

1. 依上述明確 ID，核對文字群組的 `aria-label` 與可見內容。
2. 保留外框、背景、泳道與連線，僅替指定文字元素建立替換機制。
3. 每個節點增加明確的文字容器、圖形標記及文字安全區。
4. JSON 文字成功渲染並通過尺寸檢查後，才隱藏原文字。
5. 沒有 `displayText`、資料失敗或渲染失敗時，保留原文字。
6. 正式遷移後，原文字可保留為隱藏的相容備援；正常畫面只能顯示一份文字。

這可同時滿足「沒有 displayText 保留原顯示」與「不留下重複可見文字」。不建議永久刪除原文字後，才發現 JSON 失敗時無法回復。

對 Stage 04：

- **15 個節點全部先列為人工處理項目。**
- 優先尋找保有文字物件／圖層的編輯來源。
- 若只有現有 SVG，需在向量編輯器逐節點辨識文字 path，建立文字專用群組與穩定 ID。
- 若單一複合 path 同時含文字與圖形，必須人工拆分。
- 無法可靠分離時保留原狀，不能用背景遮字、path 序號或座標範圍自動刪除。

對 Stage 03：

沒有文字路徑可轉換。若嚴格落實「所有節點幾何都在 SVG」，必須把現有 HTML／CSS 節點與泳道遷入 SVG。這是額外的結構遷移，**不能視為單純文字資料化，也不能宣稱完全不涉及圖形重建。**

**7. 建議的共用 JavaScript 架構**

新增 `assets/js/flowchart-renderer.js`，由 `main.js` 統一協調：

```text
main.js
  ├─ 保留導覽、縮放、教材連結及圖示
  ├─ 載入一次 nodes.json
  └─ 將資料交給 flowchart-renderer.js
       ├─ 取得可操作的 inline SVG
       ├─ 驗證節點及 displayText
       ├─ 渲染 text / tspan
       ├─ 測量、置中、調整字級
       └─ 成功後切換原文字／新文字
```

建議細節：

- 04／05 先保留原 `<img>` 作備援；SVG 成功載入、解析後，在相同位置切換成 inline SVG。
- 保留現有透明 HTML 熱區及教材圖示，SVG 文字層設定 `pointer-events: none`。
- 所有圖層繼續放在同一縮放畫布，不另計算螢幕縮放座標。
- JSON 僅載入一次，顯示文字不依賴 URL 是否為空。
- 使用 `textContent` 建立 `<tspan>`，不將 JSON 當 HTML 插入。
- 在 SVG 內使用 `data-node-id` 對應 JSON，避免和既有 HTML ID 重複。
- 節點位置、圖形及文字安全區放在 SVG；JSON 不存座標或尺寸。

文字尺寸處理：

- 依陣列明確換行，測量實際字型後置中。
- 同時檢查寬度、高度，預留外框內距與教材圖示位置。
- 菱形採內接安全區，不能只檢查矩形 bounding box。
- 說明框允許左對齊與標題樣式，不強制所有內容置中。
- 超長文字先在核准範圍內縮字；仍放不下時回復原文並報告問題，不裁掉內容或擅自擴大節點。

錯誤應逐節點隔離：找不到 ID、格式錯誤或文字溢出，不能阻止其他節點、縮放與既有教材功能。

**8. JSON 欄位設計**

保留目前以節點 ID 為 Key 的結構：

```json
{
  "contract-005": {
    "displayText": [
      "開啟電子合約",
      "依流程完成簽署"
    ],
    "title": "保留現有教材完整標題",
    "url": ""
  }
}
```

以上為欄位示意，並非內容修訂決定。

- `displayText`：選填，建議限定為非空字串陣列，一項代表一行。
- `title`：保留現值，作教材名稱、可存取名稱及未來 Hover 名稱來源。
- `url`：保留現值與相對路徑解析方式。
- 缺少 `displayText`：顯示原文。
- 格式錯誤或空陣列：視為資料問題，回復原文，不把節點清空。

字級、顏色、對齊、粗體與安全區先留在 SVG／樣式設定，避免把視覺結構混回 JSON。

**9. 改造難度、檔案與 PoC**

| Stage | 難度／主要風險 |
|---|---|
| 05 | 中：具明確文字 ID；主要是載入方式、字型測量、資訊框與熱區疊層 |
| 03 | 文字資料化低；完整達成 SVG 結構分離中高，涉及 HTML／CSS 幾何遷移 |
| 04 | 高：缺少文字語意結構，人工分離是前置條件 |
| 未來新增 | 依規範製作可降低風險，禁止將動態文字轉輪廓 |

預估後續檔案：

| 階段 | 預計涉及 |
|---|---|
| Phase 1 | 新增 renderer；修改共用 main.js、必要的限定 CSS，以及 05 HTML／SVG／JSON 的單節點設定 |
| Phase 2 | 完成 05 SVG／JSON，其餘必要整合調整 |
| Phase 3 | 03、04 各自 HTML／SVG／JSON；03 需另確認幾何遷移範圍 |
| Phase 4 | 新增製作規範與資料／SVG 驗證工具 |

首頁、既有教材頁與教材 URL 預計不需改動。

**首選 PoC：`contract-002`。** 它已有原生 `<text id="text159">`、三行內容及現存教材連結，可同時驗證文字渲染、Hover、Click、圖示與縮放，避開首次就拆解輪廓文字的風險。

但此 PoC **不能證明 path 轉換已成功**。Phase 2 開始時，建議先以 `contract-001` 驗證單一文字群組替換，再處理其他輪廓節點。

每個 Phase 都應在人工驗收後才繼續；04 未完成安全分離前，不應批次導入。

**10. 需要人工確認的事項**

1. 是否採 `contract-002` 為 Phase 1 PoC。
2. Hover 教材名稱要採原生提示，還是可控制換行的自訂浮窗；空 URL 是否也顯示名稱。
3. 「拖曳」是否指新增滑鼠按住平移，或維持現有捲動操作。
4. 03 的完整 SVG 幾何遷移是否允許；若仍禁止圖形重建，03 只能先採過渡方案。
5. 04 是否有保留文字圖層的來源；否則需接受逐節點人工分離。
6. 03 的補充說明、05 的 013／014 資訊框是否一併資料化；建議納入，保留既有內容與排版層級。
7. 字型替換可接受的外觀差異、最小字級，以及超長內容的人工修訂方式。

**目前停在 Phase 0，等待你確認後才開始 Phase 1。**
