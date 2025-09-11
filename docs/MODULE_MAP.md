## 模块地图

### 根目录

- `server.js`: Express 静态托管 + SPA 回退。
- `index.html`: 单页应用 HTML，按顺序注入脚本与样式。
- `style.css`: UI 样式。
- `manifest.json`: PWA 信息。
- `sw.js`: Service Worker，缓存 worldbook 相关静态文件。
- `package.json` / `package-lock.json`: 依赖与脚本（构建/测试/启动）。
- `vitest.config.ts`, `tsconfig.json`: 测试与 TS 配置（WorldBook）。

### 前端源码（js/）

- `config.js`: 初始配置（商品、物品效果、默认人物与人格文案）。
- `state.js`: `StateManager` 全局状态管理。
- `database.js`: `Database`（Dexie 模型、load/save/migrate）。
- `utils.js`: 通用工具（变量替换、时钟、屏幕切换、结构升级）。
- `ai.js`: AI 请求层（Gemini/OpenAI/兼容），WorldBook 注入。
- `main.js`: 应用入口（初始化、事件绑定、收益循环）。
- `worldbook.integration.js`: 与 `public/worldbook` 引擎的桥接（在页面引用）。
- `worldbook-link.js`: 关联 UI 的工具（若用于 General Settings 的世界书绑定）。

### 界面模块（js/screens/）

- `chat.js`（ChatScreen）：渲染消息、发送文本/图片、展示思维链。
- `wallet.js`（WalletScreen）：显示余额，配合收益系统。
- `store.js`（StoreScreen）：购买道具，触发 `CONFIG.itemEffects`。
- `backpack.js`（BackpackScreen）：背包展示与“使用道具”。
- `worldbook.js`（WorldBookV2）：世界书 UI + 匹配/预算逻辑。
- `settings.js`（SettingsScreen）：API 预设管理、拉模型、测试连接、导入导出。
- `general-settings.js`（GeneralSettingsScreen）：通用设置（思维链等）。
- `mqtt-room.js`：MQTT 聊天室（通过 `createMqttRoomApp` 挂载）。

### WorldBook 源（worldbook/）

- `engine.ts`, `importer.ts`, `index.ts`, `types.ts`: 引擎与类型定义，编译到 `public/worldbook`。
- `tests/worldbook.spec.ts`: 引擎的 Vitest 单元测试。

### 构建产物（public/worldbook/）

- `index.iife.js / index.mjs / *.global.js`: 浏览器/ESM 入口。
- `engine.d.ts / importer.d.ts / types.d.ts`: 类型声明。
- `samples/travel.worldbook.json`: 示例数据。

### 测试（tests/）

- `*.spec.js`: Playwright E2E；另外 `stateUpdate.test.js`、`upgrade*.test.js` 是数据升级校验。

## 依赖关系梳理

- `main.js` 依赖：`database.js`、`utils.js`、各 `screens/*.js`、`ai.js`、`worldbook.integration.js`。
- `ai.js` 依赖：`state.js`、`utils.js`、可选的 `window.buildWorldInfo` 或 `WorldBookV2`。
- `database.js` 依赖：`Dexie`（CDN）、`StateManager`、`Utils`。
- `worldbook.js` 与引擎：双轨制（本地 `WorldBookV2` + `public/worldbook` 的引擎）。


