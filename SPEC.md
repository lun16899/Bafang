**專案規格與實作說明**

此文件為 `myexpress` 專案的簡要規格（spec）與實作過程說明，包含環境、主要檔案說明、API 規格、資料庫結構、啟動/安裝步驟，以及實作與改進建議。

**專案概述**:
- **名稱**: `myexpress`
- **主要用途**: 提供一個以 SQLite 儲存「八方雲集」歷年商品價格的簡易 CRUD Web 應用，包含前端頁面與 REST-like API。

**開發環境 & 相依套件**:
- **Node**: 使用 ECMAScript module (`"type": "module"`)。啟動腳本為 `npm start`（執行 `node ./bin/www`） — 參見 [package.json](package.json).
- **主要套件**: `express`, `morgan`, `cookie-parser`, `sqlite3`, `debug` — 來自 [package.json](package.json).

**啟動/安裝流程**:
- 安裝相依: `npm install`
- 啟動伺服器: `npm start` 或 `node ./bin/www`（預設監聽埠 `3000`）
- 若重新安裝依賴: 刪除 `node_modules` 後 `npm install`（或在 CI 使用 `npm ci`）。

**主要檔案與職責**:
- `app.js`: Express 應用主要檔案，註冊中介軟體、靜態檔案與路由，並在啟動時打開 SQLite DB 並指派到 `app.locals.db`。也實作了 `/api/...` 系列接口。
- `db.js`: 可重用的 DB 初始化與種子函式（`openDatabase`, `initDatabase`, `ensureTableExists`, `seedBafangData`），可單獨執行以初始化或種子資料庫。
- `bin/www`: 伺服器啟動器，處理埠與監聽錯誤。
- `routes/index.js`, `routes/users.js`: 基本路由範例（預設頁面與 users 範例）。
- `public/index.html`: 前端介面，包含新增、篩選、編輯、刪除與圖表視覺化的 client-side 邏輯。

（可參考原始檔）: [app.js](app.js), [db.js](db.js), [bin/www](bin/www), [routes/index.js](routes/index.js), [routes/users.js](routes/users.js), [public/index.html](public/index.html)

**API 規格（由 `app.js` 提供）**:
- `GET /api/insert`  
  - 描述: 以 query string 新增一筆至 `Bafang` 表
  - 參數: `date` (字串，格式 YYYY 或 YYYY-MM)、`product` (字串)、`unit_price` (數字)
  - 回傳: 成功 `{ success: true, lastID: <rowid> }`，或錯誤 `{ error: '...' }`

- `GET /api/quotes`  
  - 描述: 取得 `Bafang` 表中所有資料
  - 回傳: `{ rows: [...] }`（每筆包含 `id`, `date`, `product`, `unit_price`）

- `POST /api/update`  
  - 描述: 以 JSON body 更新指定 `id` 的列
  - Body: `{ id, date, product, unit_price }`
  - 回傳: `{ success: true, changes: <n> }` 或錯誤

- `GET /api/delete`  
  - 描述: 以 query `id` 刪除一列
  - 參數: `id`
  - 回傳: `{ success: true, changes: <n> }` 或錯誤

**資料庫結構**:
- 檔案: `db/sqlite.db`（由程式啟動時建立）
- 表: `Bafang`
  - 欄位: `date` TEXT, `product` TEXT, `unit_price` REAL
  - PK: 無顯性主鍵，程式透過 SQLite rowid 取得 `id`（`SELECT rowid as id, ...`）

**前端行為摘要** (`public/index.html`):
- 提供表單可新增資料（呼叫 `GET /api/insert`）
- 提供篩選欄位與表格顯示 `/api/quotes` 回傳資料
- 提供單列編輯（client-side prompt）呼叫 `POST /api/update`
- 提供刪除功能呼叫 `GET /api/delete`
- 使用 Chart.js 繪製平均單價走勢圖

**實作流程說明（重點步驟）**:
1. 專案 bootstrapping: 使用 Express generator 或手動建立 `app.js`、`bin/www`、`routes` 與 `public`。`package.json` 設定 `type: "module"` 使程式採用 ESM。
2. DB 設計: 選擇 SQLite 作為輕量儲存，撰寫 `db.js` 作為抽象化的 DB 開啟/建表/種子邏輯；`app.js` 在啟動時開啟 DB 並放到 `app.locals` 供路由使用。
3. API 與前端整合: 在 `app.js` 直接實作簡單 CRUD API（以 `db.run` / `db.all`），前端透過 `fetch` 呼叫 API，並在 client 端做篩選與圖表處理。
4. 錯誤處理: API 有基礎的參數檢查與錯誤回傳（400 / 500）。

**測試與驗證建議**:
- 單元測試: 建議針對 `db.js` 的 `ensureTableExists`、`seedBafangData` 撰寫測試，使用臨時檔案或記憶體 DB（需微調 sqlite3 的開啟方式）。
- 集成測試: 啟動應用（或以 `supertest` 對 `app` 進行測試）驗證 `/api/insert`, `/api/quotes`, `/api/update`, `/api/delete` 行為。

**已知觀察與改進建議**:
- 目前 `app.js` 與 `db.js` 都有打開 DB 的邏輯（可重構：在 `db.js` 提供 `initDatabase()`，讓 `app.js` 只負責呼叫並注入 `app.locals.db`）。
- 建議為 `Bafang` 加上顯性主鍵欄位（如 `id INTEGER PRIMARY KEY AUTOINCREMENT`），以減少對 `rowid` 的依賴並提升可讀性。
- `GET /api/insert` 使用 query string 可能不如 `POST` 安全與語義清晰，建議改用 `POST` 並以 JSON 傳遞。
- 增加 input validation 與更詳細的錯誤碼回傳（例如使用 `ajv` 做 JSON schema 驗證）。


---
此規格已根據專案檔案生成（來源包括 `app.js`, `db.js`, `routes/*`, `public/index.html`, `package.json`）。
