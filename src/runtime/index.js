/**
 * Runtime Layer Entry Point
 * Export shared components for both CLI and Desktop platforms
 */

// Types
export * from './types.js';

// Event Bus
export { RuntimeEventBus, getEventBus } from './event-bus.js';

// Agent Engine
export { AgentEngine } from './agent-engine.js';

// Plugin System
export * from './plugin-system.js';

// Convenience factory
import { AgentEngine } from './agent-engine.js';
import { RuntimeConfig } from './types.js';

/**
 * Create a new Agent Engine instance
 */
export function createAgentEngine(config = {}) {
  return new AgentEngine(config);
}

/**
 * Default runtime export
 */
export default {
  AgentEngine,
  RuntimeConfig,
  createAgentEngine
};
