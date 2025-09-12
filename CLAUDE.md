# 虚拟手机AI伴侣项目

## 项目概述
- 浏览器端虚拟手机Demo + AI伴侣系统
- 纯前端架构，无打包器，脚本按序加载
- 核心功能：AI对话、世界书系统、虚拟经济、PWA

## 技术栈
- 前端：原生JS（全局对象模式）
- 存储：IndexedDB (Dexie) + localStorage
- AI接口：Gemini/OpenAI兼容
- 世界书引擎：TypeScript (tsup构建)
- PWA：Service Worker离线缓存

## 开发约定
1. **零代码基础友好**：所有修改需提供完整替换代码
2. **全局对象依赖**：注意脚本加载顺序
3. **向后兼容**：保持历史数据兼容性
4. **修改格式**：
   - 根本原因分析
   - 解决方案说明
   - 文件定位
   - 修改前后对比

## 常用命令
- `npm start` - 启动开发服务器(3000端口)
- `npm run build` - 构建WorldBook引擎
- `npm test` - 运行测试

## 重要文件
- 入口：index.html, js/main.js
- AI核心：js/ai.js
- 状态管理：js/state.js
- 数据库：js/database.js
- 界面：js/screens/*.js
- 世界书：worldbook/*.ts → public/worldbook/

## 当前进度
- ✅ 世界书系统基本完善
- 🔧 交互框架开发中
- ⏳ 待完成：[根据实际情况更新]