# State-Centric Editing Architecture

## 核心架构原则

**Hash Anchor 解决"改哪里"，动态上下文扩展解决"为什么这样改"；只有两者同时存在，才能既降低编辑成本，又不牺牲代码理解能力。**

### 最重要的洞察

> Hash Anchor 的价值不是"减少上下文"，而是**按需加载（load on demand）**而非预加载（preload everything）。
> 
> 减少上下文只是副作用，**按需获取正确上下文才是避免幻觉的关键**。

---

## 概述

本实现将 oh-my-pi 的 State-Centric Editing（状态驱动编辑）架构思想集成到现有 Agent 系统中，通过 Hash-Anchored Editing 和 On-Demand Context Expansion 的组合，解决了传统 Context-Centric Editing 的若干问题。

## 核心架构

### 两层解耦

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Layer 1: Hash-Anchored Editing (定位层)                       │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  • Content Addressable Store                            │   │
│   │  • Hash-Anchored Patch System                          │   │
│   │  • State Graph                                         │   │
│   │                                                          │   │
│   │  职责: 解决"改哪里" - 稳定的定位机制                     │   │
│   └─────────────────────────────────────────────────────────┘   │
│                            ↕                                    │
│                            ↓                                    │
│   Layer 2: On-Demand Context Expansion (理解层)                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  • Symbol Index (符号索引)                               │   │
│   │  • Dependency Graph (依赖关系图)                        │   │
│   │  • AST Metadata (AST 元数据)                            │   │
│   │  • Context Expansion Engine (上下文扩展引擎)             │   │
│   │                                                          │   │
│   │  职责: 解决"为什么这样改" - 代码理解能力                 │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

         模型生成的是"基于证据的修改意图"
         而非"基于不完整上下文的代码臆测"
```

### 核心组件

#### 1. Content Addressing System (`src/core/harness/content-addressing.js`)

基于 Git 风格的内容寻址存储系统：

```typescript
- ContentAddressableStore
  - store(type, data) -> hash
  - get(hash) -> object
  - storeBlob(content) -> hash
  - storeAnchor(path, start, end, text) -> hash

- FileAnalyzer
  - analyzeFile(path, content) -> { fileHash, anchors }
  - analyzeByBlocks(path, content) -> { fileHash, blocks }
```

**特点**：
- 每个内容片段有唯一的哈希标识
- 支持按行或按代码块分析
- 类似 Git 的不可变对象存储

#### 2. Hash-Anchored Patch System (`src/core/harness/hash-anchored-patch.js`)

基于内容哈希的补丁系统：

```typescript
- HashAnchoredPatcher
  - applyPatch(content, intent) -> result
  - applyPatches(content, intents[]) -> result
  - initializeFile(path, content) -> analysis

- PatchIntent (REPLACE | INSERT | DELETE | MODIFY)
  - type: PatchIntentType
  - anchorHash: string
  - content?: string

- StateGraph
  - createInitialNode(path, content) -> hash
  - createNodeFromPatch(parentHash, patch, content) -> hash
  - rollbackTo(hash) -> boolean
  - getHistory(limit) -> history
```

**特点**：
- 基于内容而非位置定位
- 支持回滚和历史追踪
- 模糊匹配增强鲁棒性

#### 3. Symbol Index (`src/core/harness/symbol-index.js`)

符号索引系统，提供代码中所有符号的快速查找能力：

```typescript
- SymbolIndex
  - indexFile(filePath) -> symbols
  - findByName(name) -> symbols
  - findByType(type) -> symbols
  - getSymbolContext(file, line, contextLines) -> { symbol, context }
  - getSymbolWithDependencies(symbol, maxDepth) -> { symbol, deps, context }
```

**特点**：
- 支持函数、类、方法、变量、导入等符号
- 提供符号的完整上下文
- 支持依赖追踪

#### 4. Dependency Graph (`src/core/harness/dependency-graph.js`)

依赖关系图，构建和维护代码库中的依赖关系：

```typescript
- DependencyGraph
  - addFile(filePath) -> dependencies
  - getDirectDependencies(file) -> deps
  - getTransitiveDependencies(file, depth) -> deps
  - getDependents(file) -> files
  - analyzeImpact(file) -> impact analysis
  - findPath(from, to) -> path
```

**特点**：
- 支持 ES6 import 和 CommonJS require
- 提供影响分析（修改会影响的文件）
- 支持传递依赖追踪

#### 5. AST Metadata Extractor (`src/core/harness/ast-metadata.js`)

AST 元数据提取器，提供代码的 AST 级别信息：

```typescript
- ASTMetadataExtractor
  - extract(filePath) -> { functions, classes, regions }
  - getFunctionMetadata(file, name) -> metadata
  - getClassMetadata(file, name) -> metadata
  - getCodeRegion(file, line) -> region
