## 架构总览

- **服务端**: `Node.js + Express`，仅用于静态文件托管与 SPA 回退（`server.js`）。
- **前端运行时**: 纯浏览器环境，脚本以 `<script>` 标签按顺序加载。
- **本地存储**: `IndexedDB`，通过 `Dexie` 管理（在页面中通过 CDN 引入）。
- **实时/联网**: 可选 `MQTT`（CDN 引入的 `mqtt.min.js`），对应界面 `js/screens/mqtt-room.js`。
- **PWA**: `manifest.json` + `sw.js` 缓存 WorldBook 相关资源。
- **WorldBook 引擎**: `worldbook/*.ts` 使用 `tsup` 构建到 `public/worldbook`（提供 ESM/IIFE/声明文件）。
- **测试**: 端到端（Playwright，`tests/*.spec.js`），以及 WorldBook 的 Vitest（`worldbook/tests`）。

## 运行流程（高层）

1. 启动服务器：`npm start` → `server.js` 静态托管并回退 `index.html`。
2. 页面加载：`index.html` 依次引入核心模块、界面模块、WorldBook 构建产物与集成脚本。
3. 初始化：`main.js` → `Database.init()` → `Database.loadWorldState()` → 渲染首页与绑定事件。
4. 交互循环：各个 Screen 通过 `StateManager` 读写状态，`Database.saveWorldState()` 持久化，`AI.getResponse()` 访问外部大模型 API，并在可用时注入 WorldBook 上下文。

## 关键全局对象与职责

- `StateManager`（`js/state.js`）
  - 维护全局 `worldState` 内存对象，提供 `get / set / update`。

- `Database`（`js/database.js`）
  - 通过 Dexie 定义表：`general, player, ai, chatHistory, worldBook, events, apiConfig, chatSettings`。
  - `loadWorldState()`：从 IndexedDB 拉取，进行历史数据升级/迁移、默认值填充、离线收益计算。
  - `saveWorldState()`：批量事务写回，限制历史长度，写入各数据表。
  - `migrateFromLocalStorage()`：一次性从旧版 LocalStorage 迁移。

- `AI`（`js/ai.js`）
  - 统一的大模型请求层，兼容 `Gemini / OpenAI / 兼容端点`。
  - 负责把聊天历史、世界书上下文与状态提示拼装成系统提示/消息。
  - 可选解析“思维链”标签，并根据设置在 UI 中折叠展示或弹窗提示。

- `Utils`（`js/utils.js`）
  - 通用方法：变量替换、时钟更新、屏幕显示切换、安全绑定、数据升级（聊天记录/世界书）。

- `WorldBookV2`（`js/screens/worldbook.js`）
  - SillyTavern 风格的世界书 UI 与激活逻辑，数据存于 `localStorage`。
  - 导入/导出世界书，条目匹配（含正则/大小写/全词匹配）、多选批量操作、分桶 Token 预算等。

- 各 Screen（`js/screens/*.js`）
  - `ChatScreen`：渲染对话、发送文本/图片、调用 `AI.getResponse()`。
  - `SettingsScreen`：管理 API 预设、拉取模型、测试连通性、数据备份/恢复。
  - `GeneralSettingsScreen`：通用设置（在 `index.html` 中按钮与事件绑定）。
  - `WalletScreen / StoreScreen / BackpackScreen`：虚拟经济系统界面与交互。
  - `mqtt-room.js`：MQTT 聊天室应用（通过 `createMqttRoomApp` 集成到主界面）。

## 数据模型（简述）

- `worldState`（内存）
  - `player`: `{ name, money, inventory[] }`
  - `ai`: `{ name, mood, money, inventory[] }`
  - `chat`: `{ history[] }`，消息项：`{ sender: 'user'|'ai'|'system', content: Part[], thoughtText?, timestamp }`
    - `Part`: `{ text? } | { inline_data: { mime_type, data(base64) } }`
  - `worldBook`: 兼容旧格式升级为 `{ id, name, category, triggers[], content, enabled, constant, position, priority, variables, value, comment }` 数组
  - `events`: `{ aiNoticedMovieTicket: boolean, ... }`
  - `apiConfig`: `{ presets[], activePresetId }`，预设包含 `{ id, name, provider, endpoint, apiKey, model }`
  - `chats`: `{ [chatId]: { settings: { aiPersona, myPersona, linkedWorldBookIds[], enableChainOfThought, showThoughtAsAlert } } }`
  - `session`: `{ minutesAway, moneyEarned }`

## WorldBook 注入路径

1. 优先使用全局的 `window.buildWorldInfo(scanText, recentHistory)`（由 `public/worldbook` 的引擎与集成脚本提供）。
2. 回退到 `WorldBookV2` 的激活逻辑：`WorldBookV2.getActiveEntries(scanText)` → 预算/排序 → 拼接上下文。

## 构建与测试

- 构建 WorldBook：`npm run build` → `tsup worldbook/*.ts` 输出至 `public/worldbook`。
- 端到端测试：`npm run test:e2e`（Playwright）。
- WorldBook 单元测试：`npm run test`（Vitest，`vitest.config.ts`）。

## 目录要点

- 根静态资源：`index.html, style.css, sw.js, manifest.json`。
- 前端源码（JS）：`js/` 与 `js/screens/`。
- WorldBook 源码（TS）：`worldbook/` → 构建产物在 `public/worldbook/`。
- 测试：`tests/`（E2E），`worldbook/tests/`（Vitest）。


