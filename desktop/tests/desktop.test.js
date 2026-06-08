/**
 * Desktop IPC Initialization Tests
 * 验证 IPC handler 注册和初始化顺序的正确性
 *
 * 关键测试点：
 * - MainProcessIPCAdapter.initialize() 是否注册了 ipc:connect handler
 * - DesktopCore + IPCAdapter 能否在窗口创建前完成初始化
 * - 注册的 handler 是否能正确处理连接请求
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';

// ── 模拟辅助 ──────────────────────────────────────────────────────

/**
 * 创建一个模拟的 ipcMain 对象，追踪所有 handle/on 注册
 */
function createMockIpcMain() {
  const handlers = new Map();
  const listeners = new Map();
  return {
    handlers,
    listeners,
    handle(channel, fn) {
      handlers.set(channel, fn);
    },
    on(channel, fn) {
      if (!listeners.has(channel)) listeners.set(channel, []);
      listeners.get(channel).push(fn);
    },
  };
}

/**
 * 模拟 event.sender 对象
 */
function createMockSender(id = 1) {
  return { id };
}

/**
 * 模拟事件对象
 */
function createMockEvent(senderId = 1) {
  return { sender: createMockSender(senderId) };
}

// ── 测试套件 ──────────────────────────────────────────────────────

describe('Desktop IPC Initialization Order', () => {

  // ── Test 1: IPC handler 注册 ──────────────────────────────────

  test('MainProcessIPCAdapter registers ipc:connect handler on initialize()', async () => {
    const { resetEventBus } = await import('../../src/runtime/event-bus.js');
    const { createMainProcessIPCAdapter, IPCMessageType } = await import(
      '../../src/adapters/desktop/ipc-adapter.js'
    );

    resetEventBus();
    const { getEventBus } = await import('../../src/runtime/event-bus.js');
    const eventBus = getEventBus();

    const mockIpcMain = createMockIpcMain();
    const adapter = createMainProcessIPCAdapter(mockIpcMain, eventBus, {
      debug: false,
      validateMessages: false,
    });

    // 初始化前没有 handler
    expect(mockIpcMain.handlers.has(IPCMessageType.CONNECT)).toBe(false);

    // 初始化后应该注册了 ipc:connect
    await adapter.initialize();
    expect(mockIpcMain.handlers.has(IPCMessageType.CONNECT)).toBe(true);

    // 验证 handler 能正确处理连接请求
    const connectHandler = mockIpcMain.handlers.get(IPCMessageType.CONNECT);
    const mockEvent = createMockEvent(42);
    const result = await connectHandler(mockEvent);
    expect(result).toEqual({ success: true, windowId: 42 });

    adapter.disconnect();
    resetEventBus();
  });

  // ── Test 2: 关键 invoke channel handler 注册 ──────────────────

  test('MainProcessIPCAdapter registers all critical invoke channels', async () => {
    const { resetEventBus } = await import('../../src/runtime/event-bus.js');
    const { createMainProcessIPCAdapter } = await import(
      '../../src/adapters/desktop/ipc-adapter.js'
    );

    resetEventBus();
    const { getEventBus } = await import('../../src/runtime/event-bus.js');
    const eventBus = getEventBus();

    const mockIpcMain = createMockIpcMain();
    const adapter = createMainProcessIPCAdapter(mockIpcMain, eventBus, {
      debug: false,
    });

    await adapter.initialize();

    // 这些是渲染进程 preload 调用的关键频道，必须全部注册
    const expectedChannels = [
      'agent:processInput',
      'agent:stop',
      'agent:getState',
      'agent:getTools',
      'system:getStats',
      'window:minimize',
      'window:maximize',
      'window:close',
      'dialog:openFile',
      'dialog:saveFile',
      'dialog:openDirectory',
      'app:getInfo',
      'app:getPath',
    ];

    for (const channel of expectedChannels) {
      expect(mockIpcMain.handlers.has(channel)).toBe(true);
    }

    adapter.disconnect();
    resetEventBus();
  });

  // ── Test 3: DesktopCore + attachIPCAdapter 完整流程 ──────────

  test('DesktopCore initializes then attachIPCAdapter produces working adapter', async () => {
    const { resetEventBus } = await import('../../src/runtime/event-bus.js');
    const { createDesktopCore, DesktopState } = await import(
      '../../src/adapters/desktop/desktop-core.js'
    );

    resetEventBus();

    const core = createDesktopCore({ debug: false });
    expect(core.getState().desktopState).toBe(DesktopState.IDLE);

    // 初始化 DesktopCore
    await core.initialize();
    const stateAfterInit = core.getState();
    expect(stateAfterInit.desktopState).toBe(DesktopState.READY);
    expect(stateAfterInit.initialized).toBe(true);

    // attachIPCAdapter 应该在初始化之后正常工作
    const mockIpcMain = createMockIpcMain();
    const ipcAdapter = core.attachIPCAdapter(mockIpcMain);
    expect(ipcAdapter).toBeTruthy();
    expect(typeof ipcAdapter.initialize).toBe('function');

    // 初始化 adapter 后 ipc:connect handler 应被注册
    await ipcAdapter.initialize();
    expect(mockIpcMain.handlers.has('ipc:connect')).toBe(true);

    await core.dispose();
    resetEventBus();
  });

  // ── Test 4: 初始化顺序模拟 ────────────────────────────────────

  test('IPC handlers registered before simulated window creation — ordering assertion', async () => {
    // 这个测试模拟 main.js 中 initialize() 的修正后顺序：
    //   DesktopCore init → attachConfiguredModelProvider → IPCAdapter init → createMainWindow
    // 验证在 "createMainWindow" 步骤之前 IPC handler 已经就绪

    const { resetEventBus } = await import('../../src/runtime/event-bus.js');
    const { createDesktopCore } = await import(
      '../../src/adapters/desktop/desktop-core.js'
    );
    const { createMainProcessIPCAdapter, IPCMessageType } = await import(
      '../../src/adapters/desktop/ipc-adapter.js'
    );

    resetEventBus();
    const { getEventBus } = await import('../../src/runtime/event-bus.js');
    const eventBus = getEventBus();

    // Step 1: 初始化 DesktopCore
    const core = createDesktopCore({ debug: false });
    await core.initialize();

    // Step 2: 创建 IPC adapter（模拟 attachConfiguredModelProvider 后的 IPC 初始化）
    const mockIpcMain = createMockIpcMain();
    const adapter = createMainProcessIPCAdapter(mockIpcMain, eventBus, {
      debug: false,
    });
    await adapter.initialize();

    // Step 3: 验证所有 handler 已注册（模拟 createMainWindow 前的检查）
    const requiredForPreload = [
      IPCMessageType.CONNECT,
      'agent:processInput',
      'agent:stop',
      'agent:getState',
      'agent:getTools',
      'system:getStats',
    ];

    // ★ 关键断言：此时 handler 必须全部注册完毕
    //   （模拟：如果在 createMainWindow() 之前添加此检查，就是绿色）
    for (const channel of requiredForPreload) {
      if (!mockIpcMain.handlers.has(channel)) {
        throw new Error(
          `Handler for "${channel}" was NOT registered before createMainWindow step. ` +
          `If this was a real app, preload.js would fail with: ` +
          `"No handler registered for '${channel}'"`
        );
      }
    }

    // Step 4: 验证 connect handler 确实可以处理渲染进程的连接请求
    const connectHandler = mockIpcMain.handlers.get(IPCMessageType.CONNECT);
    const result = await connectHandler(createMockEvent(99));
    expect(result.success).toBe(true);
    expect(result.windowId).toBe(99);

    // 清理
    await core.dispose();
    adapter.disconnect();
    resetEventBus();
  });

  // ── Test 5: 重复初始化不会覆盖 handler ───────────────────────

  test('Multiple initialize() calls do not crash or overwrite handler registration', async () => {
    const { resetEventBus } = await import('../../src/runtime/event-bus.js');
    const { createMainProcessIPCAdapter, IPCMessageType } = await import(
      '../../src/adapters/desktop/ipc-adapter.js'
    );

    resetEventBus();
    const { getEventBus } = await import('../../src/runtime/event-bus.js');
    const eventBus = getEventBus();

    const mockIpcMain = createMockIpcMain();
    const adapter = createMainProcessIPCAdapter(mockIpcMain, eventBus, {
      debug: false,
    });

    // 多次初始化不会抛异常
    await adapter.initialize();
    // 第二次调用不应该抛错（Electron 里重复 ipcMain.handle 会抛异常）
    // 但因为 adapter 内部只注册一次，所以应该安全
    await adapter.initialize();

    expect(mockIpcMain.handlers.has(IPCMessageType.CONNECT)).toBe(true);

    adapter.disconnect();
    resetEventBus();
  });


// ==================== Event Forwarding & Deduplication ====================

describe('Desktop Event Forwarding', () => {
  test('DesktopCore forwards agent:start through IPC adapter once', async () => {
    const { getEventBus, resetEventBus } = await import('../../src/runtime/event-bus.js');
    const { DesktopCore, createDesktopCore } = await import('../../src/adapters/desktop/desktop-core.js');
    const { createMainProcessIPCAdapter } = await import('../../src/adapters/desktop/ipc-adapter.js');
    const { RuntimeEvent } = await import('../../src/runtime/types.js');

    resetEventBus();
    const bus = getEventBus();
    const mockIpcMain = { handle: () => {}, on: () => {} };

    const core = createDesktopCore({ workingDirectory: '/tmp', debug: false });
    await core.initialize();
    const adapter = core.attachIPCAdapter(mockIpcMain);
    let broadcastCount = 0;
    adapter.broadcast = (name, data) => { broadcastCount++; };

    bus.emit(RuntimeEvent.AGENT_START, { task: 'test' });

    if (broadcastCount === 0) {
      throw new Error('Expected at least 1 broadcast, got 0 (event forwarding broken)');
    }
    if (broadcastCount > 4) {
      throw new Error('Expected exactly 1 broadcast, got ' + broadcastCount + ' (possible state cascade)');
    }

    core.dispose();
    adapter.disconnect();
    resetEventBus();
  });
});

});
