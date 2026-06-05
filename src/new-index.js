#!/usr/bin/env bun
/**
 * AI Engineering Mastery Agent - New Architecture
 * 新架构入口点
 * 
 * Use USE_NEW_ARCH=true to enable
 */

import { clearLine, createInterface, cursorTo, emitKeypressEvents } from 'readline';
import { resolve } from 'path';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { platform } from 'os';
import { input, password, select } from '@inquirer/prompts';

// Runtime imports
import {
  createAgentEngine,
  PlatformType,
  getEventBus,
  RuntimeEvent
} from './runtime/index.js';

// Core imports
import { ToolCategory } from './core/types.js';
import {
  applyRuntimeValues,
  buildMissingConfigMessage,
  getMissingRequiredConfig,
  getProviderBaseUrl,
  getProviderModel,
  getProviderRequirement,
  getUserEnvPath,
  loadRuntimeEnv,
  writeUserEnv,
} from './core/runtime-config.js';

// Model imports
import { OpenAIModelProvider } from './models/openai-provider.js';
import { LlamaModelProvider } from './models/llama-provider.js';
import { ZhipuModelProvider } from './models/zhipu-provider.js';
import { DeepSeekModelProvider } from './models/deepseek-provider.js';
import { OpenRouterModelProvider } from './models/openrouter-provider.js';
import { resolveModelCapabilities } from './models/model-capabilities.js';

// UI imports
import { enhancedUI } from './cli/enhanced-ui.js';
import { createEnhancedCommands } from './cli/enhanced-commands.js';
import {
  buildSlashCommandSuggestions,
  completeSlashCommand,
  formatSlashCommandSuggestions,
  filterSlashCommandSuggestions,
} from './cli/slash-command-suggestions.js';

// Load environment variables
loadRuntimeEnv();

// Check if new architecture is enabled
const USE_NEW_ARCH = process.env.USE_NEW_ARCH === 'true';

/**
 * Main function
 */
async function main() {
  // If not using new arch, delegate to original
  if (!USE_NEW_ARCH) {
    const { default: originalMain } = await import('./index.js');
    return originalMain();
  }

  console.log('🚀 Starting with NEW architecture...');
  console.log('');

  try {
    // Check configuration first
    const missing = getMissingRequiredConfig();
    if (missing.length > 0) {
      console.error('❌ Missing required configuration:', missing);
      console.log('💡 Please run the setup wizard first.');
      process.exit(1);
    }

    // Initialize enhanced UI
    enhancedUI.showBanner();

    // Create engine
    const engine = createAgentEngine({
      platform: PlatformType.CLI,
      workingDirectory: process.env.WORKING_DIRECTORY || process.cwd(),
      debug: process.env.DEBUG === 'true',
      maxIterations: parseInt(process.env.MAX_ITERATIONS || '10'),
    });

    // Setup event forwarding
    const eventBus = getEventBus();
    setupEventForwarding(eventBus);

    // Initialize engine
    await engine.initialize();
    console.log('✅ Engine initialized');

    // Initialize model provider
    const modelProvider = await initializeModelProvider();
    engine.attachModelProvider(modelProvider);
    console.log('✅ Model provider attached');

    // Show tool count
    const tools = engine.getToolRegistry().getAll();
    console.log(`📦 Loaded ${tools.length} tools`);

    // Start interactive mode - in real migration we would port the full REPL here
    console.log('');
    console.log('⚠️  New architecture is in ALPHA stage.');
    console.log('⚠️  Full interactive mode is not yet implemented.');
    console.log('');
    console.log('For now, please use:');
    console.log('  - Original mode: npm start');
    console.log('  - New architecture APIs: see docs/complete-architecture.md');
    console.log('');
    console.log('Testing simple request...');
    console.log('');

    // Cleanup
    await engine.dispose();
    process.exit(0);

  } catch (error) {
    console.error('💥 Fatal error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Initialize model provider based on environment config
 */
async function initializeModelProvider() {
  const provider = process.env.MODEL_PROVIDER || 'openai';
  const model = getProviderModel(provider);
  const apiKey = process.env.OPENAI_API_KEY;
  const apiUrl = getProviderBaseUrl(provider);

  let modelProvider;

  switch (provider) {
    case 'openai':
      modelProvider = new OpenAIModelProvider({ apiKey, baseUrl: apiUrl, model });
      break;
    case 'llama':
      modelProvider = new LlamaModelProvider({ model, maxRetries: 3 });
      break;
    case 'zhipu':
      modelProvider = new ZhipuModelProvider({ apiKey, model });
      break;
    case 'deepseek':
      modelProvider = new DeepSeekModelProvider({ apiKey, model });
      break;
    case 'openrouter':
      modelProvider = new OpenRouterModelProvider({ apiKey, model });
      break;
    default:
      console.warn('⚠️ Unknown provider, defaulting to OpenAI');
      modelProvider = new OpenAIModelProvider({ apiKey, baseUrl: apiUrl, model });
  }

  // Verify model provider works
  try {
    await modelProvider.initialize();
  } catch (error) {
    console.warn('⚠️ Model provider test failed, continuing anyway:', error.message);
  }

  return modelProvider;
}

/**
 * Setup event forwarding to the enhanced UI
 */
function setupEventForwarding(eventBus) {
  // Forward status updates
  eventBus.subscribe(RuntimeEvent.STATUS_UPDATE, (event) => {
    switch (event.level) {
      case 'info':
        console.log(enhancedUI.theme.info(event.message));
        break;
      case 'success':
        console.log(enhancedUI.theme.success(event.message));
        break;
      case 'error':
        console.log(enhancedUI.theme.error(event.message));
        break;
      case 'debug':
        if (process.env.DEBUG === 'true') {
          console.log(enhancedUI.theme.dim(event.message));
        }
        break;
      default:
        console.log(event.message);
    }
  });

  // Forward tool calls
  eventBus.subscribe(RuntimeEvent.TOOL_CALL, (event) => {
    console.log(enhancedUI.theme.dim(`  🔧 Calling: ${event.toolName}`));
  });

  // Forward tool results
  eventBus.subscribe(RuntimeEvent.TOOL_RESULT, (event) => {
    // Don't flood the console with results
  });

  // Forward agent complete
  eventBus.subscribe(RuntimeEvent.AGENT_COMPLETE, (event) => {
    console.log('');
    console.log(enhancedUI.theme.success('✨ Task complete!'));
    console.log('');
  });

  // Forward agent error
  eventBus.subscribe(RuntimeEvent.AGENT_ERROR, (event) => {
    console.error(enhancedUI.theme.error(`❌ Agent error: ${event.error}`));
  });
}

// Run main
main();
