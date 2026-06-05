/**
 * Runtime Layer Type Definitions
 * Shared types for both CLI and Desktop platforms
 */

/**
 * Platform types
 */
export const PlatformType = {
  CLI: 'cli',
  DESKTOP: 'desktop',
  WEB: 'web'
};

/**
 * Event types for the event bus
 */
export const RuntimeEvent = {
  AGENT_START: 'agent:start',
  AGENT_STOP: 'agent:stop',
  AGENT_ERROR: 'agent:error',
  AGENT_COMPLETE: 'agent:complete',
  
  TOOL_CALL: 'tool:call',
  TOOL_RESULT: 'tool:result',
  TOOL_ERROR: 'tool:error',
  
  MESSAGE_RECEIVED: 'message:received',
  MESSAGE_SENT: 'message:sent',
  
  STATUS_UPDATE: 'status:update',
  CONFIG_CHANGE: 'config:change'
};

/**
 * Runtime configuration
 */
export class RuntimeConfig {
  constructor(options = {}) {
    this.platform = options.platform || PlatformType.CLI;
    this.workingDirectory = options.workingDirectory || process.cwd();
    this.debug = options.debug || false;
    this.modelProvider = options.modelProvider;
    this.autoDownloadModels = options.autoDownloadModels !== false;
    this.maxIterations = options.maxIterations || 180;
  }
}

/**
 * Agent state
 */
export class AgentState {
  constructor() {
    this.status = 'idle'; // idle, running, completed, error
    this.currentTask = null;
    this.iteration = 0;
    this.startTime = null;
    this.lastActivity = null;
  }
}

/**
 * Tool execution context
 */
export class ToolContext {
  constructor(options = {}) {
    this.workingDirectory = options.workingDirectory;
    this.memoryManager = options.memoryManager;
    this.securityPolicy = options.securityPolicy;
    this.debug = options.debug || false;
  }
}
