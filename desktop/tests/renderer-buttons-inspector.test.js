/**
 * Button-interaction ("响应") tests for the workbench components:
 *   InspectorPanel, SidebarPanel, ProjectTree, InteractionConsole
 *
 * Every <button> a component can render is surfaced via a minimal prop
 * fixture, clicked, and its real response asserted (spy invoked with the
 * expected args, DOM state flipped, or disabled => handler NOT fired).
 * One inventory test per component guards the default-config button count.
 *
 * All components use the ActionLifecycleContext, so every render is wrapped
 * in <ActionLifecycleProvider>. Clicks that run through
 * executeActionWithFeedback() are flushed inside act() so the async chain
 * (admit -> async fn -> succeed -> onFeedback) completes without React
 * act() warnings.
 */
import React from 'react';
import { describe, test, expect } from 'bun:test';
import {
  installDomGlobals, render, buttons, btnLabel, createSpy, type,
} from './helpers/render-harness.js';
import { t } from '../renderer/i18n.js';

installDomGlobals();

// Dynamic imports AFTER installDomGlobals(): react-dom computes
// `isInputEventSupported` at module load, and a static `import { act } from
// 'react'` hoists react-dom above the DOM install, so React falls back to the
// IE propertychange polyfill and crashes on jsdom (attachEvent missing) while
// controlled-input onChange never fires. Keep react-dom evaluation post-jsdom.
const { ActionLifecycleProvider } = await import('../renderer/contexts/ActionLifecycleContext.jsx');
const { InspectorPanel } = await import('../renderer/components/workbench/InspectorPanel.jsx');
const { SidebarPanel } = await import('../renderer/components/workbench/SidebarPanel.jsx');
const { ProjectTree } = await import('../renderer/components/workbench/ProjectTree.jsx');
const { InteractionConsole } = await import('../renderer/components/workbench/InteractionConsole.jsx');

/* ── helpers ─────────────────────────────────────────────── */

function spyProps(names) {
  const out = {};
  for (const name of names) out[name] = createSpy(name);
  return out;
}

/** Mount wrapped in the ActionLifecycle provider; returns the harness result. */
function mount(node, { onFeedback } = {}) {
  return render(<ActionLifecycleProvider onFeedback={onFeedback}>{node}</ActionLifecycleProvider>);
}

/**
 * Click inside act() and flush the action-lifecycle promise chain
 * (executeActionWithFeedback: admit -> async fn -> succeed -> onFeedback),
 * so all state updates land inside act().
 */
async function clickAsync(el) {
  const { act } = require('react');
  await act(async () => {
    el.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true, cancelable: true }));
    // flush the action-lifecycle promise chain (admit -> run -> succeed -> feedback)
    for (let i = 0; i < 50; i += 1) await Promise.resolve();
  });
}

/** Right-click (contextmenu) inside act(). */
function openContextMenu(el, x = 120, y = 90) {
  const { act } = require('react');
  act(() => {
    el.dispatchEvent(new globalThis.MouseEvent('contextmenu', {
      bubbles: true, cancelable: true, clientX: x, clientY: y,
    }));
  });
}

/** Click a context-menu item by its label text (items are divs, portaled to <body>). */
async function clickMenuItem(label) {
  const span = [...globalThis.document.body.querySelectorAll('span')]
    .find((s) => (s.textContent || '').trim() === label);
  expect(span, `context menu item "${label}" should be present`).toBeTruthy();
  await clickAsync(span.parentElement);
}

/** Drive a controlled text input like a user typing (native setter + input event). */
function typeInto(input, value) {
  type(input, value);
}

const byId = (container, id) => container.querySelector(`[data-action-id="${id}"]`);
const byTitle = (container, title) =>
  [...buttons(container)].find((b) => b.getAttribute('title') === title);
const byAria = (container, label) =>
  [...buttons(container)].find((b) => b.getAttribute('aria-label') === label);
