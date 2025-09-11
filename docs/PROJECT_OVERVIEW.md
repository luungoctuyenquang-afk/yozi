# 项目概览 - 虚拟手机AI伴侣Demo

## 项目特点

- **纯前端架构**：无需构建工具，通过`<script>`标签按顺序加载
- **全局对象模式**：所有模块暴露为全局对象，便于调试和零基础开发
- **本地存储**：IndexedDB（通过Dexie）+ localStorage（世界书数据）
- **PWA支持**：支持离线访问和安装到桌面
- **AI集成**：支持Gemini、OpenAI及兼容API
- **世界书系统**：SillyTavern风格的上下文管理系统

## 技术栈

- **前端**：原生JavaScript + HTML + CSS
- **存储**：IndexedDB (Dexie) + localStorage
- **服务器**：Node.js + Express（仅静态托管）
- **世界书引擎**：TypeScript（编译到IIFE）
- **测试**：Playwright (E2E) + Vitest (单元测试)
- **实时通信**：MQTT（可选）

## 核心架构

### 全局对象

| 对象 | 文件 | 职责 |
|-----|------|------|
| StateManager | js/state.js | 内存状态管理 |
| Database | js/database.js | IndexedDB持久化 |
| AI | js/ai.js | 统一AI请求层 |
| Utils | js/utils.js | 通用工具函数 |
| WorldBookV2 | js/screens/worldbook.js | 世界书UI和逻辑 |
| CONFIG | js/config.js | 全局配置 |

### 数据流

```
用户交互 → Screen组件 → StateManager(内存) → Database(持久化)
                ↓
              AI请求 → WorldBook注入 → 响应处理
```

### 目录结构

```
/
├── index.html          # 单页应用入口
├── style.css           # 全局样式
├── server.js           # Express静态服务
├── manifest.json       # PWA配置
├── sw.js              # Service Worker
│
├── js/                # 核心模块
│   ├── config.js      # 全局配置
│   ├── state.js       # 状态管理
│   ├── database.js    # 数据持久化
│   ├── utils.js       # 工具函数
│   ├── ai.js          # AI接口
│   ├── main.js        # 应用入口
│   └── screens/       # 界面模块
│       ├── chat.js
│       ├── worldbook.js
│       ├── wallet.js
│       ├── store.js
│       ├── backpack.js
│       ├── settings.js
│       └── mqtt-room.js
│
├── worldbook/         # 世界书引擎源码(TypeScript)
├── public/worldbook/  # 编译后的世界书引擎
├── tests/            # E2E测试
└── docs/             # 项目文档
```

## 快速开始

### 安装运行
```bash
npm install
npm start
# 访问 http://localhost:3000
```

### 开发调试
```bash
# 构建世界书引擎
npm run build

# 运行测试
npm run test        # 单元测试
npm run test:e2e    # E2E测试
```

### 浏览器控制台调试
```javascript
// 查看全局状态
StateManager.get()

// 手动保存
Database.saveWorldState()

// 查看世界书激活
WorldBookV2.getActiveEntries('测试文本')

// 变量替换测试
Utils.replaceVariables('{{ai.name}}的心情是{{ai.mood}}')
```

## 开发规范

### 添加新功能
1. 确定所属模块（核心/界面/世界书）
2. 遵循现有全局对象模式
3. 在对应Screen中添加UI
4. 通过StateManager管理状态
5. 使用Database持久化

### 代码风格
- 使用全局对象，避免模块化语法
- 保持向后兼容性
- 注重零基础友好性
- 详细注释关键逻辑

### 修改指导格式
当需要修改代码时，请使用以下格式：

```markdown
### **根本原因分析**
[问题分析]

### **解决方案**
[方案说明]

**文件**: [文件路径]
**定位**: 找到 [代码位置]

**【修改前】:**
​```javascript
[原代码]
​```

**【修改后】:**
​```javascript
[新代码]
​```

**解释**：[修改说明]
```

## 当前状态

### 已完成
- ✅ 世界书系统（UI + 引擎）
- ✅ 基础聊天功能
- ✅ AI接口集成（Gemini/OpenAI）
- ✅ 虚拟经济系统（钱包/商店/背包）
- ✅ PWA支持
- ✅ MQTT聊天室

### 开发中
- 🔄 交互框架开发
- 🔄 UI优化
- 🔄 性能提升

### 计划中
- 📋 模块化重构（保持兼容）
- 📋 统一世界书数据源
- 📋 更多AI模型支持

## 常见问题

### Q: 如何添加新的Screen？
A: 在index.html添加容器 → 创建js/screens/新screen.js → 在main.js绑定事件

### Q: 如何接入新的AI模型？
A: 在js/ai.js的getResponse()添加分支 → 在settings.js添加配置

### Q: 世界书数据存在哪里？
A: UI数据在localStorage，引擎使用的数据通过Database存储在IndexedDB

### Q: 如何调试变量替换？
A: 首页有"变量调试面板"，或在控制台使用Utils.replaceVariables()

## 相关文档

- [架构详解](./ARCHITECTURE.md)
- [模块地图](./MODULE_MAP.md)
- [调试指南](./DEBUG_GUIDE.md)
- [AI交接说明](./AI_HANDOFF.md)
- [更新日志](./CHANGELOG.md)

## 更新记录

最后更新：2025-01-12
- 完成所有文档阅读
- 创建项目概览文档
- 梳理项目结构和开发规范