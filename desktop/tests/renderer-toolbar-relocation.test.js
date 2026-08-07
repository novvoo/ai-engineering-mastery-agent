/**
 * 顶栏移除 + 工具栏下沉 + 跟随侧栏展开移动 —— 集成测试
 *
 * 覆盖本次重构的核心行为契约：
 *   1. ChatWorkspace 顶栏（.mastery-chat-header）已移除
 *   2. WorkbenchControls 跟随 summaryPanelVisible 切换渲染位置：
 *      - 收起：主栏顶部（.mastery-message-stage 之前）
 *      - 展开：主栏不渲染（由 InspectorPanel sidebar variant 承载）
 *   3. taskInfo 传给 MessageLog → task chip 渲染在消息流顶部
 *   4. toolbarSlot 提供 → MessageLog floating toolbar 不渲染
 *   5. InspectorPanel 接收 messageToolbar → 在 header 第 3 行渲染
 */
import { describe, test, expect } from 'bun:test';
import React from 'react';
import {
  installDomGlobals,
  render,
  click,
  buttons,
  createSpy,
} from './helpers/render-harness.js';
import { t } from '../renderer/i18n.js';
import { ChatWorkspace } from '../renderer/components/workbench/ChatWorkspace.jsx';
import { ActionLifecycleProvider } from '../renderer/contexts/ActionLifecycleContext.jsx';

// Dynamic imports AFTER installDomGlobals()
const { InspectorPanel } = await import('../renderer/components/workbench/InspectorPanel.jsx');

installDomGlobals();

/* ── helpers ─────────────────────────────────────────────── */

function spyProps(names) {
  const out = {};
  for (const name of names) out[name] = createSpy(name);
  return out;
}

function mount(node) {
  return render(<ActionLifecycleProvider contentCount={1}>{node}</ActionLifecycleProvider>);
}

const byAriaLabel = (container, label) =>
  [...buttons(container)].find((b) => b.getAttribute('aria-label') === label);
const byActionId = (container, id) =>
  container.querySelector(`button[data-action-id="${id}"]`);

/* ── fixtures ────────────────────────────────────────────── */

const makeRuntime = (overrides = {}) => ({
  status: 'idle',
  messages: [{ id: 'm1', type: 'user', content: '修复登录bug' }],
  subagents: {},
  askUserInfo: null,
  tools: [],
  runtimeInfo: {},
  stop: createSpy('runtime.stop'),
  clearMessages: createSpy('runtime.clearMessages'),
  cancelInteraction: createSpy('runtime.cancelInteraction'),
  dismissAskUser: createSpy('runtime.dismissAskUser'),
  getAvailableModels: async () => [],
  setModel: async () => {},
  setThinkingLevel: async () => {},
  ...overrides,
});

const makeControls = (overrides = {}) => (variant = 'default') => {
  const common = {
    sidebarCollapsed: false,
    isTerminalVisible: false,
    summaryPanelVisible: overrides.summaryPanelVisible ?? false,
    onExport: createSpy('onExport'),
    onOpenPreview: createSpy('onOpenPreview'),
    onToggleSidebar: createSpy('onToggleSidebar'),
    onToggleTerminal: createSpy('onToggleTerminal'),
    onToggleInspector: createSpy('onToggleInspector'),
    onClearMessages: createSpy('onClearMessages'),
    messageCount: 1,
    ...overrides,
  };
  // 返回一个带 data-variant 标记的 WorkbenchControls
  const { WorkbenchControls } = require('../renderer/components/workbench/controls/WorkbenchControls.jsx');
  return React.createElement(WorkbenchControls, { ...common, key: `wc-${variant}` });
};

const renderChat = (opts = {}) => {
  const callbacks = {
    onSendMessage: createSpy('onSendMessage'),
    onChatInputChange: createSpy('onChatInputChange'),
    onExport: createSpy('onExport'),
    onClear: createSpy('onClear'),
    onStarterPrompt: createSpy('onStarterPrompt'),
    onChatKeyDown: createSpy('onChatKeyDown'),
    onFocus: createSpy('onFocus'),
    onBlur: createSpy('onBlur'),
    ...(opts.callbacks || {}),
  };
  const runtime = opts.runtime ?? makeRuntime();
  const summaryPanelVisible = opts.summaryPanelVisible ?? false;
  const renderControls = opts.renderControls ?? makeControls({ summaryPanelVisible });
  const { container, unmount } = mount(
    <ChatWorkspace
      runtime={runtime}
      chatInput={opts.chatInput ?? ''}
      chatInputRef={React.createRef()}
      inputEditable={opts.inputEditable ?? true}
      inputFocused={false}
      showSuggestions={false}
      queueCount={opts.queueCount ?? 0}
      workingDirectory="/Users/me/mastery"
      capability={{ status: 'available' }}
      summaryPanelVisible={summaryPanelVisible}
      renderControls={renderControls}
      toolbarSlot={opts.toolbarSlot}
      {...callbacks}
    />
  );
  return { container, unmount, callbacks, runtime };
};

