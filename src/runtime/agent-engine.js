/**
 * Agent Engine - Core runtime for AI agent
 * Platform-agnostic, can be used by both CLI and Desktop
 */

import { RuntimeConfig, AgentState, RuntimeEvent } from './types.js';
import { getEventBus } from './event-bus.js';

// Import core components
import { ReActAgent } from '../core/agent.js';
import { ToolRegistry } from '../core/tool-registry.js';
import { MemoryManager } from '../memory/memory-manager.js';
import { SecurityPolicy } from '../core/security-policy.js';
import { ExperienceMemory } from '../core/experience-memory.js';
import { TokenJuice } from '../core/token-juice.js';

// Import tools
import { createFileSystemTools } from '../tools/filesystem/filesystem-tools.js';
import { createShellTool } from '../tools/system/shell.js';
import { createSemanticSearchTool } from '../tools/memory/semantic-search.js';

export class AgentEngine {
  #config;
  #eventBus;
  #agent;
  #toolRegistry;
  #memoryManager;
  #securityPolicy;
  #experienceMemory;
  #state;
  #isInitialized;

  constructor(config) {
    this.#config = config instanceof RuntimeConfig ? config : new RuntimeConfig(config);
    this.#eventBus = getEventBus();
    this.#state = new AgentState();
    this.#isInitialized = false;
  }

  /**
   * Initialize the agent engine
   */
  async initialize() {
    if (this.#isInitialized) {
      return;
    }

    this.#eventBus.emit(RuntimeEvent.STATUS_UPDATE, {
      status: 'initializing',
      message: 'Initializing AI agent...'
    });

    // Initialize core components
    this.#toolRegistry = new ToolRegistry();
    this.#memoryManager = new MemoryManager(this.#config.workingDirectory);
    this.#securityPolicy = new SecurityPolicy();
    
    // Load memory
    await this.#memoryManager.load();
    
    // Initialize experience memory
    const experienceDir = this.#config.workingDirectory + '/.agent-data';
    this.#experienceMemory = new ExperienceMemory({
      filePath: experienceDir + '/experience-memory.json',
      maxExperiences: 500
    });

    // Register default tools
    await this.#registerDefaultTools();
    
    // Register security policies
    this.#securityPolicy.registerDefaultPolicies(this.#toolRegistry.getAll());

    this.#isInitialized = true;
    this.#eventBus.emit(RuntimeEvent.STATUS_UPDATE, {
      status: 'ready',
      message: 'AI agent ready'
    });
  }

  /**
   * Register the default built-in tools
   */
  async #registerDefaultTools() {
    // File system tools
    const fsTools = createFileSystemTools();
    for (const tool of fsTools) {
      this.#toolRegistry.register(tool);
    }

    // Shell tool
    this.#toolRegistry.register(createShellTool());

    // Semantic search
    this.#toolRegistry.register(createSemanticSearchTool());
  }

  /**
   * Register additional tools
   */
  registerTool(tool) {
    this.#toolRegistry.register(tool);
  }

  /**
   * Register multiple tools
   */
  registerTools(tools) {
    for (const tool of tools) {
      this.#toolRegistry.register(tool);
    }
  }

  /**
   * Get all registered tools
   */
  getTools() {
    return this.#toolRegistry.getAll();
  }

  /**
   * Attach a model provider
   */
  attachModelProvider(modelProvider) {
    this.#config.modelProvider = modelProvider;
  }

  /**
   * Get the current state
   */
  getState() {
    return { ...this.#state };
  }

  /**
   * Get the tool registry
   */
  getToolRegistry() {
    return this.#toolRegistry;
  }

  /**
   * Get the memory manager
   */
  getMemoryManager() {
    return this.#memoryManager;
  }

  /**
   * Get the security policy
   */
  getSecurityPolicy() {
    return this.#securityPolicy;
  }

  /**
   * Get the experience memory
   */
  getExperienceMemory() {
    return this.#experienceMemory;
  }

  /**
   * Process user input and run the agent
   */
  async processInput(input) {
    if (!this.#isInitialized) {
      await this.initialize();
    }

    if (!this.#config.modelProvider) {
      throw new Error('Model provider not attached. Use attachModelProvider() first.');
    }

    this.#state.status = 'running';
    this.#state.currentTask = input;
    this.#state.startTime = Date.now();
    this.#state.iteration = 0;

    this.#eventBus.emit(RuntimeEvent.AGENT_START, {
      task: input,
      timestamp: this.#state.startTime
    });

    // Create agent instance
    this.#agent = new ReActAgent(
      this.#config.modelProvider,
      this.#toolRegistry,
      this.#memoryManager,
      {
        maxIterations: this.#config.maxIterations,
        workingDirectory: this.#config.workingDirectory,
        debug: this.#config.debug,
        securityPolicy: this.#securityPolicy,
        tokenJuice: new TokenJuice()
      },
      this.#createUIFacade()
    );

    try {
      // Wrap tool executions to emit events
      this.#wrapToolCalls();

      // Run agent
      const result = await this.#agent.processInput(input);
      
      this.#state.status = 'completed';
      this.#eventBus.emit(RuntimeEvent.AGENT_COMPLETE, { result });
      
      return result;
    } catch (error) {
      this.#state.status = 'error';
      this.#eventBus.emit(RuntimeEvent.AGENT_ERROR, { error: error.message });
      throw error;
    } finally {
      this.#state.lastActivity = Date.now();
    }
  }

  /**
   * Create a UI facade for the agent (minimal, event-based)
   */
  #createUIFacade() {
    const eventBus = this.#eventBus;
    return {
      info: (message) => {
        eventBus.emit(RuntimeEvent.STATUS_UPDATE, { message, level: 'info' });
      },
      success: (message) => {
        eventBus.emit(RuntimeEvent.STATUS_UPDATE, { message, level: 'success' });
      },
      error: (message) => {
        eventBus.emit(RuntimeEvent.STATUS_UPDATE, { message, level: 'error' });
      },
      debugEvent: (eventName, data) => {
        eventBus.emit(RuntimeEvent.STATUS_UPDATE, { eventName, data, level: 'debug' });
      },
      theme: {
        // Minimal theme for compatibility
        dim: (text) => text,
        success: (text) => text,
        error: (text) => text,
        info: (text) => text
      }
    };
  }

  /**
   * Wrap tool calls to emit events
   */
  #wrapToolCalls() {
    const originalExecute = this.#toolRegistry.execute.bind(this.#toolRegistry);
    const eventBus = this.#eventBus;
    
    this.#toolRegistry.execute = async (toolName, args, context) => {
      eventBus.emit(RuntimeEvent.TOOL_CALL, { toolName, args });
      
      try {
        const result = await originalExecute(toolName, args, context);
        eventBus.emit(RuntimeEvent.TOOL_RESULT, { toolName, result });
        return result;
      } catch (error) {
        eventBus.emit(RuntimeEvent.TOOL_ERROR, { toolName, error: error.message });
        throw error;
      }
    };
  }

  /**
   * Stop the current agent execution
   */
  stop() {
    if (this.#agent && typeof this.#agent.stop === 'function') {
      this.#agent.stop();
    }
    this.#state.status = 'idle';
    this.#eventBus.emit(RuntimeEvent.AGENT_STOP, {});
  }

  /**
   * Dispose the engine and clean up resources
   */
  dispose() {
    this.stop();
    this.#isInitialized = false;
    this.#eventBus.clear();
  }
}
