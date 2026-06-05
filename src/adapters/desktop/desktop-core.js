/**
 * Desktop Integration Core
 * 桌面集成核心
 * This provides the core functionality for Desktop app integration
 */

import {
  createAgentEngine,
  PlatformType,
  getEventBus,
  RuntimeEvent,
  HOOKS
} from '../runtime/index.js';
import { createPlugin } from '../runtime/plugin-system.js';

/**
 * Desktop Adapter Core
 */
export class DesktopCore {
  #config;
  #engine;
  #eventBus;
  #uiBridge;
  #isInitialized;

  constructor(config = {}) {
    this.#config = {
      workingDirectory: config.workingDirectory || process.cwd(),
      debug: config.debug || false,
      maxIterations: config.maxIterations || 180,
      autoDownloadModels: config.autoDownloadModels !== false,
      ...config
    };
    
    this.#eventBus = getEventBus();
    this.#isInitialized = false;
  }

  /**
   * Initialize the desktop core
   */
  async initialize() {
    if (this.#isInitialized) {
      return;
    }

    console.log('🖥️  Initializing Desktop Core...');

    // Create agent engine
    this.#engine = createAgentEngine({
      platform: PlatformType.DESKTOP,
      ...this.#config
    });

    await this.#engine.initialize();
    
    // Setup UI bridge
    this.#setupUIBridge();
    
    this.#isInitialized = true;
    console.log('✅ Desktop Core ready!');
  }

  /**
   * Setup UI bridge
   */
  #setupUIBridge() {
    const self = this;
    
    // Forward runtime events to UI
    this.#eventBus.subscribe(RuntimeEvent.STATUS_UPDATE, (event) => {
      self.#sendToUI('status_update', event);
    });
    
    this.#eventBus.subscribe(RuntimeEvent.AGENT_START, (event) => {
      self.#sendToUI('agent_start', event);
    });
    
    this.#eventBus.subscribe(RuntimeEvent.AGENT_STOP, (event) => {
      self.#sendToUI('agent_stop', event);
    });
    
    this.#eventBus.subscribe(RuntimeEvent.AGENT_COMPLETE, (event) => {
      self.#sendToUI('agent_complete', event);
    });
    
    this.#eventBus.subscribe(RuntimeEvent.AGENT_ERROR, (event) => {
      self.#sendToUI('agent_error', event);
    });
    
    this.#eventBus.subscribe(RuntimeEvent.TOOL_CALL, (event) => {
      self.#sendToUI('tool_call', event);
    });
    
    this.#eventBus.subscribe(RuntimeEvent.TOOL_RESULT, (event) => {
      self.#sendToUI('tool_result', event);
    });
    
    this.#eventBus.subscribe(RuntimeEvent.TOOL_ERROR, (event) => {
      self.#sendToUI('tool_error', event);
    });
  }

  /**
   * Send message to UI
   */
  #sendToUI(type, data) {
    const message = {
      type,
      data,
      timestamp: Date.now()
    };
    
    // In a real Electron app, this would use IPC
    // For now, we'll log and provide a way to hook
    if (this.#uiBridge) {
      this.#uiBridge.onMessage(message);
    } else {
      console.log(`📤 [Desktop] To UI: ${type}`, data);
    }
  }

  /**
   * Attach UI bridge
   */
  attachUIBridge(bridge) {
    this.#uiBridge = bridge;
  }

  /**
   * Process input from UI
   */
  async processInput(input) {
    if (!this.#isInitialized) {
      await this.initialize();
    }
    
    this.#sendToUI('input_received', { input });
    
    try {
      const result = await this.#engine.processInput(input);
      this.#sendToUI('output_ready', { result });
      return result;
    } catch (error) {
      this.#sendToUI('error', { error: error.message });
      throw error;
    }
  }

  /**
   * Stop the agent
   */
  stop() {
    if (this.#engine) {
      this.#engine.stop();
    }
  }

  /**
   * Get the agent engine
   */
  getEngine() {
    return this.#engine;
  }

  /**
   * Get the current state
   */
  getState() {
    return {
      initialized: this.#isInitialized,
      engineState: this.#engine ? this.#engine.getState() : null
    };
  }

  /**
   * Attach model provider
   */
  attachModelProvider(modelProvider) {
    if (this.#engine) {
      this.#engine.attachModelProvider(modelProvider);
    }
  }

  /**
   * Register tool
   */
  registerTool(tool) {
    if (this.#engine) {
      this.#engine.registerTool(tool);
    }
  }

  /**
   * Get registered tools
   */
  getTools() {
    if (this.#engine) {
      return this.#engine.getTools();
    }
    return [];
  }

  /**
   * Dispose
   */
  async dispose() {
    if (this.#engine) {
      await this.#engine.dispose();
    }
    this.#isInitialized = false;
  }
}

/**
 * UI Bridge interface
 */
export class UIBridge {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Called when a message is received from core
   */
  onMessage(message) {
    const listeners = this.listeners.get(message.type) || [];
    for (const listener of listeners) {
      try {
        listener(message);
      } catch (error) {
        console.error('Error in UI bridge listener:', error);
      }
    }
  }

  /**
   * Subscribe to message type
   */
  subscribe(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(callback);
    
    return () => {
      // Unsubscribe
      const callbacks = this.listeners.get(type);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Send message to core (placeholder)
   */
  sendToCore(type, data) {
    console.log(`📥 [UI] To Core: ${type}`, data);
  }
}

/**
 * Desktop Plugin - specific for desktop apps
 */
export const DesktopPlugin = createPlugin({
  name: 'desktop',
  version: '1.0.0',
  description: 'Desktop integration plugin',
  
  initialize({ eventBus }) {
    console.log('🖥️  Desktop plugin initialized');
    
    this.desktopInfo = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version
    };
  },
  
  hooks: {
    [HOOKS.BEFORE_INIT]: async (config) => {
      console.log('🖥️  Desktop plugin - before init with config:', config);
    },
    [HOOKS.AFTER_INIT]: async (engine) => {
      console.log('🖥️  Desktop plugin - engine initialized');
    }
  }
});

/**
 * Factory function for desktop core
 */
export function createDesktopCore(config = {}) {
  return new DesktopCore(config);
}

export default {
  DesktopCore,
  UIBridge,
  DesktopPlugin,
  createDesktopCore
};
