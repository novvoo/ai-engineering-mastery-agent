/**
 * Enhanced Workspace Integration for ReAct Agent
 * 
 * 这个模块将 WorkspaceState 和 ObservationSummarizer 集成到 ReAct Agent 中
 * 解决 Agent "健忘" 的问题
 */

import { WorkspaceState } from './workspace-state.js';
import { ObservationSummarizer } from './observation-summarizer.js';
import { createWorkspaceKnowledgeTools } from '../tools/system/workspace-knowledge.js';

/**
 * 创建增强的工作区集成
 * @param {object} options
 * @returns {object}
 */
export function createEnhancedWorkspace(options = {}) {
  const {
    toolRegistry,
    includeToolsInRegistry = true,
  } = options;

  // 创建核心组件
  const workspaceState = new WorkspaceState();
  const observationSummarizer = new ObservationSummarizer(workspaceState);

  // 注册工具到工具注册表
  if (toolRegistry && includeToolsInRegistry) {
    const tools = createWorkspaceKnowledgeTools(workspaceState);
    for (const tool of tools) {
      // 包装 handler 以包含 summarizer 引用
      const wrappedTool = {
        ...tool,
        handler: async (args, context) => {
          return await tool.handler(args, {
            ...context,
            observationSummarizer,
            workspaceState,
          });
        },
      };
      toolRegistry.register(wrappedTool);
    }
  }

  return {
    workspaceState,
    observationSummarizer,
    
    /**
     * 处理工具结果并更新工作区状态
     * @param {string} toolName
     * @param {object} args
     * @param {any} result
     * @returns {object} 处理后的摘要
     */
    processToolResult(toolName, args, result) {
      const processed = observationSummarizer.processToolResult(toolName, args, result);
      
      // 添加到观察历史
      this.#addToObservationHistory(toolName, args, processed);
      
      return processed;
    },

    /** @type {Array} */
    #observationHistory: [],

    /**
     * 添加到观察历史
     */
    #addToObservationHistory(toolName, args, processed) {
      this.#observationHistory.push({
        toolName,
        args,
        summary: processed.summary,
        facts: processed.facts,
        timestamp: Date.now(),
      });

      // 限制历史大小
      if (this.#observationHistory.length > 100) {
        this.#observationHistory = this.#observationHistory.slice(-50);
      }
    },

    /**
     * 检查工具调用是否可能失败（基于已有观察）
     * @param {string} toolName
     * @param {object} args
     * @returns {{ canSkip: boolean, reason: string, predicted: any }}
     */
    checkToolPrediction(toolName, args) {
      return workspaceState.predictToolResult(toolName, args);
    },

    /**
     * 检查路径是否存在
     * @param {string} path
     * @returns {'exists' | 'not_found' | 'unknown'}
     */
    checkPathExists(path) {
      return workspaceState.checkPathExists(path);
    },

    /**
     * 生成上下文保留建议
     * 在上下文裁剪时使用，保留关键事实
     */
    getContextPreservationHint() {
      const summary = workspaceState.getSummary();
      const criticalFacts = workspaceState.getCriticalFacts();
      const workspaceDescription = observationSummarizer.generateWorkspaceDescription();

      return {
        // 关键事实摘要（应该在裁剪时保留）
        preserveFacts: criticalFacts.map(f => ({
          type: f.type,
          value: f.value,
        })),
        
        // 工作区状态概述
        workspaceSummary: summary,
        
        // 自然语言描述（可以直接注入到系统提示）
        workspaceDescription,
        
        // 已知不存在的路径（避免重复尝试）
        knownNonExistent: Array.from(
          new Set(
            criticalFacts
              .filter(f => f.type === 'path_not_found')
              .map(f => f.value?.path)
              .filter(Boolean)
          )
        ),
        
        // 建议在系统提示中包含的信息
        systemPromptAddition: this.#generateSystemPromptAddition(),
      };
    },

    /**
     * 生成应添加到系统提示的内容
     */
    #generateSystemPromptAddition() {
      const hint = this.getContextPreservationHint();
      
      if (hint.knownNonExistent.length === 0) {
        return '';
      }

      return `
## 工作区探索状态
${hint.workspaceDescription}

### 已知不存在的路径（避免重复尝试读取）
${hint.knownNonExistent.map(p => `- ${p}`).join('\n')}

### 关键发现
${hint.preserveFacts.slice(-5).map(f => `- ${f.type}: ${JSON.stringify(f.value)}`).join('\n')}
`;
    },

    /**
     * 获取工作区状态
     */
    getState() {
      return workspaceState.export();
    },

    /**
     * 恢复工作区状态
     */
    restoreState(state) {
      if (state) {
        workspaceState.import(state);
      }
    },

    /**
     * 清除所有工作区状态
     */
    clear() {
      workspaceState.clear();
      this.#observationHistory = [];
    },

    /**
     * 获取工具调用建议
     * 在执行工具前调用，帮助决定是否应该执行
     */
    getToolAdvice(toolName, args) {
      const prediction = workspaceState.predictToolResult(toolName, args);
      
      return {
        prediction,
        recentObservations: this.#observationHistory
          .filter(o => o.toolName === toolName)
          .slice(-3)
          .map(o => o.summary),
        suggestion: prediction.canSkip
          ? `⚠️  基于之前的观察，此操作很可能会失败: ${prediction.reason}`
          : prediction.type === 'will_succeed'
          ? `✅  此路径已确认存在，可以继续`
          : `ℹ️  建议使用 workspace_knowledge 工具查询后再决定`,
      };
    },
  };
}

export default createEnhancedWorkspace;
