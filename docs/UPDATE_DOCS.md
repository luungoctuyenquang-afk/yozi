
```markdown
# 自动文档更新指南

## 快速更新命令

### 完成功能后
```

claude-code “功能[功能名]已完成，文件改动：[列出文件]。请更新CHANGELOG.md和MODULE_MAP.md”

```
### 修复Bug后
```

claude-code “修复了[问题]，请在CHANGELOG.md记录，并更新DEBUG_GUIDE.md的常见问题部分”

```
### 每周文档审查
```

claude-code “请审查所有docs/*.md文档，找出过时信息并更新。重点检查MODULE_MAP.md的文件路径是否准确”

```
## 文档更新规则

1. **CHANGELOG.md**
   - 按日期倒序
   - 分类：新增/修改/修复/移除
   - 包含文件路径

2. **MODULE_MAP.md**
   - 新文件必须添加
   - 删除文件必须移除
   - 依赖关系要更新

3. **AI_HANDOFF.md**
   - 每个里程碑更新一次
   - 记录关键决策
   - 更新常见任务指引

4. **ARCHITECTURE.md**
   - 架构变更时更新
   - 新增全局对象要记录
   - 数据流改变要说明
```
