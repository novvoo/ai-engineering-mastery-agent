/**
 * Button-interaction tests for the message-log components:
 *   - MessageLog (components/MessageLog.jsx)
 *   - RuntimeDetailsPanel (components/message-log/RuntimeDetailsPanel.jsx)
 *   - MarkdownMessageContent (components/MarkdownMessageContent.jsx)
 *
 * Every <button> a component can render is surfaced with a fixture that
 * satisfies its render condition, clicked, and its response asserted.
 */
import { describe, test, expect } from 'bun:test';
import React, { act } from 'react';
import { installDomGlobals, render, click, buttons, btnLabel, createSpy } from './helpers/render-harness.js';
import { t } from '../renderer/i18n.js';
import MessageLog from '../renderer/components/MessageLog.jsx';
import { RuntimeDetailsPanel } from '../renderer/components/message-log/RuntimeDetailsPanel.jsx';
import { MarkdownMessageContent } from '../renderer/components/MarkdownMessageContent.jsx';

installDomGlobals();

// Minimal electron API so useIPC invoke paths (activity drawer diffs, etc.)
// resolve instantly instead of waiting 3s and throwing.
window.electronAPI = { invoke: async () => ({}) };
// jsdom has no URL.createObjectURL; MessageLog's export handler builds a
// Blob URL then clicks a temporary <a>. Stub both halves.
if (typeof globalThis.URL.createObjectURL !== 'function') {
  globalThis.URL.createObjectURL = () => 'blob:mock-download';
  globalThis.URL.revokeObjectURL = () => {};
}

/** Await one macrotask so awaited async handlers (clipboard, ipc) settle. */
const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

// ── Fixtures ────────────────────────────────────────────────────────────

const userMsg = (overrides = {}) => ({
  id: 'm-user',
  type: 'user',
  content: '请检查这个项目',
  timestamp: 1000,
  ...overrides,
});

const resultMsg = { id: 'm-result', type: 'result', content: '完成', timestamp: 2000 };

const errorMsg = { id: 'm-error', type: 'error', content: '命令失败', timestamp: 3000 };

/** Minimal tool call / result pair; toolCallId keys the collection. */
const toolCall = (id, toolName, extra = {}) => ({
  id: `call-${id}`,
  type: 'tool',
  event: 'tool:call',
  toolCallId: id,
  toolName,
  timestamp: 1000 + id.length * 100,
  ...extra,
});
const toolResult = (id, toolName, result, extra = {}) => ({
  id: `res-${id}`,
  type: 'tool_result',
  event: 'tool:result',
  toolCallId: id,
  toolName,
  result,
  timestamp: 2000 + id.length * 100,
  ...extra,
});
const toolError = (id, toolName, error, extra = {}) => ({
  id: `err-${id}`,
  type: 'tool_error',
  event: 'tool:error',
  toolCallId: id,
  toolName,
  error,
  timestamp: 2000 + id.length * 100,
  ...extra,
});

const thinkingMsg = (id, content) => ({
  id,
  type: 'thinking',
  content,
  timestamp: 1500 + id.length,
});

/** Group object for direct RuntimeDetailsPanel renders. */
function makeGroup(details, opts = {}) {
  const request = { id: 'req', type: 'user', content: 'go', timestamp: 500 };
  return {
    id: opts.id || 'turn:t1',
    messages: [request, ...details],
    runtimeDetails: details,
    primaryMessage: request,
    primary: request,
  };
}

function panelProps(overrides = {}) {
  return {
    group: makeGroup([]),
    status: 'completed',
    isActiveGroup: false,
    isExpanded: true,
    isLarge: false,
    expandedRuntimeDetails: new Set(),
    getTypeDisplay: (type) => ({ iconName: 'info', text: String(type) }),
    onExport: createSpy('onExport'),
    onPanelSizeToggle: createSpy('onPanelSizeToggle'),
    onActivityAction: createSpy('onActivityAction'),
    onRefChange: createSpy('onRefChange'),
    onRuntimeDetailToggle: createSpy('onRuntimeDetailToggle'),
    onRuntimeDetailsToggle: createSpy('onRuntimeDetailsToggle'),
    ...overrides,
  };
}

