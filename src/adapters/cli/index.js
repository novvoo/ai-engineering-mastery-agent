/**
 * CLI Adapter Entry Point
 * Provides backward-compatible CLI interface using the new runtime
 */

import { createAgentEngine, PlatformType } from '../../runtime/index.js';
import { getEventBus } from '../../runtime/event-bus.js';
import { CLIUIAdapter } from './ui-adapter.js';

// Import original CLI components for backward compatibility
import { cliUI } from '../../cli/ui.js';
import { EnhancedUI } from '../../cli/enhanced-ui.js';
import { createModelProvider } from '../../models/index.js';
import { registerSecurityPolicies } from '../../core/security-policy.js';

// Import all tool creators
import { createFileSystemTools } from '../../tools/filesystem/filesystem-tools.js';
import { createShellTool } from '../../tools/system/shell.js';
import { createPtyTools, stopAllPtySessions } from '../../tools/system/pty.js';
import { createSemanticSearchTool } from '../../tools/memory/semantic-search.js';
import { createDocumentRagTools } from '../../tools/memory/document-rag.js';
import { createWebTools } from '../../tools/web/web-tools.js';
import { createTaskTools } from '../../tools/scheduler/task-tools.js';
import { createScheduleTools } from '../../tools/scheduler/schedule-tools.js';
import { createSubAgentTools } from '../../tools/scheduler/subagent-tools.js';
import { createGitTools } from '../../tools/git/git-tools.js';
import { createMCPTools } from '../../tools/mcp/mcp-tools.js';
import { shellSandboxConfigFromEnv } from '../../sandbox/shell-sandbox.js';

// Import skill tools
import createBrainstormTool from '../../tools/skills/brainstorm.js';
import createGrillTool from '../../tools/skills/grill.js';
import createTddTool from '../../tools/skills/tdd.js';
import createDiagnoseTool from '../../tools/skills/diagnose.js';
import createVerifyTool from '../../tools/skills/verify.js';
import createReviewTool from '../../tools/skills/review.js';
import createArchitectTool from '../../tools/skills/architect.js';
import createZoomOutTool from '../../tools/skills/zoom_out.js';
import createCavemanTool from '../../tools/skills/caveman.js';
import createHandoffTool from '../../tools/skills/handoff.js';
import createToPrdTool from '../../tools/skills/to_prd.js';
import createToIssuesTool from '../../tools/skills/to_issues.js';
import createSetupTool from '../../tools/skills/setup.js';

/**
 * Register all built-in tools with the engine
 */
async function registerAllTools(engine, options = {}) {
  const sandbox = shellSandboxConfigFromEnv();
  
  // File system tools
  const fsTools = createFileSystemTools();
  engine.registerTools(fsTools);
  
  // Shell tool
  engine.registerTool(createShellTool({ sandbox }));
  
  // PTY tools
  const ptyTools = createPtyTools();
  engine.registerTools(ptyTools);
  
  // Semantic search
  engine.registerTool(createSemanticSearchTool());
  
  // Document RAG tools
  const docTools = createDocumentRagTools();
  engine.registerTools(docTools);
  
  // Web tools
  const webTools = createWebTools();
  engine.registerTools(webTools);
  
  // Git tools
  const gitTools = createGitTools();
  engine.registerTools(gitTools);
  
  // Skill tools
  const skillTools = [
    createBrainstormTool(),
    createGrillTool(),
    createTddTool(),
    createDiagnoseTool(),
    createVerifyTool(),
    createReviewTool(),
    createArchitectTool(),
    createZoomOutTool(),
    createCavemanTool(),
    createHandoffTool(),
    createToPrdTool(),
    createToIssuesTool(),
    createSetupTool(),
  ];
  engine.registerTools(skillTools);
  
  // MCP tools (will be registered separately when MCP client is initialized)
  if (options.mcpClient) {
    const mcpTools = createMCPTools(options.mcpClient);
    engine.registerTools(mcpTools);
  }
  
  // Scheduler tools (will be registered separately with scheduler engine)
  if (options.schedulerEngine) {
    const taskTools = createTaskTools(options.schedulerEngine);
    engine.registerTools(taskTools);
    
    const scheduleTools = createScheduleTools(options.schedulerEngine);
    engine.registerTools(scheduleTools);
    
    const subAgentTools = createSubAgentTools(options.schedulerEngine);
    engine.registerTools(subAgentTools);
  }
}

/**
 * Run the CLI adapter with backward compatibility
 */
export async function runCLIRuntime(options = {}) {
  const workingDirectory = options.workingDirectory || process.cwd();
  const debug = options.debug || false;
  const maxIterations = options.maxIterations || 180;
  const autoDownloadModels = options.autoDownloadModels !== false;
  const modelProviderConfig = options.modelProvider;
  const schedulerEngine = options.schedulerEngine;
  const mcpClient = options.mcpClient;

  // Create the agent engine
  const engine = createAgentEngine({
    platform: PlatformType.CLI,
    workingDirectory,
    debug,
    maxIterations,
    autoDownloadModels
  });

  // Create and attach UI adapter
  const eventBus = getEventBus();
  const uiAdapter = new CLIUIAdapter(eventBus, cliUI);
  uiAdapter.attach();

  try {
    // Initialize engine
    await engine.initialize();

    // Register all tools
    await registerAllTools(engine, { schedulerEngine, mcpClient });

    // Initialize and attach model provider
    let modelProvider;
    if (modelProviderConfig) {
      modelProvider = modelProviderConfig;
    } else {
      const enhancedUI = new EnhancedUI();
      modelProvider = await createModelProvider(workingDirectory, autoDownloadModels, cliUI);
      await enhancedUI.enhanceModelProvider(modelProvider);
    }
    engine.attachModelProvider(modelProvider);

    // Register security policies (backward compatibility)
    const toolRegistry = engine.getToolRegistry();
    const allTools = toolRegistry.getAll();
    registerSecurityPolicies(allTools);

    // Return engine and adapter for use in main
    return {
      engine,
      uiAdapter,
      // Keep backward compatibility with original API
      toolRegistry,
      memoryManager: engine.getMemoryManager(),
      modelProvider,
      securityPolicy: engine.getSecurityPolicy()
    };
  } catch (error) {
    uiAdapter.detach();
    engine.dispose();
    throw error;
  }
}

export { CLIUIAdapter };
