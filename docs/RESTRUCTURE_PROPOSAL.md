## 建议的目录划分（兼容现状，逐步演进）

当前项目以纯脚本全局对象组织，建议在保持可运行的前提下，分阶段优化结构，方便模块化调试与多人协作。

### 阶段 1：添加文档与分区目录（已完成部分）

- 新增 `docs/`：`ARCHITECTURE.md`、`MODULE_MAP.md`、`DEBUG_GUIDE.md`、`AI_HANDOFF.md`。
- 约定模块分区：
  - 核心：`js/{config,state,database,utils,ai,main}.js`
  - 界面：`js/screens/*`
  - WorldBook 源：`worldbook/*`，产物在 `public/worldbook/*`
  - 测试：`tests/*`, `worldbook/tests/*`

### 阶段 2：提取“外部集成层”

- 目标：把与外部服务/引擎交互的代码集中，减少横跨修改。
- 操作：
  - 新建 `js/integrations/`：
    - `worldbook.integration.js`（移动现有同名文件）
    - `mqtt.integration.js`（如需抽离 `createMqttRoomApp` 的装配逻辑）
  - `index.html` 中相应 `<script>` 顺序保持不变。

### 阶段 3：模块化构建（可选）

- 目标：把 `js/` 转为 ESM（或使用 Vite）以获得更好的可维护性。
- 操作（可选）：
  - 引入 Vite：`npm create vite@latest`（保留当前结构，逐步迁移）。
  - 拆分全局对象为模块导出，按需导入，保留一个 `global-bridge.js` 做过渡期全局挂载。

### 阶段 4：数据层演进（可选）

- 目标：统一世界书数据来源，避免 `localStorage` 与 `IndexedDB` 双轨分散。
- 操作：
  - 在 `Database` 中新增 table `worldBooks` & `worldBookEntries`；
  - 在 `WorldBookV2` 中读写通过 `Database` 的 API（封装异步接口），逐步弃用 `localStorage`。

### 阶段 5：自动化与质量保障

- 在 CI 中加入：
  - `npm run build` 校验 worldbook 编译；
  - `npm run test` + `npm run test:e2e`；
  - Prettier/ESLint（若后续引入打包器/ESM）。

## 模块边界（建议）

- `AI`：只负责消息拼装与 HTTP 调用，避免 UI 与存储逻辑耦合。
- `WorldBookV2`：只负责 UI 与匹配，不直接依赖 `AI`；对外暴露 `buildWorldBookContext(text)` 与 `getActiveEntries(text)`。
- `Database`：作为唯一持久化入口；未来统一世界书数据后，提供 `load/save` 的高层 API。
- `Screens/*`：只通过 `StateManager`/`Database`/`AI`/`WorldBookV2` 的公开接口交互。


