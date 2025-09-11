## 给其他 AI 的项目交接说明

本项目是一个浏览器端运行的虚拟手机 + AI 伴侣 Demo，后端仅做静态托管。如下信息足以让别的 AI 快速接手：

### 运行与入口

- 启动：`npm i && npm start`，打开 `http://localhost:3000`。
- SPA 入口：`index.html`。脚本按顺序加载（依赖全局符号）。
- PWA：`manifest.json` + `sw.js`。离线缓存 worldbook 构建产物。

### 全局对象（约定）

- `StateManager`（全局）：内存状态源。
- `Database`（全局）：IndexedDB 读写与迁移。
- `Utils`（全局）：变量替换、屏幕管理、升级工具。
- `AI`（全局）：统一的大模型请求层（Gemini/OpenAI/兼容）。
- `WorldBookV2`（全局）：世界书 UI/匹配/预算；数据保存在 `localStorage`。
- `window.buildWorldInfo`（可选全局）：来自编译后的 `public/worldbook` 引擎，用于构建更强的世界书上下文。

### 主要编辑面（模块划分）

- 业务与 UI：`js/` 与 `js/screens/`（无打包器，直接脚本）。
- WorldBook 引擎：`worldbook/*.ts`（`tsup` 构建到 `public/worldbook`）。
- 测试：E2E 在 `tests/`；引擎单测在 `worldbook/tests/`。

### 常见任务指引

- 新增一个 Screen：在 `index.html` 加上容器 + 入口按钮 → `js/screens/foo.js` 定义 `FooScreen` → 在 `main.js` 里绑定事件（显示/隐藏 + FooScreen.render）。
- 接入新模型供应商：在 `js/ai.js` 的 `getResponse()` 增加分支；在 `SettingsScreen` 增加相应配置字段；确保 `buildOpenAiMessages()`/历史兼容性良好。
- 扩展 WorldBook 规则：优先改 `worldbook/*.ts` 引擎并重建；如只需 UI 行为，可修改 `WorldBookV2` 的匹配/预算函数。

### 约束与风格

- 所有脚本依赖全局符号，注意加载顺序与命名冲突。
- IndexedDB 表结构已在 `Database.init()` 中固定，如需新增表务必更新 `load/save` 逻辑。
- 对历史数据保持向后兼容，使用 `Utils.upgrade*` 路径。

### 关键文件定位

- 入口：`js/main.js`
- AI：`js/ai.js`
- 状态：`js/state.js`
- 存储：`js/database.js`
- 工具：`js/utils.js`
- 世界书（UI）：`js/screens/worldbook.js`
- 世界书（引擎）：`worldbook/*.ts` → `public/worldbook/*`