// ── MessageLog ──────────────────────────────────────────────────────────

describe('MessageLog', () => {
  test('empty state renders exactly 3 starter-action buttons', () => {
    const { container, unmount } = render(<MessageLog messages={[]} />);
    const starters = buttons(container).filter((b) => b.className === 'mastery-starter-action');
    expect(buttons(container).length).toBe(3);
    expect(starters.map((b) => b.getAttribute('data-action-id'))).toEqual([
      'composer.starter.explain',
      'composer.starter.fix',
      'composer.starter.test',
    ]);
    unmount();
  });

  test('starter-action buttons fill the prompt via onStarterPrompt', () => {
    const onStarterPrompt = createSpy('onStarterPrompt');
    const { container, unmount } = render(
      <MessageLog messages={[]} onStarterPrompt={onStarterPrompt} />,
    );
    const starters = buttons(container).filter((b) => b.className === 'mastery-starter-action');
    expect(starters.length).toBe(3);
    for (const btn of starters) click(btn);
    expect(onStarterPrompt.callCount).toBe(3);
    expect(onStarterPrompt.calls[0][0]).toBe('解释这个项目的架构、关键模块和运行流程');
    expect(onStarterPrompt.calls[1][0]).toBe('检查当前项目，定位一个影响最大的实际问题并修复');
    expect(onStarterPrompt.calls[2][0]).toBe('运行项目测试，分析失败原因并修复所有相关问题');
    unmount();
  });

  test('starter-action buttons are disabled when starterPromptsEnabled=false', () => {
    const onStarterPrompt = createSpy('onStarterPrompt');
    const { container, unmount } = render(
      <MessageLog messages={[]} starterPromptsEnabled={false} onStarterPrompt={onStarterPrompt} />,
    );
    const starters = buttons(container).filter((b) => b.className === 'mastery-starter-action');
    expect(starters.length).toBe(3);
    for (const btn of starters) {
      expect(btn.disabled).toBe(true);
      click(btn);
    }
    expect(onStarterPrompt.callCount).toBe(0);
    unmount();
  });

  test('inventory: one user message renders 5 header + 1 group header + 3 message actions = 9 buttons', () => {
    const { container, unmount } = render(<MessageLog messages={[userMsg()]} />);
    expect(buttons(container).length).toBe(9);
    // header: search, list view, timeline view, autoscroll, clear
    for (const title of [t('msg.search_hint'), t('msg.list_view'), t('msg.timeline_view'), t('status.follow_new'), t('msg.clear_hint')]) {
      expect(buttons(container).some((b) => (b.getAttribute('title') || b.getAttribute('aria-label')) === title)).toBe(true);
    }
    // group collapse header
    expect(buttons(container).filter((b) => b.hasAttribute('aria-expanded')).length).toBe(1);
    // message actions: copy, details, collapse
    for (const title of [t('msg.copy_hint'), t('msg.details'), t('msg.expand')]) {
      expect(buttons(container).some((b) => b.getAttribute('title') === title)).toBe(true);
    }
    unmount();
  });

  test('search toggle reveals and hides the search input', () => {
    const { container, unmount } = render(<MessageLog messages={[userMsg()]} />);
    const searchBtn = buttons(container).find((b) => b.getAttribute('aria-label') === t('msg.search_hint'));
    expect(searchBtn).toBeTruthy();
    expect(container.querySelector('input')).toBeNull();
    click(searchBtn);
    expect(container.querySelector('input')).not.toBeNull();
    expect(container.querySelector('input').placeholder).toBe(t('msg.search_messages'));
    click(searchBtn);
    expect(container.querySelector('input')).toBeNull();
    unmount();
  });

  test('list/timeline view toggle switches rendered views', () => {
    const { container, unmount } = render(<MessageLog messages={[userMsg()]} />);
    const timelineBtn = buttons(container).find((b) => b.getAttribute('aria-label') === t('msg.timeline_view'));
    const listBtn = buttons(container).find((b) => b.getAttribute('aria-label') === t('msg.list_view'));
    expect(container.textContent).not.toContain('个会话'); // list view: no bucket headers
    click(timelineBtn);
    expect(container.textContent).toContain('个会话'); // timeline view: bucket header
    click(listBtn);
    expect(container.textContent).not.toContain('个会话');
    unmount();
  });

  test('autoscroll button flips follow/locked title', () => {
    const { container, unmount } = render(<MessageLog messages={[userMsg()]} />);
    const btn = buttons(container).find((b) => b.getAttribute('title') === t('status.follow_new'));
    expect(btn).toBeTruthy();
    click(btn);
    expect(btn.getAttribute('title')).toBe(t('status.locked'));
    expect(btn.textContent).toContain(t('status.locked_position'));
    click(btn);
    expect(btn.getAttribute('title')).toBe(t('status.follow_new'));
    unmount();
  });

  test('clear button invokes onClear', () => {
    const onClear = createSpy('onClear');
    const { container, unmount } = render(<MessageLog messages={[userMsg()]} onClear={onClear} />);
    const btn = buttons(container).find((b) => b.getAttribute('aria-label') === t('msg.clear_hint'));
    expect(btn).toBeTruthy();
    click(btn);
    expect(onClear.callCount).toBe(1);
    unmount();
  });

  test('copy button copies content and shows the copied toast', async () => {
    const { container, unmount } = render(<MessageLog messages={[userMsg()]} />);
    const copyBtn = buttons(container).find((b) => b.getAttribute('title') === t('msg.copy_hint'));
    expect(copyBtn).toBeTruthy();
    expect(container.textContent).not.toContain('已复制到剪贴板');
    await act(async () => {
      click(copyBtn);
      await flushAsync();
    });
    expect(container.textContent).toContain('已复制到剪贴板');
    // the component clears the toast via a 3s setTimeout; let it fire and
    // assert the toast disappears (no dangling timers outlive the test).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3100));
    });
    expect(container.textContent).not.toContain('已复制到剪贴板');
    unmount();
  });

  test('details button opens the message detail panel', () => {
    const { container, unmount } = render(<MessageLog messages={[userMsg()]} />);
    const btn = buttons(container).find((b) => b.getAttribute('title') === t('msg.details'));
    expect(btn).toBeTruthy();
    expect(container.textContent).not.toContain(t('msg.message_id'));
    click(btn);
    expect(container.textContent).toContain(t('msg.message_id'));
    expect(container.textContent).toContain('m-user');
    // toggling again hides it
    click(btn);
    expect(container.textContent).not.toContain(t('msg.message_id'));
    unmount();
  });

  test('collapse button collapses and expands the message body', () => {
    const longContent = 'A'.repeat(55) + 'TAILMARKER';
    const { container, unmount } = render(<MessageLog messages={[userMsg({ content: longContent })]} />);
    const btn = buttons(container).find((b) => b.getAttribute('title') === t('msg.expand'));
    expect(btn).toBeTruthy();
    expect(container.textContent).toContain('TAILMARKER');
    click(btn);
    expect(container.textContent).not.toContain('TAILMARKER'); // collapsed to 60-char preview
    click(btn);
    expect(container.textContent).toContain('TAILMARKER');
    unmount();
  });

  test('ask-agent button appears on error messages and forwards the message', () => {
    const onAskAgent = createSpy('onAskAgent');
    const { container, unmount } = render(
      <MessageLog messages={[userMsg(), errorMsg]} onAskAgent={onAskAgent} />,
    );
    // user(3 actions) + error(4 actions incl. ask-agent) + header(5) + group header(1)
    expect(buttons(container).length).toBe(13);
    const btn = buttons(container).find((b) => b.getAttribute('title') === t('msg.hand_to_agent_hint'));
    expect(btn).toBeTruthy();
    click(btn);
    expect(onAskAgent.callCount).toBe(1);
    expect(onAskAgent.calls[0][0]).toBe(errorMsg);
    unmount();
  });

  test('group collapse header collapses and re-expands a completed turn', () => {
    const { container, unmount } = render(<MessageLog messages={[userMsg(), resultMsg]} />);
    const groupBtn = buttons(container).find((b) => b.hasAttribute('aria-expanded'));
    expect(groupBtn).toBeTruthy();
    expect(groupBtn.getAttribute('aria-expanded')).toBe('true');
    expect(buttons(container).some((b) => b.getAttribute('title') === t('msg.copy_hint'))).toBe(true);
    click(groupBtn);
    expect(groupBtn.getAttribute('aria-expanded')).toBe('false');
    expect(buttons(container).some((b) => b.getAttribute('title') === t('msg.copy_hint'))).toBe(false);
    click(groupBtn);
    expect(groupBtn.getAttribute('aria-expanded')).toBe('true');
    expect(buttons(container).some((b) => b.getAttribute('title') === t('msg.copy_hint'))).toBe(true);
    unmount();
  });

  test('group collapse header of a running turn is inert (aria-disabled)', () => {
    const { container, unmount } = render(<MessageLog messages={[userMsg()]} />);
    const groupBtn = buttons(container).find((b) => b.hasAttribute('aria-expanded'));
    expect(groupBtn.getAttribute('aria-disabled')).toBe('true');
    const expandedBefore = groupBtn.getAttribute('aria-expanded');
    click(groupBtn);
    expect(groupBtn.getAttribute('aria-expanded')).toBe(expandedBefore);
    expect(buttons(container).some((b) => b.getAttribute('title') === t('msg.copy_hint'))).toBe(true);
    unmount();
  });

  test('thinking-panel toggle is unreachable (renderThinkingPanel is never rendered)', () => {
    // renderThinkingPanel (with its thinkingHeader <button>) is defined in the
    // source but never invoked from renderConversationGroup or anywhere else,
    // so a fixture with thinking messages surfaces no thinking toggle. The
    // thinking messages DO flow into the runtime-details capsule instead.
    const messages = [
      userMsg(),
      thinkingMsg('th1', 'first thought'),
      thinkingMsg('th2', 'second thought'),
    ];
    const { container, unmount } = render(<MessageLog messages={messages} status="completed" />);
    expect(buttons(container).some((b) => b.getAttribute('title') === t('msg.expand_thinking'))).toBe(false);
    unmount();
  });

  test('runtime-details capsule "详情" button opens the full panel inside MessageLog', () => {
    const messages = [userMsg(), toolCall('c1', 'read', { args: { path: 'src/alpha.txt' } }), toolResult('c1', 'read', 'alpha data')];
    const { container, unmount } = render(<MessageLog messages={messages} status="completed" />);
    const capsuleBtn = buttons(container).find((b) => b.textContent.trim() === '详情');
    expect(capsuleBtn).toBeTruthy();
    expect(container.textContent).not.toContain(t('exec.summary'));
    click(capsuleBtn);
    expect(container.textContent).toContain(t('exec.summary'));
    expect(container.textContent).toContain('src/alpha.txt');
    unmount();
  });
});