```

**特点**：
- 提取函数签名、参数、返回类型
- 估算圈复杂度
- 提取函数调用和引用关系

#### 6. On-Demand Context Expansion (`src/core/harness/on-demand-context.js`)

按需上下文扩展系统，是避免幻觉的核心：

```typescript
- OnDemandContextExpansion
  - indexProject(dir, patterns) -> { files, symbols }
  - assessConfidence(request) -> { level, reason, expansionNeeded, suggestions }
  - expandContext(request) -> ExpandedContext
  - generateEvidenceBasedIntent(request) -> EvidenceBasedChangeIntent
  - getSymbolFullContext(symbol, file?) -> full context
```

**核心职责**：
- 检测模型对当前上下文的置信度
- 按需扩展上下文（而非预加载）
- 生成基于证据的修改意图
- 识别潜在副作用

### 7. 上下文扩展工具 (`src/tools/harness/context-expansion.js`)

Agent 可用的上下文扩展工具：

| 工具 | 描述 |
|------|------|
| `context_index` | 索引项目文件，构建索引系统 |
| `context_assess` | 评估上下文置信度 |
| `context_expand` | 按需扩展上下文 |
| `context_expand_symbol` | 获取符号的完整上下文 |
| `context_query` | 查询符号和依赖关系 |
| `context_evidence` | 生成基于证据的修改意图 |
| `context_stats` | 获取索引统计信息 |

---

## 架构对比

### Context-Centric (传统方式)

```
┌─────────────────────────────────────┐
│                                     │
│  Model reads full file content      │
│  into context window                │
│                                     │
│  Model determines line numbers      │
│  and generates complete new code    │
│                                     │
│  Apply text patch based on lines    │
│                                     │
└─────────────────────────────────────┘
         Costs: O(file size)
         Problems: 
           - Line numbers unstable
           - Context bloat
           - Memory dependent
           - Hard to rollback
           - Hallucination due to incomplete context
```

### Hash-Anchored Only (不完整方案)

```
┌─────────────────────────────────────┐
│                                     │
│  Model uses anchor hashes           │
│  to locate modification targets     │
│                                     │
│  But lacks understanding            │
│  of why this change is correct      │
│                                     │
│  Still prone to hallucination       │
│                                     │
└─────────────────────────────────────┘
         Problems:
           - Knows WHERE to change
           - But not WHY
           - May make wrong decisions
           - No code comprehension
```

### Hash-Anchored + On-Demand Context (完整方案)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────────────────┐        ┌──────────────────────────┐  │
│  │ 定位层               │        │ 理解层                    │  │
│  │                      │        │                          │  │
│  │ Hash Anchors         │◄──────►│ On-Demand Context        │  │
│  │ • 稳定定位           │        │ • Symbol Index           │  │
│  │ • 内容哈希           │        │ • Dependency Graph       │  │
│  │ • State Graph       │        │ • AST Metadata           │  │
│  │                      │        │ • Confidence Assessment  │  │
│  └──────────────────────┘        └──────────────────────────┘  │
│              │                                  │               │
│              │                                  │               │
│              │    ┌─────────────────────────────┘               │
│              │    │                                             │
│              ▼    ▼                                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Model: "What to change"                               │    │
│  │  生成基于证据的修改意图，而非基于不完整上下文的臆测       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
         Costs: O(change size) + O(required context)
         Benefits:
           - Stable positioning
           - Code understanding
           - Evidence-based decisions
           - Hallucination prevention
           - Load on demand
```

---

## 工作流程示例

### 完整编辑流程（带上下文扩展）

```
1. 索引项目
   └─ context_index ["**/*.js", "**/*.ts"]
   └─ Returns: files indexed, symbols found

2. 评估上下文置信度
   └─ context_assess file=src/agent.js line=42
   └─ Returns: confidence level + suggestions

3. 按需扩展上下文（如果需要）
   └─ context_expand file=src/agent.js line=42 dependency_level=2
   └─ Returns: expanded context with dependencies

4. 生成基于证据的修改意图
   └─ context_evidence file=src/agent.js change_type=modify description="..."
   └─ Returns: evidence-based change intent with confidence

5. 使用 Hash-Anchored 编辑
   └─ harness_analyze file=src/agent.js
   └─ harness_replace file=src/agent.js anchor_hash=abc123 new_content="..."
   └─ Creates new state node

6. 查询和回滚
   └─ harness_query history
   └─ harness_rollback target_hash
```

