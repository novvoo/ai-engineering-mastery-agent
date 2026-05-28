# AI Engineering Mastery Agent

一个生产级的 AI 工程 Agent，支持完整的任务规划、执行、记忆和评估体系。

## 核心特性

### 1. 安全执行层 (Sandbox Executor)
- 资源限制 (CPU, 内存, 时间)
- 网络隔离
- 文件系统沙盒
- 权限控制
- 支持多种执行环境 (Node.js, Python)

### 2. 图任务规划器 (Graph Planner)
- Plan → Subtasks → Dependencies
- DAG (有向无环图) 依赖管理
- 并行执行优化
- 动态重规划
- 关键路径分析
- Mermaid 图导出

### 3. 三层记忆系统
- **Episodic Memory**: 情景记忆 (具体事件/经历)
- **Semantic Memory**: 语义记忆 (知识/概念)
- **Summary Memory**: 摘要记忆 (压缩总结)
- **Context Compression**: 上下文压缩

### 4. Agent Eval 评估框架
- Golden Cases (黄金用例)
- Regression Suite (回归测试套件)
- 多维度评估指标:
  - 功能: Correctness, Completeness, Precision
  - 性能: Latency, Token Usage, Cost
  - 安全: Safety, Hallucination
  - 体验: Helpfulness, Clarity

### 5. MCP / Tool Protocol 支持
- MCP (Model Context Protocol)
- JSON-RPC 2.0
- Remote Tools
- HTTP/WebSocket/STDIO 传输
- Tool Discovery

## 快速开始

### 安装

```bash
# 克隆仓库
git clone <repository-url>
cd ai-engineering-mastery-agent

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，添加你的 API 密钥
```

### 启动

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

### 测试

```bash
# 运行所有测试
npm test

# 运行特定测试套件
npm run test:unit
npm run test:integration
npm run test:core
npm run test:security
```

## 使用示例

### 1. 使用 Sandbox Executor

```javascript
import { SandboxExecutor } from './src/sandbox/sandbox-executor.js';

const executor = new SandboxExecutor({
  timeout: 30000,
  memoryLimit: 512 * 1024 * 1024,
  networkEnabled: false
});

const result = await executor.execute('echo', ['Hello, World!']);
console.log(result.stdout);
```

### 2. 使用 Graph Planner

```javascript
import { GraphPlanner } from './src/planner/graph-planner.js';

const planner = new GraphPlanner();

// 创建计划
const plan = planner.createPlan('代码审查', '审查项目代码');

// 分解任务
planner.decomposeTask(plan.id, '全面代码审查', {
  template: 'code_review',
  actions: {
    analyze_code: async () => { /* ... */ },
    check_style: async () => { /* ... */ }
  }
});

// 执行计划
await planner.executePlan(plan.id, executor);
```

### 3. 使用三层记忆系统

```javascript
import { AdvancedMemoryManager } from './src/memory/advanced-memory.js';

const memory = new AdvancedMemoryManager();

// 添加情景记忆
memory.addEpisodic('用户要求重构 login 函数', {
  importance: 0.8,
  tags: ['refactoring', 'login']
});

// 添加语义记忆
memory.addSemantic('project_structure', {
  src: '源代码目录',
  tests: '测试文件目录'
});

// 检索记忆
const results = memory.retrieve('login 重构', {
  type: 'episodic',
  limit: 5
});
```

### 4. 使用 MCP Client

```javascript
import { HTTPMCPClient, MCPToolAdapter } from './src/mcp/mcp-client.js';

// 创建 MCP 客户端
const client = new HTTPMCPClient({
  baseUrl: 'http://localhost:3000'
});

await client.connect();

// 发现工具
const tools = await client.discoverTools();

// 调用工具
const result = await client.callTool('search_code', {
  query: 'function login'
});

// 适配为内部工具格式
const adapter = new MCPToolAdapter(client);
const adaptedTools = await adapter.getAllTools();
```

### 5. 使用 Agent Eval

```javascript
import { EvalRunner } from './src/eval/agent-eval.js';

const evalRunner = new EvalRunner();

// 加载评估案例
evalRunner.loadCases('./eval/golden_cases/cases.json');

// 运行评估
const results = await evalRunner.run(agent, {
  filters: { goldenOnly: true }
});

console.log(results.summary);
```

## 项目结构

```
ai-engineering-mastery-agent/
├── src/
│   ├── sandbox/          # 安全执行层
│   │   └── sandbox-executor.js
│   ├── planner/          # 图任务规划器
│   │   └── graph-planner.js
│   ├── memory/           # 记忆系统
│   │   ├── memory-manager.js
│   │   └── advanced-memory.js
│   ├── mcp/              # MCP 协议支持
│   │   └── mcp-client.js
│   ├── eval/             # 评估框架
│   │   └── agent-eval.js
│   ├── core/             # 核心模块
│   ├── cli/              # 命令行接口
│   ├── models/           # LLM 提供者
│   ├── tools/            # 工具实现
│   └── ...
├── eval/                 # 评估案例
│   ├── golden_cases/     # 黄金用例
│   └── regression_suite/ # 回归测试套件
├── test-*.mjs           # 测试文件
└── package.json
```

## 测试覆盖

- **单元测试**: 39 个
- **集成测试**: 18 个
- **核心功能测试**: 49 个
- **安全测试**: 13 个
- **总计**: 119 个测试

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    Agent Core                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Planner    │  │   Memory     │  │   Sandbox    │      │
│  │  (Graph)     │  │  (3-Layer)   │  │  (Executor)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    Tool Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Local Tools │  │  MCP Tools   │  │ Remote Tools │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## 许可证

MIT
