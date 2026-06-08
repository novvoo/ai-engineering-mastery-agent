# 工作区状态追踪改进说明

## 问题背景

原始的 ReAct Agent 存在"健忘"问题：
- Agent 前几轮看过目录有什么，但后面就忘了
- Agent 尝试读取一个已知不存在的文件，浪费迭代
- 上下文裁剪后，关键的工作区发现丢失

## 解决方案

### 1. WorkspaceState 类 (`src/core/workspace-state.js`)

追踪工作区的状态和关键事实：

```javascript
const workspaceState = new WorkspaceState();

// 记录目录探索
workspaceState.recordDirectoryListing('/workspace/src', ['core', 'tools', 'runtime']);

// 记录文件不存在
workspaceState.recordPathNotFound('/workspace/src/nonexistent.js', 'No such file');

// 记录文件读取成功
workspaceState.recordFileRead('/workspace/src/core/agent.js', true, result);

// 检查路径
workspaceState.checkPathExists('/workspace/src/core/agent.js'); // 'exists'
workspaceState.checkPathExists('/workspace/src/nonexistent.js'); // 'not_found'

// 智能预测
workspaceState.predictToolResult('read_file', { path: '/workspace/src/nonexistent.js' });
// 返回: { canSkip: true, reason: '...', type: 'will_fail' }
```

### 2. ObservationSummarizer 类 (`src/core/observation-summarizer.js`)

将工具结果转化为结构化事实：

```javascript
const summarizer = new ObservationSummarizer(workspaceState);

const processed = summarizer.processToolResult('read_file', args, result);
// 返回: { summary, facts, shouldCache }
```

### 3. 工作区知识工具 (`src/tools/system/workspace-knowledge.js`)

两个新工具让 Agent 可以主动查询工作区状态：

#### workspace_knowledge

```
workspace_knowledge({
  action: 'check_path',      // 检查路径是否存在
  path: '/workspace/src/file.js'
})

workspace_knowledge({
  action: 'query',           // 查询相关事实
  query: 'file',
  limit: 10
})

workspace_knowledge({
  action: 'get_facts'        // 获取所有关键事实
})

workspace_knowledge({
  action: 'get_not_found'    // 获取所有已知不存在的路径
})
```

#### workspace_check_operation

```
workspace_check_operation({
  tool_name: 'read_file',
  args: { path: '/workspace/src/file.js' },
  dry_run: true
})
```

### 4. ReActAgent 集成

Agent 现在自动：

1. **追踪所有文件操作结果**
2. **智能预测操作结果**（在执行前跳过已知会失败的操作）
3. **在上下文裁剪时保留关键发现**

```javascript
// Agent 会自动跳过这类操作：
// 如果之前 read_file('/workspace/src/nonexistent.js') 失败过，
// Agent 再次尝试时会收到警告并跳过
```

### 5. 上下文裁剪改进

当触发上下文裁剪时，Agent 会自动注入工作区状态摘要：

```markdown
## 工作区探索状态 (Context Trimmed)

工作区已探索: 15 个文件, 3 个目录
已知不存在的路径: 2 个

### 已知不存在的路径 (避免重复尝试)
- /workspace/src/nonexistent.js
- /workspace/tests/missing.js

### 关键发现
- directory_listing: /workspace/src 包含 12 个条目
- file_readable: /workspace/src/core/agent.js
```

## 使用示例

运行演示脚本查看完整功能：

```bash
bun demo-workspace-state.mjs
```

## API 参考

### WorkspaceState

| 方法 | 说明 |
|------|------|
| `recordDirectoryListing(path, entries)` | 记录目录内容 |
| `recordPathNotFound(path, reason)` | 记录不存在的路径 |
| `recordFileRead(path, success, result)` | 记录文件读取结果 |
| `recordFileWrite(path)` | 记录文件写入 |
| `checkPathExists(path)` | 检查路径状态 |
| `predictToolResult(toolName, args)` | 预测操作结果 |
| `queryFacts(query, limit)` | 查询相关事实 |
| `getCriticalFacts()` | 获取高优先级事实 |
| `getSummary()` | 获取状态摘要 |

### ObservationSummarizer

| 方法 | 说明 |
|------|------|
| `processToolResult(toolName, args, result)` | 处理工具结果 |
| `generateContextSummary(maxFacts)` | 生成上下文摘要 |
| `generateWorkspaceDescription()` | 生成自然语言描述 |

### ReActAgent 新增

| 属性/方法 | 说明 |
|------|------|
| `workspaceState` | 获取工作区状态实例 |
| `getWorkspaceSummary()` | 获取工作区状态摘要 |
| `clearSession(clearWorkspace)` | 可选清除工作区状态 |

## 效果对比

### 改进前
```
Iteration 1: list_dir /workspace → 发现 10 个文件
Iteration 2: list_dir /workspace → 重复探索
Iteration 5: read_file /workspace/nonexistent.js → 失败
Iteration 6: read_file /workspace/nonexistent.js → 又失败
Iteration 10: (上下文裁剪后忘记) read_file /workspace/nonexistent.js → 再次失败
```

### 改进后
```
Iteration 1: list_dir /workspace → 发现 10 个文件，记住
Iteration 2: list_dir /workspace → 跳过，提示"已探索"
Iteration 3: read_file /workspace/nonexistent.js → 失败，记住不存在
Iteration 4: read_file /workspace/nonexistent.js → 智能跳过，提示"已知不存在"
...
Context Trimming: 注入工作区摘要
Iteration 10: read_file /workspace/nonexistent.js → 智能跳过
```