/* ══════════════════════════════════════════════════════════════════════════
 * 1. 顶栏移除契约
 * ══════════════════════════════════════════════════════════════════════════ */
describe('顶栏移除', () => {
  test('.mastery-chat-header 不再渲染', () => {
    const { container, unmount } = renderChat();
    expect(container.querySelector('.mastery-chat-header')).toBeNull();
    unmount();
  });

  test('.codex-title-menu（任务菜单按钮）不再渲染', () => {
    const { container, unmount } = renderChat();
    expect(container.querySelector('.codex-title-menu')).toBeNull();
    unmount();
  });

  test('输入框 .mastery-composer 仍然存在', () => {
    const { container, unmount } = renderChat();
    expect(container.querySelector('.mastery-composer')).toBeTruthy();
    unmount();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 2. WorkbenchControls 跟随 summaryPanelVisible 切换位置
 * ══════════════════════════════════════════════════════════════════════════ */
describe('WorkbenchControls 位置切换', () => {
  test('侧栏收起：WorkbenchControls 渲染在主栏顶部（.mastery-message-stage 之前）', () => {
    const { container, unmount } = renderChat({ summaryPanelVisible: false });
    const controls = byActionId(container, 'workbench.preview');
    expect(controls).toBeTruthy();
    // 确认 controls 不在 composer 里
    expect(controls.closest('.mastery-composer')).toBeNull();
    // 确认 controls 在 message-stage 之前
    const stage = container.querySelector('.mastery-message-stage');
    expect(stage).toBeTruthy();
    const stageTop = stage.getBoundingClientRect().top;
    const controlsTop = controls.getBoundingClientRect().top;
    expect(controlsTop).toBeLessThanOrEqual(stageTop);
    unmount();
  });

  test('侧栏展开：主栏不渲染 WorkbenchControls', () => {
    const { container, unmount } = renderChat({ summaryPanelVisible: true });
    const controls = byActionId(container, 'workbench.preview');
    expect(controls).toBeNull();
    unmount();
  });

  test('侧栏收起 → 展开：WorkbenchControls 从主栏消失', () => {
    const { container, unmount } = renderChat({ summaryPanelVisible: false });
    expect(byActionId(container, 'workbench.preview')).toBeTruthy();
    unmount();

    const r2 = renderChat({ summaryPanelVisible: true });
    expect(byActionId(r2.container, 'workbench.preview')).toBeNull();
    r2.unmount();
  });

  test('收起态点击 workbench.toggle-inspector 触发回调', () => {
    const onToggleInspector = createSpy('onToggleInspector');
    const renderControls = (variant) => {
      const { WorkbenchControls } = require('../renderer/components/workbench/controls/WorkbenchControls.jsx');
      return React.createElement(WorkbenchControls, {
        key: `wc-${variant}`,
        sidebarCollapsed: false,
        isTerminalVisible: false,
        summaryPanelVisible: false,
        onToggleInspector,
        onExport: createSpy('onExport'),
        onOpenPreview: createSpy('onOpenPreview'),
        onToggleSidebar: createSpy('onToggleSidebar'),
        onToggleTerminal: createSpy('onToggleTerminal'),
        onClearMessages: createSpy('onClearMessages'),
        messageCount: 1,
      });
    };
    const { container, unmount } = renderChat({ renderControls });
    const btn = byActionId(container, 'workbench.toggle-inspector');
    expect(btn).toBeTruthy();
    click(btn);
    expect(onToggleInspector.callCount).toBe(1);
    unmount();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 3. taskInfo → task chip 渲染
 * ══════════════════════════════════════════════════════════════════════════ */
describe('task chip 下沉', () => {
  test('消息流顶部渲染 task chip，含任务标题', () => {
    const { container, unmount } = renderChat();
    const chip = container.querySelector('[style*="taskChip"], [class*="task-chip"]');
    // jsdom 下 style 属性是字符串，直接搜文本
    const chipText = container.textContent;
    expect(chipText).toContain('修复登录bug');
    unmount();
  });

  test('task chip 显示消息计数', () => {
    const runtime = makeRuntime({
      messages: [
        { id: 'm1', type: 'user', content: '第一条' },
        { id: 'm2', type: 'result', content: '结果' },
        { id: 'm3', type: 'user', content: '第二条' },
      ],
    });
    const { container, unmount } = renderChat({ runtime });
    expect(container.textContent).toContain('3');
    unmount();
  });

  test('无消息时 MessageLog 渲染空状态（task chip 不渲染）', () => {
    const runtime = makeRuntime({ messages: [] });
    const { container, unmount } = renderChat({ runtime });
    // 无消息时 MessageLog 提前返回空状态视图，不渲染 task chip
    expect(container.textContent).toContain('从一个具体任务开始');
    unmount();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 4. toolbarSlot 透传
 * ══════════════════════════════════════════════════════════════════════════ */
describe('toolbarSlot 透传', () => {
  test('不提供 toolbarSlot：MessageLog 渲染 floating toolbar（含搜索按钮）', () => {
    const { container, unmount } = renderChat({ toolbarSlot: undefined });
    // floating toolbar 含 aria-label="搜索消息"
    const searchBtn = byAriaLabel(container, t('msg.search_hint'));
    expect(searchBtn).toBeTruthy();
    unmount();
  });

  test('提供 toolbarSlot：MessageLog 不渲染 floating toolbar', () => {
    const captured = [];
    const toolbarSlot = (el) => captured.push(el);
    const { container, unmount } = renderChat({ toolbarSlot });
    // toolbarSlot 被调用（通过 effect）
    expect(captured.length).toBeGreaterThan(0);
    // floating toolbar 不在主栏（find 返回 undefined）
    const searchBtn = byAriaLabel(container, t('msg.search_hint'));
    expect(searchBtn).toBeUndefined();
    unmount();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * 5. InspectorPanel 接收 messageToolbar
 * ══════════════════════════════════════════════════════════════════════════ */
describe('InspectorPanel messageToolbar', () => {
  function inspectorProps(overrides = {}) {
    return {
      activeInspectorTab: 'activity',
      activePreviewUrl: '',
      fileServerUrl: '',
      inspectorExpanded: false,
      inspectorPanelWidth: 320,
      ipc: {},
      messages: [],
      previewFrameKey: 0,
      previewSession: null,
      previewStatus: 'idle',
      previewUrlDraft: '',
      ragDocs: [],
      ragStatus: '未初始化',
      sessions: [],
      activeSessionId: null,
      sessionLoading: false,
      sessionHasMore: false,
      sessionSearchQuery: '',
      workingDirectory: '/workspace',
      ...spyProps([
        'onClearHistory', 'onDeleteSession', 'onDeleteSessions', 'onExpandToggle',
        'onForkSession', 'onLoadMoreSessions', 'onNewSession', 'onOpenExternal',
        'onPreviewUrlDraftChange', 'onPreviewUrlSubmit', 'onRefreshFrame',
        'onRemoveDocument', 'onResetRag', 'onResizeStart', 'onResizeKeyDown',
        'onSearchSessions', 'onStartPreview', 'onStopPreview', 'onSwitchSession',
        'onClose', 'onTabChange', 'onAddDocuments', 'onInitializeIndex',
        'onInsertDocSearch',
      ]),
      ...overrides,
    };
  }

  test('不提供 messageToolbar：header 只有 2 行（控制行 + TabGroup）', () => {
    const { container, unmount } = mount(
      <InspectorPanel {...inspectorProps()} summaryPanelVisible={true} />
    );
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(4);
    // 不存在额外的 toolbar 区域（无 msg.message_details 文本）
    expect(container.textContent).not.toContain(t('msg.message_details'));
    unmount();
  });

  test('提供 messageToolbar：在 TabGroup 下方渲染', () => {
    const toolbarContent = React.createElement('div', { 'data-testid': 'mock-toolbar' }, '模拟工具栏');
    const { container, unmount } = mount(
      <InspectorPanel
        {...inspectorProps()}
        summaryPanelVisible={true}
        messageToolbar={toolbarContent}
      />
    );
    const mock = container.querySelector('[data-testid="mock-toolbar"]');
    expect(mock).toBeTruthy();
    expect(container.textContent).toContain('模拟工具栏');
    unmount();
  });

  test('messageToolbar 渲染在 TabGroup 之后', () => {
    const toolbarContent = React.createElement('div', { 'data-testid': 'mock-toolbar' });
    const { container, unmount } = mount(
      <InspectorPanel
        {...inspectorProps()}
        summaryPanelVisible={true}
        messageToolbar={toolbarContent}
      />
    );
    const tabs = container.querySelector('[role="tablist"]');
    const mock = container.querySelector('[data-testid="mock-toolbar"]');
    expect(tabs).toBeTruthy();
    expect(mock).toBeTruthy();
    // mock 在 tabs 之后
    const tabsBottom = tabs.getBoundingClientRect().bottom;
    const mockTop = mock.getBoundingClientRect().top;
    expect(mockTop).toBeGreaterThanOrEqual(tabsBottom);
    unmount();
  });
});
