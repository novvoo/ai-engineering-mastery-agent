/**
 * Button-interaction tests for the workbench components:
 *   - ActivityRail
 *   - WorkbenchControls
 *   - FileWorkbench
 *   - BottomTerminalPanel
 *   - ChatWorkspace
 *
 * Every <button> each component can render is surfaced (including
 * conditionally-rendered ones), clicked inside act(), and its response is
 * asserted (spy invoked with expected args / DOM state changed / disabled
 * buttons leave handlers untouched).
 *
 * No window.electronAPI stub is needed: BottomTerminalPanel's useIPC() never
 * connects on mount (it only exposes invoke/etc.), FileWorkbench's LSP effect
 * degrades to "no LSP" when window.electronAPI is undefined, and the other
 * three components never touch it.
 */
import { describe, test, expect } from 'bun:test';
import React from 'react';
import {
  installDomGlobals,
  render,
  click,
  buttons,
  btnLabel,
  createSpy,
} from './helpers/render-harness.js';
import { t } from '../renderer/i18n.js';
import { ActivityRail } from '../renderer/components/workbench/ActivityRail.jsx';
import { WorkbenchControls } from '../renderer/components/workbench/controls/WorkbenchControls.jsx';
import { ActionLifecycleProvider } from '../renderer/contexts/ActionLifecycleContext.jsx';
import { FileWorkbench } from '../renderer/components/workbench/FileWorkbench.jsx';
import { BottomTerminalPanel } from '../renderer/components/workbench/BottomTerminalPanel.jsx';
import { TERMINAL_HEIGHT } from '../renderer/app/layout/layout-state.js';
import { ChatWorkspace } from '../renderer/components/workbench/ChatWorkspace.jsx';

installDomGlobals();

/* ── shared lookups ──────────────────────────────────────────────────────── */

const byTitle = (container, title) => buttons(container).find((b) => b.title === title);
const byText = (container, text) =>
  buttons(container).find((b) => (b.textContent || '').trim() === text);
const byAriaLabel = (container, label) =>
  buttons(container).find((b) => b.getAttribute('aria-label') === label);

/* ChatWorkspace's own buttons = everything inside .mastery-composer EXCEPT
 * the RuntimeSelector <details> dropdown (its model / thinking-level buttons
 * are guarded by RuntimeSelector's own test file). 顶栏已移除。
 */
const chatOwnButtons = (container) =>
  Array.from(container.querySelectorAll('.mastery-composer button'))
    .filter((btn) => !btn.closest('.codex-composer-tools details'));

/* ══════════════════════════════════════════════════════════════════════════
 * ActivityRail — 3 icon buttons: Agent / tools / settings
 * ══════════════════════════════════════════════════════════════════════════ */

