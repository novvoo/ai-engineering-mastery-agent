/**
 * Migration Bridge - Compatibility layer for old and new architectures
 * 迁移桥接 - 新旧架构的兼容层
 */

import {
  createAgentEngine,
  PlatformType,
  getEventBus,
  RuntimeEvent
} from '../runtime/index.js';
import { runCLIRuntime } from '../adapters/cli/index.js';

/**
 * Migration helper
 * 迁移辅助工具
 */
export class MigrationBridge {
  #useNewArch;
  #engine;
  #oldComponents;

  constructor(options = {}) {
    this.#useNewArch = options.useNewArchitecture || process.env.USE_NEW_ARCH === 'true';
    this.#oldComponents = {};
  }

  /**
   * Initialize the bridge
   */
  async initialize() {
    if (this.#useNewArch) {
      console.log('🔄 Initializing new architecture...');
      this.#engine = createAgentEngine({
        platform: PlatformType.CLI,
        workingDirectory: process.cwd(),
        debug: process.env.DEBUG === 'true',
        maxIterations: parseInt(process.env.MAX_ITERATIONS || '180'),
        autoDownloadModels: process.env.AUTO_DOWNLOAD_MODELS !== 'false'
      });
      await this.#engine.initialize();
      console.log('✅ New architecture ready!');
    }
  }

  /**
   * Get the engine (if using new arch)
   */
  getEngine() {
    if (!this.#useNewArch) {
      console.warn('⚠️  Not using new architecture, engine not available');
      return null;
    }
    return this.#engine;
  }

  /**
   * Store old components for backward compatibility
   */
  setOldComponents(components) {
    this.#oldComponents = components;
  }

  /**
   * Get component (from new arch if available, else old)
   */
  getComponent(componentName) {
    if (this.#useNewArch) {
      switch (componentName) {
        case 'toolRegistry':
          return this.#engine?.getToolRegistry();
        case 'memoryManager':
          return this.#engine?.getMemoryManager();
        case 'securityPolicy':
          return this.#engine?.getSecurityPolicy();
        case 'pluginManager':
          return this.#engine?.getPluginManager();
        default:
          return this.#oldComponents[componentName];
      }
    }
    return this.#oldComponents[componentName];
  }

  /**
   * Check if new architecture is in use
   */
  isUsingNewArchitecture() {
    return this.#useNewArch;
  }

  /**
   * Toggle architecture at runtime
   */
  async toggleArchitecture(useNewArch) {
    if (this.#useNewArch === useNewArch) {
      return;
    }
    
    console.log(`🔄 Switching to ${useNewArch ? 'new' : 'old'} architecture...`);
    
    // Cleanup
    if (this.#engine) {
      await this.#engine.dispose();
      this.#engine = null;
    }
    
    this.#useNewArch = useNewArch;
    
    if (useNewArch) {
      await this.initialize();
    }
  }

  /**
   * Migrate tool from old format to new
   */
  migrateTool(oldTool) {
    // Simple migration - keep most fields
    return {
      name: oldTool.name,
      description: oldTool.description,
      category: oldTool.category || 'Uncategorized',
      parameters: oldTool.parameters || {},
      required: oldTool.required || [],
      handler: oldTool.execute || oldTool.handler
    };
  }

  /**
   * Get migration status report
   */
  getStatusReport() {
    return {
      usingNewArchitecture: this.#useNewArch,
      engineAvailable: !!this.#engine,
      oldComponents: Object.keys(this.#oldComponents),
      timestamp: Date.now()
    };
  }
}

/**
 * Create a compatibility layer that works with both architectures
 * 创建同时兼容新旧架构的层
 */
export function createCompatibilityLayer(options = {}) {
  const bridge = new MigrationBridge(options);
  
  return {
    bridge,
    
    /**
     * Initialize
     */
    async initialize() {
      await bridge.initialize();
    },
    
    /**
     * Create a tool registry (compatible)
     */
    getToolRegistry() {
      if (bridge.isUsingNewArchitecture()) {
        return bridge.getEngine().getToolRegistry();
      }
      return bridge.getComponent('toolRegistry');
    },
    
    /**
     * Get memory manager
     */
    getMemoryManager() {
      if (bridge.isUsingNewArchitecture()) {
        return bridge.getEngine().getMemoryManager();
      }
      return bridge.getComponent('memoryManager');
    },
    
    /**
     * Get plugin manager (only in new arch)
     */
    getPluginManager() {
      if (bridge.isUsingNewArchitecture()) {
        return bridge.getEngine().getPluginManager();
      }
      return null;
    }
  };
}

/**
 * Migrate config from old format to new
 */
export function migrateConfig(oldConfig) {
  return {
    platform: PlatformType.CLI,
    workingDirectory: oldConfig.workingDirectory || process.cwd(),
    debug: oldConfig.debug || false,
    maxIterations: oldConfig.maxIterations || 180,
    autoDownloadModels: oldConfig.autoDownloadModels !== false,
    modelProvider: oldConfig.modelProvider
  };
}

/**
 * Migration progress tracker
 */
export class MigrationProgress {
  #total;
  #completed;
  #tasks;

  constructor() {
    this.#total = 0;
    this.#completed = 0;
    this.#tasks = [];
  }

  addTask(name, description) {
    this.#tasks.push({
      name,
      description,
      status: 'pending',
      startTime: null,
      endTime: null,
      error: null
    });
    this.#total++;
  }

  async startTask(index) {
    if (this.#tasks[index]) {
      this.#tasks[index].status = 'in_progress';
      this.#tasks[index].startTime = Date.now();
    }
  }

  completeTask(index) {
    if (this.#tasks[index]) {
      this.#tasks[index].status = 'completed';
      this.#tasks[index].endTime = Date.now();
      this.#completed++;
    }
  }

  failTask(index, error) {
    if (this.#tasks[index]) {
      this.#tasks[index].status = 'failed';
      this.#tasks[index].endTime = Date.now();
      this.#tasks[index].error = error;
    }
  }

  getProgress() {
    return {
      total: this.#total,
      completed: this.#completed,
      percentage: this.#total > 0 ? (this.#completed / this.#total) * 100 : 0,
      tasks: this.#tasks
    };
  }

  reset() {
    this.#total = 0;
    this.#completed = 0;
    this.#tasks = [];
  }
}

export default {
  MigrationBridge,
  createCompatibilityLayer,
  migrateConfig,
  MigrationProgress
};
