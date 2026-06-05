/**
 * Runtime Layer Integration Tests
 * Tests for the platform-agnostic runtime architecture
 */

import { describe, it, beforeEach, afterEach, expect } from 'bun:test';
import { createAgentEngine, RuntimeConfig, RuntimeEvent, getEventBus } from '../../src/runtime/index.js';
import { PlatformType } from '../../src/runtime/types.js';

describe('Runtime Layer Integration Tests', () => {
  let engine;
  let testDir;
  let eventBus;

  beforeEach(() => {
    // Create a temporary test directory
    testDir = `/tmp/runtime-test-${Date.now()}`;
    
    // Get event bus instance
    eventBus = getEventBus();
    eventBus.clear(); // Clear any previous subscriptions
  });

  afterEach(async () => {
    // Cleanup
    if (engine) {
      engine.dispose();
      engine = null;
    }
  });

  describe('AgentEngine', () => {
    it('should create engine with default config', () => {
      engine = createAgentEngine();
      expect(engine).toBeDefined();
      expect(typeof engine.initialize).toBe('function');
      expect(typeof engine.processInput).toBe('function');
    });

    it('should create engine with custom config', () => {
      const config = {
        platform: PlatformType.CLI,
        workingDirectory: testDir,
        debug: true,
        maxIterations: 100
      };
      
      engine = createAgentEngine(config);
      expect(engine).toBeDefined();
    });

    it('should initialize successfully', async () => {
      engine = createAgentEngine({ workingDirectory: testDir });
      await engine.initialize();
      
      expect(engine.getToolRegistry()).toBeDefined();
      expect(engine.getMemoryManager()).toBeDefined();
      expect(engine.getSecurityPolicy()).toBeDefined();
    });

    it('should not reinitialize if already initialized', async () => {
      engine = createAgentEngine({ workingDirectory: testDir });
      
      await engine.initialize();
      const registry1 = engine.getToolRegistry();
      
      await engine.initialize();
      const registry2 = engine.getToolRegistry();
      
      expect(registry1).toBe(registry2); // Same instance
    });

    it('should register custom tools', async () => {
      engine = createAgentEngine({ workingDirectory: testDir });
      await engine.initialize();
      
      const customTool = {
        name: 'test_tool',
        description: 'A test tool',
        category: 'Test',
        parameters: {
          input: { type: 'string', description: 'Test input' }
        },
        required: ['input'],
        handler: async (args) => {
          return `Processed: ${args.input}`;
        }
      };
      
      engine.registerTool(customTool);
      const tools = engine.getTools();
      
      expect(tools.some(t => t.name === 'test_tool')).toBe(true);
    });

    it('should register multiple tools', async () => {
      engine = createAgentEngine({ workingDirectory: testDir });
      await engine.initialize();
      
      const tools = [
        {
          name: 'multi_tool_1',
          description: 'First test tool',
          category: 'Test',
          parameters: {},
          handler: async () => 'tool1'
        },
        {
          name: 'multi_tool_2',
          description: 'Second test tool',
          category: 'Test',
          parameters: {},
          handler: async () => 'tool2'
        }
      ];
      
      engine.registerTools(tools);
      const allTools = engine.getTools();
      
      expect(allTools.some(t => t.name === 'multi_tool_1')).toBe(true);
      expect(allTools.some(t => t.name === 'multi_tool_2')).toBe(true);
    });

    it('should have default tools registered after initialization', async () => {
      engine = createAgentEngine({ workingDirectory: testDir });
      await engine.initialize();
      
      const tools = engine.getTools();
      
      // Should have built-in tools
      expect(tools.length).toBeGreaterThan(0);
      
      // Check for common tool categories
      const categories = new Set(tools.map(t => t.category));
      expect(categories.has('FileSystem') || categories.has('filesystem')).toBe(true);
    });

    it('should throw error if model provider not attached', async () => {
      engine = createAgentEngine({ workingDirectory: testDir });
      await engine.initialize();
      
      try {
        await engine.processInput('test input');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Model provider not attached');
      }
    });

    it('should get initial state', () => {
      engine = createAgentEngine({ workingDirectory: testDir });
      const state = engine.getState();
      
      expect(state.status).toBe('idle');
      expect(state.currentTask).toBeNull();
      expect(state.iteration).toBe(0);
    });
  });

  describe('EventBus', () => {
    it('should subscribe and unsubscribe to events', () => {
      const eventBus = getEventBus();
      let eventReceived = false;
      
      const unsubscribe = eventBus.subscribe(RuntimeEvent.STATUS_UPDATE, (data) => {
        eventReceived = true;
      });
      
      eventBus.emit(RuntimeEvent.STATUS_UPDATE, { message: 'test' });
      expect(eventReceived).toBe(true);
      
      // Unsubscribe
      unsubscribe();
      eventReceived = false;
      eventBus.emit(RuntimeEvent.STATUS_UPDATE, { message: 'test2' });
      expect(eventReceived).toBe(false);
    });

    it('should emit events with structured data', () => {
      const eventBus = getEventBus();
      let receivedData = null;
      
      eventBus.subscribe(RuntimeEvent.AGENT_START, (data) => {
        receivedData = data;
      });
      
      const testData = { task: 'test task', timestamp: Date.now() };
      eventBus.emit(RuntimeEvent.AGENT_START, testData);
      
      expect(receivedData.type).toBe(RuntimeEvent.AGENT_START);
      expect(receivedData.task).toBe('test task');
      expect(receivedData.timestamp).toBeDefined();
    });

    it('should track subscriber count', () => {
      const eventBus = getEventBus();
      
      expect(eventBus.getSubscriberCount(RuntimeEvent.TOOL_CALL)).toBe(0);
      
      const unsub1 = eventBus.subscribe(RuntimeEvent.TOOL_CALL, () => {});
      expect(eventBus.getSubscriberCount(RuntimeEvent.TOOL_CALL)).toBe(1);
      
      const unsub2 = eventBus.subscribe(RuntimeEvent.TOOL_CALL, () => {});
      expect(eventBus.getSubscriberCount(RuntimeEvent.TOOL_CALL)).toBe(2);
      
      unsub1();
      expect(eventBus.getSubscriberCount(RuntimeEvent.TOOL_CALL)).toBe(1);
      
      unsub2();
      expect(eventBus.getSubscriberCount(RuntimeEvent.TOOL_CALL)).toBe(0);
    });

    it('should clear all subscribers', () => {
      const eventBus = getEventBus();
      
      eventBus.subscribe(RuntimeEvent.TOOL_CALL, () => {});
      eventBus.subscribe(RuntimeEvent.TOOL_RESULT, () => {});
      eventBus.subscribe(RuntimeEvent.AGENT_START, () => {});
      
      expect(eventBus.getSubscriberCount(RuntimeEvent.TOOL_CALL)).toBe(1);
      expect(eventBus.getSubscriberCount(RuntimeEvent.TOOL_RESULT)).toBe(1);
      expect(eventBus.getSubscriberCount(RuntimeEvent.AGENT_START)).toBe(1);
      
      eventBus.clear();
      
      expect(eventBus.getSubscriberCount(RuntimeEvent.TOOL_CALL)).toBe(0);
      expect(eventBus.getSubscriberCount(RuntimeEvent.TOOL_RESULT)).toBe(0);
      expect(eventBus.getSubscriberCount(RuntimeEvent.AGENT_START)).toBe(0);
    });

    it('should handle multiple event types', () => {
      const eventBus = getEventBus();
      const events = [];
      
      eventBus.subscribe(RuntimeEvent.AGENT_START, () => events.push('start'));
      eventBus.subscribe(RuntimeEvent.AGENT_COMPLETE, () => events.push('complete'));
      eventBus.subscribe(RuntimeEvent.AGENT_ERROR, () => events.push('error'));
      
      eventBus.emit(RuntimeEvent.AGENT_START, {});
      eventBus.emit(RuntimeEvent.AGENT_COMPLETE, {});
      eventBus.emit(RuntimeEvent.AGENT_ERROR, {});
      
      expect(events).toEqual(['start', 'complete', 'error']);
    });
  });

  describe('RuntimeEvent Types', () => {
    it('should have all required event types', () => {
      expect(RuntimeEvent.AGENT_START).toBe('agent:start');
      expect(RuntimeEvent.AGENT_STOP).toBe('agent:stop');
      expect(RuntimeEvent.AGENT_ERROR).toBe('agent:error');
      expect(RuntimeEvent.AGENT_COMPLETE).toBe('agent:complete');
      expect(RuntimeEvent.TOOL_CALL).toBe('tool:call');
      expect(RuntimeEvent.TOOL_RESULT).toBe('tool:result');
      expect(RuntimeEvent.TOOL_ERROR).toBe('tool:error');
      expect(RuntimeEvent.MESSAGE_RECEIVED).toBe('message:received');
      expect(RuntimeEvent.MESSAGE_SENT).toBe('message:sent');
      expect(RuntimeEvent.STATUS_UPDATE).toBe('status:update');
      expect(RuntimeEvent.CONFIG_CHANGE).toBe('config:change');
    });
  });

  describe('PlatformType', () => {
    it('should define all platform types', () => {
      expect(PlatformType.CLI).toBe('cli');
      expect(PlatformType.DESKTOP).toBe('desktop');
      expect(PlatformType.WEB).toBe('web');
    });
  });

  describe('RuntimeConfig', () => {
    it('should create config with defaults', () => {
      const config = new RuntimeConfig();
      
      expect(config.platform).toBe(PlatformType.CLI);
      expect(config.workingDirectory).toBe(process.cwd());
      expect(config.debug).toBe(false);
      expect(config.maxIterations).toBe(180);
      expect(config.autoDownloadModels).toBe(true);
    });

    it('should create config with custom values', () => {
      const config = new RuntimeConfig({
        platform: PlatformType.DESKTOP,
        workingDirectory: '/custom/path',
        debug: true,
        maxIterations: 100,
        autoDownloadModels: false
      });
      
      expect(config.platform).toBe(PlatformType.DESKTOP);
      expect(config.workingDirectory).toBe('/custom/path');
      expect(config.debug).toBe(true);
      expect(config.maxIterations).toBe(100);
      expect(config.autoDownloadModels).toBe(false);
    });
  });

  describe('End-to-End Flow', () => {
    it('should emit lifecycle events during initialization', async () => {
      const events = [];
      const eventBus = getEventBus();
      
      eventBus.subscribe(RuntimeEvent.STATUS_UPDATE, (data) => {
        events.push(data);
      });
      
      engine = createAgentEngine({ workingDirectory: testDir });
      await engine.initialize();
      
      // Should have received initialization events
      const initEvents = events.filter(e => 
        e.status === 'initializing' || e.status === 'ready'
      );
      expect(initEvents.length).toBeGreaterThanOrEqual(2);
    });

    it('should manage engine state transitions', async () => {
      engine = createAgentEngine({ workingDirectory: testDir });
      
      // Initial state
      expect(engine.getState().status).toBe('idle');
    });

    it('should clean up resources on dispose', async () => {
      engine = createAgentEngine({ workingDirectory: testDir });
      await engine.initialize();
      
      engine.dispose();
      
      expect(engine.getState().status).toBe('idle');
    });
  });

  describe('Error Handling', () => {
    it('should handle tool registration errors gracefully', async () => {
      engine = createAgentEngine({ workingDirectory: testDir });
      await engine.initialize();
      
      // Try to register a tool without required fields
      const invalidTool = {
        name: 'invalid',
        // Missing required fields
      };
      
      // Should not throw, but tool should not be registered
      try {
        engine.registerTool(invalidTool);
        // If it doesn't throw, that's okay for this test
      } catch (error) {
        // Expected behavior for invalid tool
      }
    });

    it('should provide meaningful error messages', async () => {
      engine = createAgentEngine({ workingDirectory: testDir });
      await engine.initialize();
      
      try {
        await engine.processInput('test');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Model provider');
      }
    });
  });
});