const byText = (container, text) =>
  [...buttons(container)].find((b) => (b.textContent || '').trim() === text);

/* ── fixtures ────────────────────────────────────────────── */

const sessionA = {
  id: 's1', title: '会话一', status: 'complete',
  updatedAt: '2026-01-02T03:04:05.000Z',
  messages: [{ id: 'm1', type: 'user', content: 'hi' }],
};
const sessionB = {
  id: 's2', title: '会话二', status: 'running',
  updatedAt: '2026-01-02T04:05:06.000Z',
  messages: [
    { id: 'm2', type: 'user', content: 'hello' },
    { id: 'm3', type: 'result', content: 'done' },
  ],
};
const twoSessions = [sessionA, sessionB];

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
    previewUrlDraft: '127.0.0.1:41730',
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

function sidebarProps(overrides = {}) {
  return {
    activeTab: 'chat',
    runtime: { status: 'idle', tools: [], loading: false, messages: [], stats: null },
    workingDirectory: '/workspace/proj',
    workingDirectorySyncMessage: '',
    agentOptions: {},
    sessions: [],
    activeSessionId: null,
    projectTree: {},
    ...spyProps([
      'onOptionsChange', 'onInsertText', 'onWorkingDirectoryChange', 'onNewTask',
      'onOpenFile', 'onCloseFile', 'onSelectSession', 'onDeleteSession',
      'onClearSessions', 'onShowTools', 'onSettings',
    ]),
    ...overrides,
  };
}

function treeProps(overrides = {}) {
  const tree = {
    directoryChildren: {
      '': [
        { path: '/workspace/proj/src', name: 'src', type: 'directory' },
        { path: '/workspace/proj/README.md', name: 'README.md', type: 'file' },
      ],
      '/workspace/proj/src': [
        { path: '/workspace/proj/src/index.js', name: 'index.js', type: 'file' },
      ],
    },
    expandedDirectories: new Set(),
    loadingDirectories: new Set(),
    status: 'idle',
    error: '',
    ...spyProps([
      'onToggleDirectory', 'onRefresh', 'onCreateFile', 'onCreateDirectory',
      'onDeleteItem', 'onRenameItem',
    ]),
  };
  return {
    workingDirectory: '/workspace/proj',
    activeOpenFile: null,
    projectTree: tree,
    ...spyProps(['onOpenFile', 'onCloseFile']),
    ...overrides,
  };
}

const consoleMsg = { id: 'm1', type: 'user', content: '你好' };

/* ── InspectorPanel ──────────────────────────────────────── */