describe('ActivityRail', () => {
  const renderRail = (callbacks = {}) => {
    const { container, unmount } = render(
      <ActivityRail
        activeTab="agent"
        sidebarCollapsed={false}
        onShowAgent={callbacks.onShowAgent || (() => {})}
        onShowTools={callbacks.onShowTools || (() => {})}
        onToggleSettings={callbacks.onToggleSettings || (() => {})}
      />
    );
    return { container, unmount };
  };

  test('inventory: default config renders exactly 3 icon buttons', () => {
    const { container, unmount } = renderRail();
    expect(buttons(container).length).toBe(3);
    unmount();
  });

  test('Agent button invokes onShowAgent', () => {
    const onShowAgent = createSpy('onShowAgent');
    const { container, unmount } = renderRail({ onShowAgent });
    const btn = byTitle(container, 'Agent');
    expect(btn).toBeTruthy();
    click(btn);
    expect(onShowAgent.callCount).toBe(1);
    unmount();
  });

  test('tools button invokes onShowTools', () => {
    const onShowTools = createSpy('onShowTools');
    const { container, unmount } = renderRail({ onShowTools });
    const btn = byTitle(container, t('inspector.tools_title'));
    expect(btn).toBeTruthy();
    click(btn);
    expect(onShowTools.callCount).toBe(1);
    unmount();
  });

  test('settings button invokes onToggleSettings', () => {
    const onToggleSettings = createSpy('onToggleSettings');
    const { container, unmount } = renderRail({ onToggleSettings });
    const btn = byTitle(container, t('inspector.settings_title'));
    expect(btn).toBeTruthy();
    click(btn);
    expect(onToggleSettings.callCount).toBe(1);
    unmount();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * WorkbenchControls — 6 action buttons (preview / export / toggle-sidebar /
 * toggle-terminal / toggle-inspector / clear). Needs ActionLifecycleProvider,
 * otherwise useActionLifecycleContext() throws.
 * ══════════════════════════════════════════════════════════════════════════ */

describe('WorkbenchControls', () => {
  const renderControls = (opts = {}) => {
    const callbacks = {
      onOpenPreview: createSpy('onOpenPreview'),
      onExport: createSpy('onExport'),
      onToggleSidebar: createSpy('onToggleSidebar'),
      onToggleTerminal: createSpy('onToggleTerminal'),
      onToggleInspector: createSpy('onToggleInspector'),
      onClearMessages: createSpy('onClearMessages'),
      ...(opts.callbacks || {}),
    };
    const { container, unmount } = render(
      <ActionLifecycleProvider contentCount={opts.contentCount ?? 1}>
        <WorkbenchControls
          messageCount={opts.messageCount ?? 1}
          sidebarCollapsed={false}
          isTerminalVisible={false}
          summaryPanelVisible={false}
          {...callbacks}
        />
      </ActionLifecycleProvider>
    );
    return { container, unmount, callbacks };
  };

  const actionBtn = (container, actionId) =>
    container.querySelector(`button[data-action-id="${actionId}"]`);

  const ACTION_SPY_MAP = [
    ['workbench.preview', 'onOpenPreview'],
    ['workbench.export', 'onExport'],
    ['workbench.toggle-sidebar', 'onToggleSidebar'],
    ['workbench.toggle-terminal', 'onToggleTerminal'],
    ['workbench.toggle-inspector', 'onToggleInspector'],
    ['workbench.clear', 'onClearMessages'],
  ];

  test('inventory: default config renders exactly 6 action buttons', () => {
    const { container, unmount } = renderControls();
    expect(buttons(container).length).toBe(6);
    for (const [actionId] of ACTION_SPY_MAP) {
      expect(actionBtn(container, actionId)).toBeTruthy();
    }
    unmount();
  });

  for (const [actionId, spyName] of ACTION_SPY_MAP) {
    test(`${actionId} click invokes ${spyName}`, () => {
      const { container, unmount, callbacks } = renderControls();
      const btn = actionBtn(container, actionId);
      expect(btn.disabled).toBe(false);
      click(btn);
      expect(callbacks[spyName].callCount).toBe(1);
      unmount();
    });
  }

  test('export & clear are disabled without messages; handlers not fired', () => {
    const { container, unmount, callbacks } = renderControls({ messageCount: 0, contentCount: 0 });
    const exportBtn = actionBtn(container, 'workbench.export');
    const clearBtn = actionBtn(container, 'workbench.clear');
    expect(exportBtn.disabled).toBe(true);
    expect(clearBtn.disabled).toBe(true);
    click(exportBtn);
    click(clearBtn);
    expect(callbacks.onExport.callCount).toBe(0);
    expect(callbacks.onClearMessages.callCount).toBe(0);
    unmount();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * FileWorkbench — mode toggle (View/Edit), Save (edit mode, enabled only when
 * dirty), close (×). Returns null (0 buttons) without an openFile.
 * ══════════════════════════════════════════════════════════════════════════ */

describe('FileWorkbench', () => {
  const openFile = { path: '/workspace/src/app.ts', name: 'app.ts', content: 'const a = 1;\n' };

  const renderFile = (opts = {}) => {
    const callbacks = {
      onClose: createSpy('onClose'),
      onSave: createSpy('onSave'),
      onModeToggle: createSpy('onModeToggle'),
      onDraftChange: createSpy('onDraftChange'),
      ...(opts.callbacks || {}),
    };
    const { container, unmount } = render(
      <FileWorkbench
        openFile={opts.openFile === undefined ? openFile : opts.openFile}
        fileDraft={opts.fileDraft ?? openFile.content}
        fileMode={opts.fileMode ?? 'edit'}
        fileStatus={opts.fileStatus}
        {...callbacks}
      />
    );
    return { container, unmount, callbacks };
  };

  test('inventory (edit, dirty): exactly 3 buttons — View / Save / Close', () => {
    const { container, unmount } = renderFile({ fileDraft: 'const a = 2;\n' });
    expect(buttons(container).length).toBe(3);
    expect(byText(container, 'View')).toBeTruthy();
    expect(byText(container, 'Save')).toBeTruthy();
    expect(byTitle(container, 'Close file')).toBeTruthy();
    unmount();
  });

  test('inventory (no openFile): 0 buttons', () => {
    const { container, unmount } = renderFile({ openFile: null });
    expect(buttons(container).length).toBe(0);
    unmount();
  });

  test('mode toggle (edit) invokes onModeToggle', () => {
    const onModeToggle = createSpy('onModeToggle');
    const { container, unmount } = renderFile({
      fileDraft: 'const a = 2;\n',
      callbacks: { onModeToggle },
    });
    const btn = byText(container, 'View');
    expect(btn).toBeTruthy();
    click(btn);
    expect(onModeToggle.callCount).toBe(1);
    unmount();
  });

  test('Save (dirty) invokes onSave', () => {
    const onSave = createSpy('onSave');
    const { container, unmount } = renderFile({
      fileDraft: 'const a = 2;\n',
      callbacks: { onSave },
    });
    const btn = byText(container, 'Save');
    expect(btn.disabled).toBe(false);
    click(btn);
    expect(onSave.callCount).toBe(1);
    unmount();
  });

  test('close button invokes onClose', () => {
    const onClose = createSpy('onClose');
    const { container, unmount } = renderFile({ callbacks: { onClose } });
    const btn = byTitle(container, 'Close file');
    expect(btn).toBeTruthy();
    click(btn);
    expect(onClose.callCount).toBe(1);
    unmount();
  });

  // fileStatus="error" renders the same header (Edit toggle + Close) WITHOUT
  // mounting CodePreview: CodePreview's effect depends on a fresh `lines`
  // array and calls setDiagnostics([]) (new identity each render), which
  // infinite-loops ("Maximum update depth exceeded") whenever LSP is
  // unavailable — a pre-existing component bug, not fixable from tests.
  test('preview mode: 2 buttons (Edit toggle + Close), no Save; toggle invokes onModeToggle', () => {
    const onModeToggle = createSpy('onModeToggle');
    const { container, unmount } = renderFile({
      fileMode: 'preview',
      fileStatus: 'error',
      callbacks: { onModeToggle },
    });
    expect(buttons(container).length).toBe(2);
    expect(byText(container, 'Save')).toBeUndefined();
    const btn = byText(container, 'Edit');
    expect(btn).toBeTruthy();
    click(btn);
    expect(onModeToggle.callCount).toBe(1);
    unmount();
  });

  test('Save is disabled when not dirty; handler not fired', () => {
    const onSave = createSpy('onSave');
    const { container, unmount } = renderFile({ callbacks: { onSave } }); // draft === content
    const btn = byText(container, 'Save');
    expect(btn.disabled).toBe(true);
    click(btn);
    expect(onSave.callCount).toBe(0);
    unmount();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * BottomTerminalPanel — 3 tab buttons (terminal / problems / output) + 4
 * header buttons (清空终端 / 最大化终端 / 最小化终端 / 关闭终端). Renders
 * nothing (0 buttons) when isOpen=false. useIPC degrades gracefully without
 * window.electronAPI (never connects on mount).
 * ══════════════════════════════════════════════════════════════════════════ */

describe('BottomTerminalPanel', () => {
  const renderPanel = (opts = {}) => {
    const callbacks = {
      onActiveTabChange: createSpy('onActiveTabChange'),
      onClose: createSpy('onClose'),
      onHeightChange: createSpy('onHeightChange'),
      onOpenChange: createSpy('onOpenChange'),
      ...(opts.callbacks || {}),
    };
    const { container, unmount } = render(
      <BottomTerminalPanel
        activeTab={opts.activeTab ?? 'terminal'}
        isOpen={opts.isOpen ?? true}
        height={200}
        workingDirectory="/Users/me/mastery"
        capability={undefined}
        {...callbacks}
      />
    );
    return { container, unmount, callbacks };
  };

  const tab = (container, id) =>
    Array.from(container.querySelectorAll('button[role="tab"]'))
      .find((b) => b.getAttribute('aria-controls') === `terminal-panel-${id}`);

  test('inventory (open): exactly 7 buttons — 3 tabs + 4 header', () => {
    const { container, unmount } = renderPanel();
    expect(buttons(container).length).toBe(7);
    expect(tab(container, 'terminal')).toBeTruthy();
    expect(tab(container, 'problems')).toBeTruthy();
    expect(tab(container, 'output')).toBeTruthy();
    expect(byAriaLabel(container, '清空终端')).toBeTruthy();
    expect(byAriaLabel(container, '最大化终端')).toBeTruthy();
    expect(byAriaLabel(container, '最小化终端')).toBeTruthy();
    expect(byAriaLabel(container, '关闭终端')).toBeTruthy();
    unmount();
  });

  test('inventory (closed): 0 buttons', () => {
    const { container, unmount } = renderPanel({ isOpen: false });
    expect(buttons(container).length).toBe(0);
    unmount();
  });

  for (const tabId of ['terminal', 'problems', 'output']) {
    test(`"${tabId}" tab click invokes onActiveTabChange("${tabId}")`, () => {
      const onActiveTabChange = createSpy('onActiveTabChange');
      const { container, unmount } = renderPanel({ callbacks: { onActiveTabChange } });
      const btn = tab(container, tabId);
      expect(btn).toBeTruthy();
      click(btn);
      expect(onActiveTabChange.callCount).toBe(1);
      expect(onActiveTabChange.calls[0][0]).toBe(tabId);
      unmount();
    });
  }

  test('清空终端 clears the terminal buffer', () => {
    const { container, unmount } = renderPanel();
    expect(container.textContent).toContain('Mastery Terminal');
    click(byAriaLabel(container, '清空终端'));
    expect(container.textContent).not.toContain('Mastery Terminal');
    unmount();
  });

  test('最大化终端 invokes onHeightChange(TERMINAL_HEIGHT.max)', () => {
    const onHeightChange = createSpy('onHeightChange');
    const { container, unmount } = renderPanel({ callbacks: { onHeightChange } });
    click(byAriaLabel(container, '最大化终端'));
    expect(onHeightChange.callCount).toBe(1);
    expect(onHeightChange.calls[0][0]).toBe(TERMINAL_HEIGHT.max);
    unmount();
  });

  test('最小化终端 invokes onOpenChange(false)', () => {
    const onOpenChange = createSpy('onOpenChange');
    const { container, unmount } = renderPanel({ callbacks: { onOpenChange } });
    click(byAriaLabel(container, '最小化终端'));
    expect(onOpenChange.callCount).toBe(1);
    expect(onOpenChange.calls[0][0]).toBe(false);
    unmount();
  });

  test('关闭终端 invokes onClose', () => {
    const onClose = createSpy('onClose');
    const { container, unmount } = renderPanel({ callbacks: { onClose } });
    click(byAriaLabel(container, '关闭终端'));
    expect(onClose.callCount).toBe(1);
    unmount();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * ChatWorkspace — composer buttons only (顶栏已移除，task-menu 已下沉).
 * Composer plus trigger (reveals 添加文档 / 搜索文档 / 调试模式), send button
 * (disabled when the composer is empty and idle), and the running-state
 * stop/queue buttons. Subcomponent buttons (MessageLog starter chips,
 * RuntimeSelector thinking levels) are covered by their own test files.
 * ══════════════════════════════════════════════════════════════════════════ */

describe('ChatWorkspace', () => {
  const makeRuntime = (overrides = {}) => ({
    status: 'idle',
    messages: [],
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
    const { container, unmount } = render(
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
        {...callbacks}
      />
    );
    return { container, unmount, callbacks, runtime };
  };

  test('inventory (idle, empty input): exactly 2 own buttons', () => {
    const { container, unmount } = renderChat();
    expect(chatOwnButtons(container).length).toBe(2);
    unmount();
  });

  test('inventory (running, non-empty input): exactly 3 own buttons', () => {
    const { container, unmount } = renderChat({
      runtime: makeRuntime({ status: 'running' }),
      chatInput: 'hello',
    });
    expect(chatOwnButtons(container).length).toBe(3);
    unmount();
  });

  test('composer plus trigger opens the context menu', () => {
    const { container, unmount } = renderChat();
    const plus = container.querySelector('.codex-composer-plus');
    expect(plus.getAttribute('aria-label')).toBe('添加上下文');
    expect(byText(container, '添加文档')).toBeUndefined();
    click(plus);
    expect(byText(container, '添加文档')).toBeTruthy();
    expect(byText(container, '搜索文档')).toBeTruthy();
    expect(byText(container, '调试模式')).toBeTruthy();
    unmount();
  });

  test('添加文档 (context menu) pre-fills "/doc add " via onChatInputChange', () => {
    const onChatInputChange = createSpy('onChatInputChange');
    const { container, unmount } = renderChat({ callbacks: { onChatInputChange } });
    click(container.querySelector('.codex-composer-plus'));
    click(byText(container, '添加文档'));
    expect(onChatInputChange.callCount).toBe(1);
    expect(onChatInputChange.calls[0][0]).toBe('/doc add ');
    unmount();
  });

  test('搜索文档 (context menu) pre-fills "/doc search " via onChatInputChange', () => {
    const onChatInputChange = createSpy('onChatInputChange');
    const { container, unmount } = renderChat({ callbacks: { onChatInputChange } });
    click(container.querySelector('.codex-composer-plus'));
    click(byText(container, '搜索文档'));
    expect(onChatInputChange.callCount).toBe(1);
    expect(onChatInputChange.calls[0][0]).toBe('/doc search ');
    unmount();
  });

  test('调试模式 (context menu) pre-fills "/debug on" via onChatInputChange', () => {
    const onChatInputChange = createSpy('onChatInputChange');
    const { container, unmount } = renderChat({ callbacks: { onChatInputChange } });
    click(container.querySelector('.codex-composer-plus'));
    click(byText(container, '调试模式'));
    expect(onChatInputChange.callCount).toBe(1);
    expect(onChatInputChange.calls[0][0]).toBe('/debug on');
    unmount();
  });

  test('send button is disabled when idle with empty input; handler not fired', () => {
    const onSendMessage = createSpy('onSendMessage');
    const { container, unmount } = renderChat({ callbacks: { onSendMessage } });
    const send = container.querySelector('.mastery-composer > button');
    expect(send).toBeTruthy();
    expect(send.disabled).toBe(true);
    click(send);
    expect(onSendMessage.callCount).toBe(0);
    unmount();
  });

  test('send button sends when idle with non-empty input', () => {
    const onSendMessage = createSpy('onSendMessage');
    const { container, unmount } = renderChat({
      chatInput: 'hello',
      callbacks: { onSendMessage },
    });
    const send = container.querySelector('.mastery-composer > button');
    expect(send.disabled).toBe(false);
    click(send);
    expect(onSendMessage.callCount).toBe(1);
    unmount();
  });

  test('running + empty input: single stop button invokes runtime.stop', () => {
    const runtime = makeRuntime({ status: 'running' });
    const { container, unmount } = renderChat({ runtime });
    const stop = container.querySelector('.mastery-composer > button');
    expect(stop).toBeTruthy();
    expect(stop.classList.contains('codex-stop-button')).toBe(true);
    expect(stop.disabled).toBe(false);
    click(stop);
    expect(runtime.stop.callCount).toBe(1);
    unmount();
  });

  test('running + non-empty input: queue button invokes onSendMessage', () => {
    const onSendMessage = createSpy('onSendMessage');
    const { container, unmount } = renderChat({
      runtime: makeRuntime({ status: 'running' }),
      chatInput: 'hello',
      callbacks: { onSendMessage },
    });
    const queue = byAriaLabel(container, '加入队列');
    expect(queue).toBeTruthy();
    click(queue);
    expect(onSendMessage.callCount).toBe(1);
    unmount();
  });

  test('running + non-empty input: stop button invokes runtime.stop', () => {
    const runtime = makeRuntime({ status: 'running' });
    const { container, unmount } = renderChat({
      runtime,
      chatInput: 'hello',
    });
    const stop = container.querySelector('button.codex-stop-button');
    expect(stop).toBeTruthy();
    expect(stop.disabled).toBe(false);
    click(stop);
    expect(runtime.stop.callCount).toBe(1);
    unmount();
  });
});
