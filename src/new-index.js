#!/usr/bin/env bun
/**
 * AI Engineering Mastery Agent - New Architecture
 * 
 * 新架构入口点 - 使用 Runtime Layer
 * 向后兼容的同时提供新架构的功能
 */

import {
  createAgentEngine,
  PlatformType,
  getEventBus,
  RuntimeEvent
} from './runtime/index.js';
import { runCLIRuntime } from './adapters/cli/index.js';
import { cliUI } from './cli/ui.js';
import { EnhancedUI } from './cli/enhanced-ui.js';
import { createModelProvider } from './core/runtime-config.js';
import { loadRuntimeEnv, getMissingRequiredConfig } from './core/runtime-config.js';
import {
  OpenAIModelProvider,
  LlamaModelProvider,
  ZhipuModelProvider,
  DeepSeekModelProvider,
  OpenRouterModelProvider
} from './models/index.js';
import { resolveModelCapabilities } from './models/model-capabilities.js';

// Load environment variables
loadRuntimeEnv();

// Constants
const ENHANCED_UI = new EnhancedUI();

/**
 * Check if we should use new architecture
 * 检查是否使用新架构
 */
function shouldUseNewArchitecture() {
  return process.env.USE_NEW_ARCH === 'true';
}

/**
 * Fallback to original architecture if needed
 * 如果需要，回退到原始架构
 */
async function runOriginalArchitecture() {
  console.log('⚠️  Falling back to original architecture...');
  console.log('⚠️  This will run the original src/index.js\n');
  
  // Import original entry point dynamically
  const { default: originalMain } = await import('./index.js');
  return originalMain();
}

/**
 * Run the new architecture
 * 运行新架构
 */
async function runNewArchitecture() {
  console.log('🚀 Starting with NEW architecture!\n');
  
  // Show banner with enhanced UI
  ENHANCED_UI.showBanner();
  
  try {
    // Check runtime config first
    const missing = getMissingRequiredConfig();
    if (missing.length > 0) {
      console.error('❌ Missing required configuration:', missing);
      console.log('💡 Please run the setup wizard first.');
      process.exit(1);
    }
    
    // Setup event listeners for UI
    const eventBus = getEventBus();
    setupEventForwarding(eventBus);
    
    // Run CLI adapter
    console.log('📋 Initializing engine...');
    const { engine, toolRegistry, memoryManager, modelProvider, securityPolicy } = await runCLIRuntime({
      workingDirectory: process.env.WORKING_DIRECTORY || process.cwd(),
      debug: process.env.DEBUG === 'true',
      maxIterations: parseInt(process.env.MAX_ITERATIONS || '180'),
      autoDownloadModels: process.env.AUTO_DOWNLOAD_MODELS !== 'false'
    });
    
    console.log('✅ Engine ready!');
    
    // Show tool summary
    const tools = toolRegistry.getAll();
    console.log(`📦 Loaded ${tools.length} tools\n`);
    
    // Start main loop (simplified for now)
    console.log('💡 Type your request or use /help for commands');
    console.log('💡 Type /exit or /quit to stop\n');
    
    // In full implementation, this would be a complete REPL
    // For now, we show a simple prompt placeholder
    console.log('⚠️  New architecture REPL coming soon!');
    console.log('⚠️  For now, you can use the engine programmatically.');
    console.log('💡 Check examples/ for usage examples\n');
    
    // Return the engine for programmatic use
    return {
      engine,
      toolRegistry,
      memoryManager,
      modelProvider,
      securityPolicy
    };
    
  } catch (error) {
    console.error('❌ Failed to start with new architecture:', error.message);
    
    // Try to fall back to original architecture
    if (process.env.FALLBACK_TO_OLD_ARCH !== 'false') {
      console.log('\n🔄 Attempting to fall back to original architecture...\n');
      return runOriginalArchitecture();
    }
    
    throw error;
  }
}

/**
 * Setup event forwarding to UI
 * 设置事件转发到 UI
 */
function setupEventForwarding(eventBus) {
  // Forward status updates
  eventBus.subscribe(RuntimeEvent.STATUS_UPDATE, (event) => {
    switch (event.level) {
      case 'info':
        if (cliUI && cliUI.info) cliUI.info(event.message);
        break;
      case 'success':
        if (cliUI && cliUI.success) cliUI.success(event.message);
        break;
      case 'error':
        if (cliUI && cliUI.error) cliUI.error(event.message);
        break;
      default:
        console.log(event.message);
    }
  });
  
  // Forward tool calls
  eventBus.subscribe(RuntimeEvent.TOOL_CALL, (event) => {
    console.log(cliUI.theme.dim(`\n🔧 Calling tool: ${event.toolName}`));
  });
  
  // Forward tool errors
  eventBus.subscribe(RuntimeEvent.TOOL_ERROR, (event) => {
    console.log(cliUI.theme.error(`\n❌ Tool failed: ${event.toolName}`));
  });
  
  // Forward agent complete
  eventBus.subscribe(RuntimeEvent.AGENT_COMPLETE, (event) => {
    console.log('\n✨ Task complete!');
  });
  
  // Forward agent errors
  eventBus.subscribe(RuntimeEvent.AGENT_ERROR, (event) => {
    console.log('\n❌ Agent error:', event.error);
  });
}

/**
 * Main function
 */
async function main() {
  try {
    if (shouldUseNewArchitecture()) {
      return await runNewArchitecture();
    } else {
      // Default to original architecture for backward compatibility
      const { default: originalMain } = await import('./index.js');
      return originalMain();
    }
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

// Run
main();