describe('InspectorPanel buttons', () => {
  test('default activity config renders exactly the 6 header buttons (inventory)', () => {
    const { container, unmount } = mount(<InspectorPanel {...inspectorProps()} />);
    expect(buttons(container).length).toBe(6); // 4 tabs + expand + close
    unmount();
  });

  test('expand toggle button calls onExpandToggle and swaps its label when expanded', async () => {
    const p = inspectorProps();
    const { container, unmount } = mount(<InspectorPanel {...p} />);
    const expand = byAria(container, t('inspector.expand'));
    expect(expand, 'expand button present when collapsed').toBeTruthy();
    expect(expand.getAttribute('aria-label')).not.toBe(t('inspector.restore'));
    await clickAsync(expand);
    expect(p.onExpandToggle.callCount).toBe(1);
    unmount();

    const p2 = inspectorProps({ inspectorExpanded: true });
    const r2 = mount(<InspectorPanel {...p2} />);
    const restore = byAria(r2.container, t('inspector.restore'));
    expect(restore, 'restore button present when expanded').toBeTruthy();
    await clickAsync(restore);
    expect(p2.onExpandToggle.callCount).toBe(1);
    r2.unmount();
  });

  test('close panel button calls onClose', async () => {
    const p = inspectorProps();
    const { container, unmount } = mount(<InspectorPanel {...p} />);
    const close = byAria(container, t('inspector.close_panel'));
    expect(close).toBeTruthy();
    await clickAsync(close);
    expect(p.onClose.callCount).toBe(1);
    unmount();
  });

  test('tab buttons call onTabChange with their tab id', async () => {
    const p = inspectorProps();
    const { container, unmount } = mount(<InspectorPanel {...p} />);
    const tabs = [...container.querySelectorAll('button[role="tab"]')];
    expect(tabs.length).toBe(4);
    for (const [i, tab] of tabs.entries()) {
      await clickAsync(tab);
    }
    expect(p.onTabChange.calls).toEqual([['activity'], ['plan'], ['history'], ['preview']]);
    unmount();
  });

  test('history config with 2 sessions + hasMore renders all history buttons (inventory)', () => {
    const { container, unmount } = mount(
      <InspectorPanel {...inspectorProps({
        activeInspectorTab: 'history', sessions: twoSessions, sessionHasMore: true,
      })}
      />,
    );
    // 6 header + 新建 + 清空 + 2×分叉 + 2×删除 + 加载更多
    expect(buttons(container).length).toBe(13);
    unmount();
  });

  test('new session button calls onNewSession and clears busy state', async () => {
    const p = inspectorProps({ activeInspectorTab: 'history', sessions: twoSessions });
    const { container, unmount } = mount(<InspectorPanel {...p} />);
    const btn = byId(container, 'session.new');
    expect(btn).toBeTruthy();
    await clickAsync(btn);
    expect(p.onNewSession.callCount).toBe(1);
    // action lifecycle completed: button is no longer busy and back to '+ 新建'
    expect(btn.getAttribute('aria-busy')).toBeNull();
    expect((btn.textContent || '').trim()).toBe('+ 新建');
    unmount();
  });

  test('clear history button calls onClearHistory', async () => {
    const p = inspectorProps({ activeInspectorTab: 'history', sessions: twoSessions });
    const { container, unmount } = mount(<InspectorPanel {...p} />);
    const btn = byTitle(container, '清空所有会话');
    expect(btn).toBeTruthy();
    await clickAsync(btn);
    expect(p.onClearHistory.callCount).toBe(1);
    unmount();
  });

  test('clear history button is disabled with no sessions and does not fire', async () => {
    const p = inspectorProps({ activeInspectorTab: 'history', sessions: [] });
    const { container, unmount } = mount(<InspectorPanel {...p} />);
    expect(buttons(container).length).toBe(8); // 6 header + 新建 + 清空(disabled)
    const btn = byId(container, 'session.clear-history');
    expect(btn.disabled).toBe(true);
    await clickAsync(btn);
    expect(p.onClearHistory.callCount).toBe(0);
    unmount();
  });

  test('load more button calls onLoadMoreSessions', async () => {
    const p = inspectorProps({
      activeInspectorTab: 'history', sessions: twoSessions, sessionHasMore: true,
    });
    const { container, unmount } = mount(<InspectorPanel {...p} />);
    const btn = byId(container, 'session.load-more');
    expect(btn).toBeTruthy();
    await clickAsync(btn);
    expect(p.onLoadMoreSessions.callCount).toBe(1);
    unmount();
  });

  test('fork session buttons call onForkSession with the session id', async () => {
    const p = inspectorProps({ activeInspectorTab: 'history', sessions: twoSessions });
    const { container, unmount } = mount(<InspectorPanel {...p} />);
    const forkBtns = [...buttons(container)].filter((b) => b.title === '分叉会话');
    expect(forkBtns.length).toBe(2);
    await clickAsync(forkBtns[0]);
    await clickAsync(forkBtns[1]);
    expect(p.onForkSession.calls).toEqual([['s1'], ['s2']]);
    unmount();
  });

  test('delete session buttons call onDeleteSession with the session id', async () => {
    const p = inspectorProps({ activeInspectorTab: 'history', sessions: twoSessions });
    const { container, unmount } = mount(<InspectorPanel {...p} />);
    const delBtns = [...buttons(container)].filter((b) => b.title === '删除会话');
    expect(delBtns.length).toBe(2);
    await clickAsync(delBtns[0]);
    await clickAsync(delBtns[1]);
    expect(p.onDeleteSession.calls).toEqual([['s1'], ['s2']]);
    unmount();
  });

  test('session row click switches session via onSwitchSession', async () => {
    const p = inspectorProps({ activeInspectorTab: 'history', sessions: twoSessions });
    const { container, unmount } = mount(<InspectorPanel {...p} />);
    const rows = [...container.querySelectorAll('[role="button"]')];
    expect(rows.length).toBe(2);
    await clickAsync(rows[0]);
    expect(p.onSwitchSession.calls).toEqual([['s1']]);
    unmount();
  });

  test('selecting a session reveals the bulk-delete button, which deletes the selection', async () => {
    const p = inspectorProps({ activeInspectorTab: 'history', sessions: twoSessions });
    const { container, unmount } = mount(<InspectorPanel {...p} />);
    expect(byTitle(container, '删除选中的会话')).toBeUndefined();
    // per-session checkboxes: index 0 = select-all, 1 = s1, 2 = s2
    const checkboxes = [...container.querySelectorAll('input[type="checkbox"]')];
    expect(checkboxes.length).toBe(3);
    await clickAsync(checkboxes[1]);
    const bulk = byTitle(container, '删除选中的会话');
    expect(bulk, 'bulk delete button appears after selecting a session').toBeTruthy();
    await clickAsync(bulk);
    expect(p.onDeleteSessions.calls).toEqual([[['s1']]]);
    // selection cleared after delete
    expect(byTitle(container, '删除选中的会话')).toBeUndefined();
    unmount();
  });

  test('preview config with an active URL renders all preview buttons (inventory)', () => {
    const { container, unmount } = mount(
      <InspectorPanel {...inspectorProps({
        activeInspectorTab: 'preview', activePreviewUrl: 'http://127.0.0.1:41730/',
      })}
      />,
    );
    // 6 header + 刷新 + 浏览器 + 展开 + 启动 + Go
    expect(buttons(container).length).toBe(11);
    unmount();
  });

  test('preview refresh button calls onRefreshFrame; disabled without an active URL', async () => {
    const p = inspectorProps({
      activeInspectorTab: 'preview', activePreviewUrl: 'http://127.0.0.1:41730/',
    });
    const { container, unmount } = mount(<InspectorPanel {...p} />);
    const btn = byId(container, 'preview.refresh');
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(false);
    await clickAsync(btn);
    expect(p.onRefreshFrame.callCount).toBe(1);
    unmount();

    const p2 = inspectorProps({ activeInspectorTab: 'preview', activePreviewUrl: '' });
    const r2 = mount(<InspectorPanel {...p2} />);
    const btn2 = byId(r2.container, 'preview.refresh');
    expect(btn2.disabled).toBe(true);
    await clickAsync(btn2);
    expect(p2.onRefreshFrame.callCount).toBe(0);
    r2.unmount();
  });

  test('preview browser button calls onOpenExternal with the URL; disabled without one', async () => {
    const p = inspectorProps({
      activeInspectorTab: 'preview', activePreviewUrl: 'http://127.0.0.1:41730/',
    });
    const { container, unmount } = mount(<InspectorPanel {...p} />);
    const btn = byText(container, t('common.browser'));
    expect(btn).toBeTruthy();
    await clickAsync(btn);
    expect(p.onOpenExternal.calls).toEqual([['http://127.0.0.1:41730/']]);
    unmount();

    const p2 = inspectorProps({ activeInspectorTab: 'preview', activePreviewUrl: '' });
    const r2 = mount(<InspectorPanel {...p2} />);
    const btn2 = byText(r2.container, t('common.browser'));
    expect(btn2.disabled).toBe(true);
    await clickAsync(btn2);
    expect(p2.onOpenExternal.callCount).toBe(0);
    r2.unmount();
  });

  test('start preview button calls onStartPreview with "."', async () => {
    const p = inspectorProps({
      activeInspectorTab: 'preview', activePreviewUrl: 'http://127.0.0.1:41730/',
    });
    const { container, unmount } = mount(<InspectorPanel {...p} />);
    const btn = byId(container, 'preview.start');
    expect(btn).toBeTruthy();
    await clickAsync(btn);
    expect(p.onStartPreview.calls).toEqual([['.']]);
    unmount();
  });

  test('stop preview button replaces start when a preview session is active', async () => {
    const p = inspectorProps({
      activeInspectorTab: 'preview',
      activePreviewUrl: 'http://127.0.0.1:41730/',
      previewSession: { session_id: 'sess-1', pipeline: [] },
    });
    const { container, unmount } = mount(<InspectorPanel {...p} />);
    expect(byId(container, 'preview.start')).toBeNull();
    const btn = byId(container, 'preview.stop');
    expect(btn).toBeTruthy();
    await clickAsync(btn);
    expect(p.onStopPreview.callCount).toBe(1);
    unmount();
  });

  test('preview Go submit button calls onPreviewUrlSubmit via form submit', async () => {
    const p = inspectorProps({
      activeInspectorTab: 'preview', activePreviewUrl: 'http://127.0.0.1:41730/',
    });
    const { container, unmount } = mount(<InspectorPanel {...p} />);
    const btn = byId(container, 'preview.open-url');
    expect(btn).toBeTruthy();
    await clickAsync(btn);
    expect(p.onPreviewUrlSubmit.callCount).toBe(1);
    unmount();
  });

  test('preview tab renders a second expand toggle that also calls onExpandToggle', async () => {
    const p = inspectorProps({
      activeInspectorTab: 'preview', activePreviewUrl: 'http://127.0.0.1:41730/',
    });
    const { container, unmount } = mount(<InspectorPanel {...p} />);
    const toggles = [...buttons(container)].filter(
      (b) => b.getAttribute('aria-label') === t('inspector.expand'),
    );
    expect(toggles.length).toBe(2); // header + preview tab
    await clickAsync(toggles[0]);
    await clickAsync(toggles[1]);
    expect(p.onExpandToggle.callCount).toBe(2);
    unmount();
  });
});

