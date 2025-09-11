## 调试与运行指南

### 快速启动

1. 安装依赖：`npm i`
2. 启动本地服务器：`npm start`（默认 3000）
3. 浏览器访问：`http://localhost:3000`

注意：首次访问建议使用 `http://` 打开以启用 `Service Worker` 与缓存；`file://` 会跳过 SW。

### 模块分区与调试切入点

- **状态/存储**
  - 入口：`js/state.js`（`StateManager`）与 `js/database.js`（`Database`）。
  - 断点建议：`Database.loadWorldState()` 返回处；`saveWorldState()` 的事务体；`migrateFromLocalStorage()`。
  - 常见问题：
    - 聊天历史太长导致存储爆增 → 代码中已切片到 50 条（可调）。
    - 旧存档不兼容 → `Utils.upgradeChatHistory / upgradeWorldBook` 确认格式。

- **AI 调用**
  - 入口：`js/ai.js` → `getResponse()`；OpenAI 消息拼装在 `buildOpenAiMessages()`。
  - 断点建议：请求前后（`fetch`）；WorldBook 注入前的 `worldBookContext`；思维链解析。
  - 常见问题：
    - 401/403 → 检查 `SettingsScreen` 是否保存了 `apiKey/model`。
    - OpenAI 兼容端点路径 → 确保以 `/v1` 开头，`/chat/completions` 路径正确。

- **WorldBook**
  - 本地 UI 引擎：`js/screens/worldbook.js`（`WorldBookV2`）。
  - 编译引擎：`public/worldbook/*.js` + `js/worldbook.integration.js`。
  - 断点建议：`WorldBookV2.getActiveEntries()`、预算分配、`buildWorldBookContext()`。
  - SW 缓存：`sw.js` 的 `urlsToCache`；调试时可注释缓存或更新 `CACHE_NAME` 强制刷新。

- **界面**
  - 每个 Screen 都是一个全局对象（`ChatScreen/WalletScreen/...`）。
  - 调试：在 `main.js` 中查找对应的事件绑定，定位入口按钮点击后调用的 `render()` 或操作函数。

### 数据导入导出

- 导出：设置页「导出备份文件」→ 下载 `JSON`。
- 导入：设置页「导入备份文件」→ 覆盖 IndexedDB 后自动刷新。

### 端到端与单元测试

- E2E：`npm run test:e2e`（Playwright），用来验证 PWA/路由/基本交互。
- 单测：`npm run test`（Vitest）主要覆盖 `worldbook/` 引擎逻辑。

### 常用验证脚本片段（浏览器控制台）

```js
// 查看全局状态
StateManager.get()

// 保存状态
Database.saveWorldState()

// 触发变量替换预览
Utils.refreshVarsDemo()

// 世界书：查看激活条目
WorldBookV2.getActiveEntries('用户输入文本')
```

### 性能与稳定性建议

- 控制聊天历史长度，减少存储压力与消息拼装成本。
- 合理设置 WorldBook Token 预算，避免上下文过长。
- 使用 `AbortController` 的超时已启用（AI 请求 30s），必要时可调低。