// ── RuntimeDetailsPanel ─────────────────────────────────────────────────

describe('RuntimeDetailsPanel', () => {
  const readPair = [
    toolCall('c1', 'read', { args: { path: 'src/alpha.txt' } }),
    toolResult('c1', 'read', 'alpha data'),
  ];

  test('inventory: expanded panel with one tool collection renders 19 buttons', () => {
    // view switcher(2) + intent chips(8) + phase chips(5)
    // + expand-detail(1) + header export/size/details(3) = 19.
    // The activity tab button (renderTabs) is dead code: it is defined but
    // never rendered by the panel's JSX, so it cannot be surfaced.
    const props = panelProps({ group: makeGroup(readPair) });
    const { container, unmount } = render(<RuntimeDetailsPanel {...props} />);
    expect(buttons(container).length).toBe(19);
    unmount();
  });

  test('activity tab button is unreachable (renderTabs is never rendered)', () => {
    // TABS/renderTabs exist in source (a single 'activity' tab) but the panel
    // return JSX never calls renderTabs(), so no tab <button> ever exists.
    const props = panelProps({ group: makeGroup(readPair) });
    const { container, unmount } = render(<RuntimeDetailsPanel {...props} />);
    expect(buttons(container).some((b) => b.getAttribute('title') === t('exec.activity_log'))).toBe(false);
    unmount();
  });

  test('reasoning toggle reveals the thinking messages', () => {
    const details = [...readPair, thinkingMsg('th1', 'deep reasoning text')];
    const props = panelProps({ group: makeGroup(details) });
    const { container, unmount } = render(<RuntimeDetailsPanel {...props} />);
    const btn = buttons(container).find((b) => b.textContent.includes('◇'));
    expect(btn).toBeTruthy();
    expect(container.textContent).not.toContain('deep reasoning text');
    click(btn);
    expect(container.textContent).toContain('deep reasoning text');
    click(btn);
    expect(container.textContent).not.toContain('deep reasoning text');
    unmount();
  });

  test('structured/raw view switcher swaps the activity view', () => {
    const props = panelProps({ group: makeGroup(readPair) });
    const { container, unmount } = render(<RuntimeDetailsPanel {...props} />);
    const rawBtn = buttons(container).find((b) => b.textContent.includes('☰'));
    const structuredBtn = buttons(container).find((b) => b.textContent.includes('☑'));
    expect(rawBtn).toBeTruthy();
    expect(structuredBtn).toBeTruthy();
    expect(container.querySelector('input')).not.toBeNull(); // structured: search box
    click(rawBtn);
    expect(container.querySelector('input')).toBeNull(); // raw: filter bar gone
    expect(container.textContent).toContain('alpha data'); // raw item preview
    click(structuredBtn);
    expect(container.querySelector('input')).not.toBeNull();
    unmount();
  });

  test('intent filter chip narrows the activity list', () => {
    const details = [
      toolCall('c1', 'read', { intent: 'read', args: { path: 'src/alpha.txt' } }),
      toolResult('c1', 'read', 'alpha data'),
      toolCall('c2', 'write', { intent: 'write', args: { path: 'doc/beta.txt' } }),
      toolError('c2', 'write', 'boom'),
    ];
    const props = panelProps({ group: makeGroup(details) });
    const { container, unmount } = render(<RuntimeDetailsPanel {...props} />);
    expect(container.textContent).toContain('doc/beta.txt');
    const chip = buttons(container).find((b) => b.getAttribute('title') === 'exec.file_read');
    expect(chip).toBeTruthy();
    click(chip);
    expect(container.textContent).toContain('src/alpha.txt');
    expect(container.textContent).not.toContain('doc/beta.txt');
    unmount();
  });

  test('phase filter chip narrows the activity list', () => {
    const details = [
      toolCall('c1', 'read', { args: { path: 'src/alpha.txt' } }),
      toolResult('c1', 'read', 'alpha data'),
      toolCall('c2', 'write', { args: { path: 'doc/beta.txt' } }),
      toolError('c2', 'write', 'boom'),
    ];
    const props = panelProps({ group: makeGroup(details) });
    const { container, unmount } = render(<RuntimeDetailsPanel {...props} />);
    expect(container.textContent).toContain('src/alpha.txt');
    const chip = buttons(container).find((b) => b.getAttribute('title') === 'status.failed');
    expect(chip).toBeTruthy();
    click(chip);
    expect(container.textContent).toContain('doc/beta.txt');
    expect(container.textContent).not.toContain('src/alpha.txt');
    unmount();
  });

  test('expand-detail button reveals the activity detail pre', () => {
    const props = panelProps({ group: makeGroup(readPair) });
    const { container, unmount } = render(<RuntimeDetailsPanel {...props} />);
    const btn = buttons(container).find((b) => b.getAttribute('title') === t('msg.details'));
    expect(btn).toBeTruthy();
    expect(container.textContent).not.toContain('alpha data');
    click(btn);
    expect(btn.getAttribute('title')).toBe(t('msg.hide_details'));
    expect(container.textContent).toContain('alpha data');
    click(btn);
    expect(container.textContent).not.toContain('alpha data');
    unmount();
  });

  test('show-more button reveals all activities, show-less collapses again', () => {
    const details = [];
    for (let i = 0; i < 9; i += 1) {
      details.push(toolCall(`r${i}`, 'read', { args: { path: `file${i}.txt` } }));
      details.push(toolResult(`r${i}`, 'read', `data${i}`));
    }
    const props = panelProps({ group: makeGroup(details) });
    const { container, unmount } = render(<RuntimeDetailsPanel {...props} />);
    const moreBtn = buttons(container).find((b) => b.textContent.includes('查看全部'));
    expect(moreBtn).toBeTruthy();
    expect(container.textContent).not.toContain('file0.txt'); // only last 8 shown
    click(moreBtn);
    expect(container.textContent).toContain('file0.txt');
    const lessBtn = buttons(container).find((b) => b.textContent.trim() === t('msg.collapse'));
    expect(lessBtn).toBeTruthy();
    click(lessBtn);
    expect(container.textContent).not.toContain('file0.txt');
    expect(buttons(container).some((b) => b.textContent.includes('查看全部'))).toBe(true);
    unmount();
  });

  test('header undo/review buttons open the change drawer; close button closes it', async () => {
    const details = [
      toolCall('c1', 'write', { files: [{ path: '/repo/a.txt', linesAdded: 3, operation: 'edit' }] }),
      toolResult('c1', 'write', 'ok'),
    ];
    const props = panelProps({ group: makeGroup(details) });
    const { container, unmount } = render(<RuntimeDetailsPanel {...props} />);
    const undoBtn = buttons(container).find((b) => b.textContent.trim() === '撤销');
    const reviewBtn = buttons(container).find((b) => b.textContent.trim() === '审核');
    expect(undoBtn).toBeTruthy();
    expect(reviewBtn).toBeTruthy();

    await act(async () => {
      click(undoBtn);
      await flushAsync();
    });
    expect(container.textContent).toContain('撤销变更');
    const closeBtn = buttons(container).find((b) => b.textContent.trim() === '×');
    expect(closeBtn).toBeTruthy();
    click(closeBtn);
    expect(container.textContent).not.toContain('撤销变更');

    await act(async () => {
      click(reviewBtn);
      await flushAsync();
    });
    expect(container.textContent).toContain('审核变更');
    const closeBtn2 = buttons(container).find((b) => b.textContent.trim() === '×');
    click(closeBtn2);
    expect(container.textContent).not.toContain('审核变更');
    unmount();
  });

  test('compact panel capsule 详情 button requests expansion', () => {
    const props = panelProps({ group: makeGroup(readPair), isExpanded: false });
    const { container, unmount } = render(<RuntimeDetailsPanel {...props} />);
    expect(buttons(container).length).toBe(1);
    const btn = buttons(container)[0];
    expect(btn.textContent.trim()).toBe('详情');
    click(btn);
    expect(props.onRuntimeDetailsToggle.callCount).toBe(1);
    expect(props.onRuntimeDetailsToggle.calls[0][0]).toBe('turn:t1');
    unmount();
  });

  test('export button forwards the group to onExport', () => {
    const group = makeGroup(readPair);
    const props = panelProps({ group });
    const { container, unmount } = render(<RuntimeDetailsPanel {...props} />);
    const btn = buttons(container).find((b) => b.getAttribute('aria-label') === t('common.export'));
    expect(btn).toBeTruthy();
    click(btn);
    expect(props.onExport.callCount).toBe(1);
    expect(props.onExport.calls[0][0]).toBe(group);
    unmount();
  });

  test('size toggle button forwards the panel id to onPanelSizeToggle', () => {
    const group = makeGroup(readPair);
    const props = panelProps({ group });
    const { container, unmount } = render(<RuntimeDetailsPanel {...props} />);
    const btn = buttons(container).find((b) => b.getAttribute('aria-label') === t('msg.expand'));
    expect(btn).toBeTruthy();
    click(btn);
    expect(props.onPanelSizeToggle.callCount).toBe(1);
    expect(props.onPanelSizeToggle.calls[0][0]).toBe('turn:t1');
    unmount();
  });

  test('details toggle button forwards the panel id to onRuntimeDetailsToggle', () => {
    const group = makeGroup(readPair);
    const props = panelProps({ group });
    const { container, unmount } = render(<RuntimeDetailsPanel {...props} />);
    const btn = buttons(container).find((b) => b.getAttribute('aria-label') === t('msg.hide_details'));
    expect(btn).toBeTruthy();
    click(btn);
    expect(props.onRuntimeDetailsToggle.callCount).toBe(1);
    expect(props.onRuntimeDetailsToggle.calls[0][0]).toBe('turn:t1');
    unmount();
  });

  test('per-activity undo/review buttons never render (no producer sets canUndo/canReview)', () => {
    const details = [
      toolCall('c1', 'read', { args: { path: 'src/alpha.txt' } }),
      toolResult('c1', 'read', 'alpha data'),
      toolCall('c2', 'write', { intent: 'write', args: { path: 'doc/beta.txt' } }),
      toolError('c2', 'write', 'boom'),
    ];
    const props = panelProps({ group: makeGroup(details) });
    const { container, unmount } = render(<RuntimeDetailsPanel {...props} />);
    // buildActivitySummary never sets canUndo/canReview on activities, so the
    // per-activity undo/review buttons are unreachable with real data. Assert
    // they stay absent while the header undo/review buttons exist.
    expect(buttons(container).some((b) => b.getAttribute('title') === t('exec.ask_revert'))).toBe(false);
    expect(buttons(container).some((b) => b.getAttribute('title') === t('exec.review_change'))).toBe(false);
    expect(buttons(container).some((b) => b.textContent.trim() === '撤销')).toBe(false); // header buttons need file changes
    unmount();
  });

  test('panel returns null (no buttons) when there is no runtime detail', () => {
    const props = panelProps({ group: makeGroup([]) });
    const { container, unmount } = render(<RuntimeDetailsPanel {...props} />);
    expect(buttons(container).length).toBe(0);
    unmount();
  });
});

// ── MarkdownMessageContent ──────────────────────────────────────────────

describe('MarkdownMessageContent', () => {
  test('inventory: renders markdown without any buttons', () => {
    const { container, unmount } = render(
      <MarkdownMessageContent text={'Hello **world** — [link](https://example.com)'} />,
    );
    expect(buttons(container).length).toBe(0);
    expect(container.textContent).toContain('Hello');
    unmount();
  });

  test('collapsed render also produces no buttons', () => {
    const { container, unmount } = render(
      <MarkdownMessageContent text="plain text" isCollapsed />,
    );
    expect(buttons(container).length).toBe(0);
    unmount();
  });

  test('empty text renders nothing', () => {
    const { container, unmount } = render(<MarkdownMessageContent text="" />);
    expect(container.textContent).toBe('');
    expect(buttons(container).length).toBe(0);
    unmount();
  });
});
