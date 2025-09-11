```markdown
# Claude Code 开发指南

## 快速开始
1. 查看 docs/ 目录了解项目架构
2. 运行 `npm start` 启动项目
3. 访问 http://localhost:3000

## 代码修改规范

### 添加新功能
- 位置：js/screens/ 添加新Screen
- 步骤：
  1. index.html 添加容器
  2. 创建 js/screens/xxx.js
  3. main.js 绑定事件

### 修改现有功能
- 先定位文件（见 MODULE_MAP.md）
- 保持全局对象结构
- 测试向后兼容性

## 调试技巧
```javascript
// 控制台常用命令
StateManager.get() // 查看全局状态
Database.saveWorldState() // 保存状态
WorldBookV2.getActiveEntries('测试文本') // 测试世界书注意事项
⚠️ 不要破坏全局对象依赖
⚠️ 保持IndexedDB结构兼容
⚠️ 修改前先备份数据