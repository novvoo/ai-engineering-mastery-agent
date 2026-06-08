#!/usr/bin/env bun
/**
 * 演示：工作区状态追踪如何解决 Agent "健忘" 问题
 * 
 * 这个脚本模拟了一个典型场景：
 * 1. Agent 执行 list_dir 发现目录中有哪些文件
 * 2. Agent 尝试读取一个不存在的文件（失败）
 * 3. Agent 再次尝试读取同一个不存在的文件（被智能跳过）
 * 4. Agent 可以查询工作区状态
 */

import { WorkspaceState } from './src/core/workspace-state.js';
import { ObservationSummarizer } from './src/core/observation-summarizer.js';
import { createWorkspaceKnowledgeTools } from './src/tools/system/workspace-knowledge.js';

console.log('='.repeat(70));
console.log('  演示：工作区状态追踪如何解决 Agent "健忘" 问题');
console.log('='.repeat(70));
console.log();

// 创建工作区状态和观察提炼器
const workspaceState = new WorkspaceState();
const summarizer = new ObservationSummarizer(workspaceState);
const tools = createWorkspaceKnowledgeTools(workspaceState);

console.log('【场景 1】Agent 首次探索工作区');
console.log('-'.repeat(70));

// 模拟：Agent 执行 list_dir
workspaceState.recordDirectoryListing('/workspace', [
  '/workspace/src',
  '/workspace/tests',
  '/workspace/package.json',
  '/workspace/README.md',
]);

// 模拟：Agent 读取一个存在的文件
const readSuccess = summarizer.processToolResult('read_file', 
  { path: '/workspace/README.md' }, 
  '# AI Engineering Agent\n\nA coding assistant...'
);
console.log('工具: read_file');
console.log('参数: { path: "/workspace/README.md" }');
console.log('结果: ✅ 成功读取文件');
console.log(`提炼: ${readSuccess.summary}`);
console.log();

console.log('【场景 2】Agent 尝试读取不存在的文件');
console.log('-'.repeat(70));

// 模拟：Agent 尝试读取不存在的文件
workspaceState.recordPathNotFound('/workspace/src/nonexistent.js', 'No such file or directory');
const readFail = summarizer.processToolResult('read_file',
  { path: '/workspace/src/nonexistent.js' },
  'Error: No such file or directory'
);
console.log('工具: read_file');
console.log('参数: { path: "/workspace/src/nonexistent.js" }');
console.log('结果: ❌ 文件不存在');
console.log(`提炼: ${readFail.summary}`);
console.log();

// 关键：工作区状态现在知道这个文件不存在
console.log('【场景 3】Agent 再次尝试读取同一个文件（智能跳过）');
console.log('-'.repeat(70));

const prediction = workspaceState.predictToolResult('read_file', { path: '/workspace/src/nonexistent.js' });
console.log('智能预测结果:');
console.log(`  canSkip: ${prediction.canSkip ? '✅ 是' : '❌ 否'}`);
console.log(`  原因: ${prediction.reason}`);
console.log(`  类型: ${prediction.type}`);
console.log();

console.log('【场景 4】Agent 查询工作区状态（使用工具）');
console.log('-'.repeat(70));

// 使用 workspace_knowledge 工具
const knowledgeTool = tools.find(t => t.name === 'workspace_knowledge');
if (knowledgeTool) {
  // 查询已知不存在的路径
  const notFoundResult = await knowledgeTool.handler({
    action: 'get_not_found'
  }, {});
  
  console.log('工具: workspace_knowledge');
  console.log('参数: { action: "get_not_found" }');
  console.log('结果:');
  console.log(JSON.stringify(notFoundResult, null, 2));
  console.log();
  
  // 查询关键事实
  const factsResult = await knowledgeTool.handler({
    action: 'get_facts'
  }, {});
  
  console.log('工具: workspace_knowledge');
  console.log('参数: { action: "get_facts" }');
  console.log('结果:');
  console.log(JSON.stringify(factsResult, null, 2));
  console.log();
}

console.log('【场景 5】使用 workspace_check_operation 预测操作');
console.log('-'.repeat(70));

// 使用 workspace_check_operation 工具
const checkTool = tools.find(t => t.name === 'workspace_check_operation');
if (checkTool) {
  const result = await checkTool.handler({
    tool_name: 'read_file',
    args: { path: '/workspace/src/nonexistent.js' },
    dry_run: true
  }, {});
  
  console.log('工具: workspace_check_operation');
  console.log('参数: { tool_name: "read_file", args: { path: "/workspace/src/nonexistent.js" } }');
  console.log('结果:');
  console.log(JSON.stringify(result, null, 2));
  console.log();
}

console.log('【场景 6】生成工作区状态摘要');
console.log('-'.repeat(70));

const summary = summarizer.generateWorkspaceDescription();
console.log(summary);
console.log();

console.log('='.repeat(70));
console.log('  总结：通过工作区状态追踪，Agent 现在可以：');
console.log('='.repeat(70));
console.log('  ✅ 记住已探索的目录和文件');
console.log('  ✅ 记住不存在的路径');
console.log('  ✅ 智能预测操作结果（避免重复失败）');
console.log('  ✅ 查询已知信息而不重复探索');
console.log('  ✅ 在上下文裁剪时保留关键发现');
console.log('='.repeat(70));
