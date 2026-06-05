#!/usr/bin/env bun
/**
 * AI Engineering Mastery Agent - New Architecture (EXPERIMENTAL)
 *
 * 新架构入口点 - 使用 Runtime Layer
 * 注意：这是实验性的，默认使用原有架构
 */

import {
  createAgentEngine,
  PlatformType,
  getEventBus,
  RuntimeEvent
} from './runtime/index.js';

/**
 * Check if we should use new architecture
 * 检查是否使用新架构（默认不使用）
 */
function shouldUseNewArchitecture() {
  return process.env.USE_NEW_ARCH === 'true';
}

/**
 * Main function - 默认直接调用原有架构
 */
async function main() {
  try {
    if (shouldUseNewArchitecture()) {
      console.log('🚀 Starting with NEW architecture! (EXPERIMENTAL)\n');
      
      // 创建引擎
      const engine = createAgentEngine({
        platform: PlatformType.CLI,
        workingDirectory: process.cwd(),
        debug: process.env.DEBUG === 'true',
        maxIterations: parseInt(process.env.MAX_ITERATIONS || '180')
      });
      
      console.log('✅ New runtime engine created successfully!');
      console.log('⚠️  Full integration coming soon. Running original architecture...\n');
    }
    
    // 默认：直接调用原有架构
    const { default: originalMain } = await import('./index.js');
    return originalMain();
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

// Run
main();