### 避免幻觉的完整流程

```
Context-Centric (容易幻觉):
──────────────────────────────
Iteration 1: read large_file.js (500 lines) → context full
Iteration 2: edit function X → don't know about dependencies
Iteration 3: edit function Y → forgot about function X
Iteration 4: edit function Z → complete disconnection
→ Hallucination: changes may break other functions

Hash-Anchored + On-Demand (避免幻觉):
──────────────────────────────────────
Iteration 1: context_index → build indexes
Iteration 2: context_assess function X → confidence: medium
Iteration 3: context_expand function X → load dependencies
Iteration 4: context_evidence "modify function X" → evidence-based intent
Iteration 5: harness_replace anchor_hash → precise, evidence-based change
→ No hallucination: all changes are evidence-based
```

---

## 核心优势

### 1. 按需加载 vs 预加载

**预加载（传统方式）**：
- 启动时加载整个代码库
- 上下文窗口快速膨胀
- 无关信息稀释关键信息
- 幻觉风险高

**按需加载（本架构）**：
- 只加载实际需要的上下文
- 按置信度评估触发扩展
- 每次扩展都有明确目的
- 基于证据决策，幻觉风险低

### 2. 避免幻觉

**模型生成的是**：
- ✅ 基于证据的修改意图 (Evidence-Based Change Intent)
- ✅ 带有置信度评估
- ✅ 附带支持事实和缺失信息列表

**而非**：
- ❌ 基于不完整上下文的代码臆测
- ❌ 盲目生成的修改
- ❌ 缺乏验证的假设

### 3. 编辑成本优化

- O(change size) 而非 O(file size)
- 减少不必要的 Token 消耗
- 上下文扩展成本可控

### 4. 定位稳定性

- 基于内容哈希，不依赖行号
- 代码移动、插入不影响锚点有效性

### 5. 状态连续性

- 迭代 N 可引用迭代 1 的锚点
- 不依赖 LLM 的记忆能力

### 6. 职责分离

- 模型：描述变化 + 生成意图 (What)
- Harness：定位执行 + 上下文管理 (Where/How)
- Runtime：置信度评估 + 按需扩展 (When/Why)

---

## 文件结构

```
src/
├── core/
│   └── harness/
│       ├── content-addressing.js      # Content Addressable Store
│       ├── hash-anchored-patch.js     # Patcher + State Graph
│       ├── symbol-index.js            # Symbol Index
│       ├── dependency-graph.js         # Dependency Graph
│       ├── ast-metadata.js            # AST Metadata Extractor
│       └── on-demand-context.js      # On-Demand Context Expansion
├── tools/
│   └── harness/
│       ├── state-centric-tools.js      # Hash-Anchored Editing Tools
│       └── context-expansion.js       # Context Expansion Tools
└── runtime/
    └── agent-engine.js               # (集成了新工具)
```

---

## 下一步改进方向

### 1. 持久化存储
- 将索引系统持久化到磁盘
- 跨会话保持状态
- 支持增量索引

### 2. 置信度优化
- 基于 LLM 反馈的置信度校准
- 历史决策置信度追踪
- 主动学习机制

### 3. 锚点质量提升
- 更智能的代码块分析（AST 级别）
- 多粒度锚点（函数/块/行）
- 语义锚点（基于嵌入）

### 4. 冲突解决
- 分支和合并策略
- 三方合并支持
- 并发编辑协调

### 5. 工具扩展
- 批量修改工具
- 重构专用工具
- 测试生成辅助

### 6. 优化
- 锚点前缀匹配优化
- 智能缓存策略
- 并行索引构建

---

## 示例

运行演示脚本：

```bash
bun demo-state-centric-editing.mjs
```

查看完整演示：
- 对比 Context-Centric vs State-Centric
- 展示完整工作流程
- 展示优势特性

---

## 核心要点总结

### 最重要的架构洞察

> **Hash Anchor 的价值不是"减少上下文"，而是"按需加载（load on demand）而非预加载（preload everything）"。减少上下文只是副作用，按需获取正确上下文才是避免幻觉的关键。**

### 两个职责的解耦

| 职责 | 组件 | 解决的问题 |
|------|------|-----------|
| **定位** | Hash-Anchored Editing | "改哪里" |
| **理解** | On-Demand Context Expansion | "为什么这样改" |

### 只有两者同时存在

才能既**降低编辑成本**，又**不牺牲代码理解能力**，从根本上**避免幻觉**。