/* ── SidebarPanel ────────────────────────────────────────── */

describe('SidebarPanel buttons', () => {
  test('default tasks config (no sessions) renders 6 buttons (inventory)', () => {
    const { container, unmount } = mount(<SidebarPanel {...sidebarProps()} />);
    // 搜索 + 4 nav + 设置
    expect(buttons(container).length).toBe(6);
    unmount();
  });

  test('search toggle opens and closes the task search input', async () => {
    const p = sidebarProps();
    const { container, unmount } = mount(<SidebarPanel {...p} />);
    const toggle = byAria(container, '搜索任务');
    expect(toggle).toBeTruthy();
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    await clickAsync(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('关闭任务搜索');
    expect(container.querySelector('input[aria-label="搜索任务"]')).toBeTruthy();
    await clickAsync(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('input[aria-label="搜索任务"]')).toBeNull();
    unmount();
  });

  test('new task nav button calls onNewTask', async () => {
    const p = sidebarProps();
    const { container, unmount } = mount(<SidebarPanel {...p} />);
    const btn = byId(container, 'navigation.new-task');
    expect(btn).toBeTruthy();
    await clickAsync(btn);
    expect(p.onNewTask.callCount).toBe(1);
    unmount();
  });

  test('open project nav switches to the project section; does not prompt when a directory is set', async () => {
    const p = sidebarProps();
    const { container, unmount } = mount(<SidebarPanel {...p} />);
    const btn = byId(container, 'navigation.open-project');
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-current')).toBeNull();
    await clickAsync(btn);
    expect(btn.getAttribute('aria-current')).toBe('page');
    expect(p.onWorkingDirectoryChange.callCount).toBe(0);
    unmount();
  });

  test('open project nav prompts for a directory when none is set', async () => {
    const p = sidebarProps({ workingDirectory: '' });
    const { container, unmount } = mount(<SidebarPanel {...p} />);
    const btn = byId(container, 'navigation.open-project');
    await clickAsync(btn);
    expect(p.onWorkingDirectoryChange.callCount).toBe(1);
    unmount();
  });

  test('tasks nav switches section back to tasks', async () => {
    const p = sidebarProps();
    const { container, unmount } = mount(<SidebarPanel {...p} />);
    const btn = [...buttons(container)].find((b) => b.textContent.includes('已安排'));
    expect(btn).toBeTruthy();
    await clickAsync(btn);
    expect(btn.getAttribute('aria-current')).toBe('page');
    unmount();
  });

  test('tools nav calls onShowTools and switches to the tools section', async () => {
    const p = sidebarProps();
    const { container, unmount } = mount(<SidebarPanel {...p} />);
    const btn = byId(container, 'navigation.show-tools');
    expect(btn).toBeTruthy();
    await clickAsync(btn);
    expect(p.onShowTools.callCount).toBe(1);
    expect(btn.getAttribute('aria-current')).toBe('page');
    unmount();
  });

  test('config with 2 sessions renders session list buttons (inventory)', () => {
    const { container, unmount } = mount(
      <SidebarPanel {...sidebarProps({
        sessions: [{ id: 't1', title: '任务一' }, { id: 't2', title: '任务二' }],
        activeSessionId: 't1',
      })}
      />,
    );
    // 6 base + 清空 + 2 select + 2 delete
    expect(buttons(container).length).toBe(11);
    unmount();
  });

  test('session select button calls onSelectSession with the session id', async () => {
    const p = sidebarProps({ sessions: [{ id: 't1', title: '任务一' }] });
    const { container, unmount } = mount(<SidebarPanel {...p} />);
    const btn = byTitle(container, '任务一');
    expect(btn).toBeTruthy();
    await clickAsync(btn);
    expect(p.onSelectSession.calls).toEqual([['t1']]);
    unmount();
  });

  test('session delete button calls onDeleteSession with the session id', async () => {
    const p = sidebarProps({ sessions: [{ id: 't1', title: '任务一' }] });
    const { container, unmount } = mount(<SidebarPanel {...p} />);
    const btn = byAria(container, '清理任务: 任务一');
    expect(btn).toBeTruthy();
    await clickAsync(btn);
    expect(p.onDeleteSession.calls).toEqual([['t1']]);
    unmount();
  });

  test('clear sessions button calls onClearSessions', async () => {
    const p = sidebarProps({ sessions: [{ id: 't1', title: '任务一' }] });
    const { container, unmount } = mount(<SidebarPanel {...p} />);
    const btn = byId(container, 'session.clear-history');
    expect(btn).toBeTruthy();
    await clickAsync(btn);
    expect(p.onClearSessions.callCount).toBe(1);
    unmount();
  });

  test('settings footer button calls onSettings', async () => {
    const p = sidebarProps();
    const { container, unmount } = mount(<SidebarPanel {...p} />);
    const btn = byId(container, 'navigation.open-settings');
    expect(btn).toBeTruthy();
    await clickAsync(btn);
    expect(p.onSettings.callCount).toBe(1);
    unmount();
  });
});

/* ── ProjectTree ─────────────────────────────────────────── */

describe('ProjectTree buttons', () => {
  test('config with tree + active file renders refresh and close-file buttons (inventory)', () => {
    const { container, unmount } = mount(
      <ProjectTree {...treeProps({
        activeOpenFile: { path: '/workspace/proj/README.md', name: 'README.md', type: 'file' },
      })}
      />,
    );
    expect(buttons(container).length).toBe(2); // 刷新 + 关闭文件
    unmount();
  });

  test('refresh button calls onRefresh (projectTree prop)', async () => {
    const p = treeProps();
    const { container, unmount } = mount(<ProjectTree {...p} />);
    const btn = byTitle(container, '刷新文件列表');
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(false);
    await clickAsync(btn);
    expect(p.projectTree.onRefresh.callCount).toBe(1);
    unmount();
  });

  test('refresh button is disabled without a working directory and does not fire', async () => {
    const p = treeProps({ workingDirectory: '' });
    const { container, unmount } = mount(<ProjectTree {...p} />);
    const btn = byTitle(container, '刷新文件列表');
    expect(btn.disabled).toBe(true);
    await clickAsync(btn);
    expect(p.projectTree.onRefresh.callCount).toBe(0);
    unmount();
  });

  test('close-file button calls onCloseFile; hidden without an active file', async () => {
    const p = treeProps({
      activeOpenFile: { path: '/workspace/proj/README.md', name: 'README.md', type: 'file' },
    });
    const { container, unmount } = mount(<ProjectTree {...p} />);
    const btn = byTitle(container, '关闭文件');
    expect(btn).toBeTruthy();
    await clickAsync(btn);
    expect(p.onCloseFile.callCount).toBe(1);
    unmount();

    const p2 = treeProps();
    const r2 = mount(<ProjectTree {...p2} />);
    expect(buttons(r2.container).length).toBe(1); // 刷新 only
    expect(byTitle(r2.container, '关闭文件')).toBeUndefined();
    r2.unmount();
  });

  test('directory row click toggles via onToggleDirectory', async () => {
    const p = treeProps();
    const { container, unmount } = mount(<ProjectTree {...p} />);
    const dirRow = container.querySelector('[role="treeitem"]'); // src directory
    expect(dirRow).toBeTruthy();
    await clickAsync(dirRow);
    expect(p.projectTree.onToggleDirectory.calls).toEqual([['/workspace/proj/src']]);
    unmount();
  });

  test('file row click opens via onOpenFile with the entry', async () => {
    const p = treeProps();
    const { container, unmount } = mount(<ProjectTree {...p} />);
    const rows = [...container.querySelectorAll('[role="treeitem"]')];
    await clickAsync(rows[1]); // README.md
    expect(p.onOpenFile.callCount).toBe(1);
    expect(p.onOpenFile.calls[0][0]).toEqual({
      path: '/workspace/proj/README.md', name: 'README.md', type: 'file',
    });
    unmount();
  });

  test('blank-area context menu -> 新建文件 dialog -> 取消 closes without creating', async () => {
    const p = treeProps();
    const { container, unmount } = mount(<ProjectTree {...p} />);
    const treeArea = container.querySelector('[role="tree"]').parentElement;
    openContextMenu(treeArea);
    await clickMenuItem('新建文件');
    const confirmBtn = byText(container, '确定');
    expect(confirmBtn, 'InputDialog confirm button appears').toBeTruthy();
    expect(confirmBtn.disabled).toBe(true); // empty name
    await clickAsync(byText(container, '取消'));
    expect(byText(container, '确定')).toBeUndefined();
    expect(p.projectTree.onCreateFile.callCount).toBe(0);
    unmount();
  });

  test('blank-area context menu -> 新建文件 -> typing + 确定 calls onCreateFile', async () => {
    const p = treeProps();
    const { container, unmount } = mount(<ProjectTree {...p} />);
    const treeArea = container.querySelector('[role="tree"]').parentElement;
    openContextMenu(treeArea);
    await clickMenuItem('新建文件');
    const input = [...container.querySelectorAll('input[type="text"]')].at(-1); // dialog input, not the tree search input
    expect(input).toBeTruthy();
    typeInto(input, 'newfile.txt');
    const confirmBtn = byText(container, '确定');
    expect(confirmBtn.disabled).toBe(false);
    await clickAsync(confirmBtn);
    expect(p.projectTree.onCreateFile.calls).toEqual([['newfile.txt']]);
    unmount();
  });

  test('blank-area context menu -> 新建目录 -> typing + 确定 calls onCreateDirectory', async () => {
    const p = treeProps();
    const { container, unmount } = mount(<ProjectTree {...p} />);
    const treeArea = container.querySelector('[role="tree"]').parentElement;
    openContextMenu(treeArea);
    await clickMenuItem('新建目录');
    const input = [...container.querySelectorAll('input[type="text"]')].at(-1); // dialog input, not the tree search input
    expect(input).toBeTruthy();
    typeInto(input, 'newdir');
    await clickAsync(byText(container, '确定'));
    expect(p.projectTree.onCreateDirectory.calls).toEqual([['newdir']]);
    unmount();
  });

  test('file context menu -> 重命名 -> 确定 calls onRenameItem with old and new path', async () => {
    const p = treeProps();
    const { container, unmount } = mount(<ProjectTree {...p} />);
    const rows = [...container.querySelectorAll('[role="treeitem"]')];
    openContextMenu(rows[1]); // README.md
    await clickMenuItem('重命名');
    const input = [...container.querySelectorAll('input[type="text"]')].at(-1); // dialog input, not the tree search input
    expect(input).toBeTruthy();
    typeInto(input, 'readme-v2.md');
    await clickAsync(byText(container, '确定'));
    expect(p.projectTree.onRenameItem.calls).toEqual([[
      '/workspace/proj/README.md', '/workspace/proj/readme-v2.md',
    ]]);
    unmount();
  });

  test('file context menu -> 删除 -> 确认 calls onDeleteItem', async () => {
    const p = treeProps();
    const { container, unmount } = mount(<ProjectTree {...p} />);
    const rows = [...container.querySelectorAll('[role="treeitem"]')];
    openContextMenu(rows[1]);
    await clickMenuItem('删除');
    const confirmBtn = byText(container, t('common.confirm'));
    expect(confirmBtn, 'ConfirmDialog confirm button appears').toBeTruthy();
    await clickAsync(confirmBtn);
    expect(p.projectTree.onDeleteItem.calls).toEqual([['/workspace/proj/README.md']]);
    unmount();
  });

  test('file context menu -> 删除 -> 取消 closes without deleting', async () => {
    const p = treeProps();
    const { container, unmount } = mount(<ProjectTree {...p} />);
    const rows = [...container.querySelectorAll('[role="treeitem"]')];
    openContextMenu(rows[1]);
    await clickMenuItem('删除');
    const cancelBtn = byText(container, t('common.cancel'));
    expect(cancelBtn).toBeTruthy();
    await clickAsync(cancelBtn);
    expect(byText(container, t('common.confirm'))).toBeUndefined();
    expect(p.projectTree.onDeleteItem.callCount).toBe(0);
    unmount();
  });
});

/* ── InteractionConsole ──────────────────────────────────── */

describe('InteractionConsole buttons', () => {
  test('renders no buttons when idle with no messages (empty state)', () => {
    const { container, unmount } = render(
      <InteractionConsole status="idle" messages={[]} tools={[]} inputNotice={null} inputValue="" />,
    );
    expect(buttons(container).length).toBe(0);
    unmount();
  });

  test('renders no buttons even with an active run (inventory)', () => {
    const { container, unmount } = render(
      <InteractionConsole
        status="running"
        messages={[consoleMsg]}
        tools={[]}
        inputNotice={null}
        inputValue="do the thing"
      />,
    );
    expect(container.querySelector('[aria-label="interaction-console"]')).toBeTruthy();
    expect(buttons(container).length).toBe(0);
    unmount();
  });
});
