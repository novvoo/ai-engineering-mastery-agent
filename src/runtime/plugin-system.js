/**
 * Plugin System for Runtime Layer
 * 运行时插件系统
 */

export class PluginManager {
  #plugins = new Map();
  #hooks = new Map();
  #eventBus;

  constructor(eventBus) {
    this.#eventBus = eventBus;
  }

  /**
   * Register a plugin
   * 注册插件
   */
  register(plugin) {
    if (!plugin || !plugin.name) {
      throw new Error('Plugin must have a name');
    }
    
    if (this.#plugins.has(plugin.name)) {
      console.warn(`⚠️  Plugin "${plugin.name}" already registered`);
      return;
    }
    
    this.#plugins.set(plugin.name, plugin);
    
    // Initialize plugin
    if (typeof plugin.initialize === 'function') {
      plugin.initialize({
        eventBus: this.#eventBus,
        getEngine: () => null // Will be available after engine initialization
      });
    }
    
    // Register hooks
    if (plugin.hooks) {
      for (const [hookName, hookFn] of Object.entries(plugin.hooks)) {
        this.registerHook(hookName, hookFn);
      }
    }
    
    console.log(`✅ Plugin "${plugin.name}" registered`);
    return true;
  }

  /**
   * Unregister a plugin
   * 注销插件
   */
  unregister(pluginName) {
    const plugin = this.#plugins.get(pluginName);
    if (!plugin) {
      return false;
    }
    
    // Cleanup
    if (typeof plugin.cleanup === 'function') {
      plugin.cleanup();
    }
    
    this.#plugins.delete(pluginName);
    console.log(`🗑️  Plugin "${pluginName}" unregistered`);
    return true;
  }

  /**
   * Register a hook
   * 注册钩子
   */
  registerHook(hookName, hookFn) {
    if (!this.#hooks.has(hookName)) {
      this.#hooks.set(hookName, []);
    }
    this.#hooks.get(hookName).push(hookFn);
  }

  /**
   * Trigger a hook
   * 触发钩子
   */
  async triggerHook(hookName, ...args) {
    const hooks = this.#hooks.get(hookName) || [];
    const results = [];
    
    for (const hook of hooks) {
      try {
        const result = await hook(...args);
        results.push(result);
      } catch (error) {
        console.error(`Error in hook "${hookName}":`, error);
      }
    }
    
    return results;
  }

  /**
   * Get a plugin by name
   * 获取插件
   */
  getPlugin(name) {
    return this.#plugins.get(name);
  }

  /**
   * Get all plugins
   * 获取所有插件
   */
  getAllPlugins() {
    return Array.from(this.#plugins.values());
  }

  /**
   * Get plugin count
   * 获取插件数量
   */
  getPluginCount() {
    return this.#plugins.size;
  }
}

/**
 * Hook constants
 * 钩子常量
 */
export const HOOKS = {
  BEFORE_AGENT_START: 'before_agent_start',
  AFTER_AGENT_START: 'after_agent_start',
  BEFORE_AGENT_STOP: 'before_agent_stop',
  AFTER_AGENT_STOP: 'after_agent_stop',
  
  BEFORE_TOOL_CALL: 'before_tool_call',
  AFTER_TOOL_CALL: 'after_tool_call',
  ON_TOOL_ERROR: 'on_tool_error',
  
  BEFORE_STATUS_UPDATE: 'before_status_update',
  AFTER_STATUS_UPDATE: 'after_status_update',
  
  ON_INPUT_RECEIVED: 'on_input_received',
  ON_OUTPUT_GENERATED: 'on_output_generated',
  
  BEFORE_INIT: 'before_init',
  AFTER_INIT: 'after_init',
  BEFORE_DISPOSE: 'before_dispose',
  AFTER_DISPOSE: 'after_dispose'
};

/**
 * Create a plugin
 * 创建插件的辅助函数
 */
export function createPlugin(config) {
  return {
    name: config.name,
    version: config.version || '1.0.0',
    description: config.description || '',
    initialize: config.initialize,
    cleanup: config.cleanup,
    hooks: config.hooks || {}
  };
}

/**
 * Example plugins
 * 示例插件
 */

export const LoggerPlugin = createPlugin({
  name: 'logger',
  version: '1.0.0',
  description: 'Log all events to console',
  
  hooks: {
    [HOOKS.BEFORE_AGENT_START]: async (input) => {
      console.log('[Logger] Starting agent with input:', input);
    },
    [HOOKS.AFTER_AGENT_COMPLETE]: async (result) => {
      console.log('[Logger] Agent completed with result:', result);
    },
    [HOOKS.BEFORE_TOOL_CALL]: async (toolName, args) => {
      console.log(`[Logger] Calling tool: ${toolName}`, args);
    },
    [HOOKS.ON_TOOL_ERROR]: async (toolName, error) => {
      console.error(`[Logger] Tool ${toolName} failed:`, error);
    }
  }
});

export const PerformancePlugin = createPlugin({
  name: 'performance',
  version: '1.0.0',
  description: 'Track performance metrics',
  
  initialize({ eventBus }) {
    this.startTime = Date.now();
    this.calls = 0;
    this.events = [];
    
    eventBus.subscribe('*', (event) => {
      this.calls++;
      this.events.push({
        type: event.type,
        timestamp: Date.now()
      });
    });
  },
  
  cleanup() {
    console.log(`[Performance] Plugin processed ${this.calls} events in ${Date.now() - this.startTime}ms`);
  },
  
  hooks: {
    [HOOKS.BEFORE_AGENT_START]: async () => {
      this.agentStartTime = Date.now();
    },
    [HOOKS.AFTER_AGENT_COMPLETE]: async () => {
      console.log(`[Performance] Agent took ${Date.now() - this.agentStartTime}ms`);
    }
  }
});
