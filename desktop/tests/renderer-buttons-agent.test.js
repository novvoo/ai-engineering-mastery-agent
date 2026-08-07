/**
 * Button-interaction ("响应") tests for the "agent" component group:
 *   - AgentControl (components/AgentControl.jsx, default export)
 *   - AskUserFloatingCapsule (components/AskUserFloatingCapsule.jsx, named export)
 *   - CommandSuggestions (components/CommandSuggestions.jsx, default export)
 *   - ToolPanel (components/ToolPanel.jsx, default export)
 *
 * Every <button> each component can render is surfaced via prop configs,
 * clicked, and its response asserted (spy invoked / DOM state changed).
 *
 * NOTE: component modules (and their transitive `react-dom` imports, e.g.
 * ProjectTree -> ContextMenu -> react-dom) MUST be imported dynamically AFTER
 * installDomGlobals(). react-dom snapshots `isInputEventSupported` at module
 * load; a static import hoists it above installDomGlobals(), leaving it in
 * no-DOM mode where React's text-input onChange never handles 'input' events.
 */

import { describe, test, expect } from 'bun:test';
import React, { act } from 'react';
import {
  installDomGlobals,
  render,
  click,
  buttons,
  btnLabel,
  createSpy,
} from './helpers/render-harness.js';

installDomGlobals();

const { default: AgentControl } = await import('../renderer/components/AgentControl.jsx');
const { AskUserFloatingCapsule } = await import(
  '../renderer/components/AskUserFloatingCapsule.jsx'
);
const { default: CommandSuggestions } = await import(
  '../renderer/components/CommandSuggestions.jsx'
);
const { default: ToolPanel } = await import('../renderer/components/ToolPanel.jsx');
const { ActionLifecycleProvider } = await import(
  '../renderer/contexts/ActionLifecycleContext.jsx'
);

/** Flush pending microtasks (async handler continuations) inside act(). */
const flushAsync = () => act(async () => { await Promise.resolve(); });

const findBtn = (container, label) =>
  buttons(container).find((b) => btnLabel(b) === label);

/* ────────────────────────────────────────────────────────────────
 * AgentControl
 * Buttons in source:
 *   - 更改 (title="更改工作目录") → onWorkingDirectoryChange (always)
 *   - 刷新文件列表 (title="刷新文件列表") → handleRefresh → projectTree.onRefresh
 *     (rendered by ProjectTree; disabled when !workingDirectory ||
 *     projectTree.status === 'loading' || refresh action RUNNING)
 *   - 关闭文件 (title="关闭文件") → onCloseFile (ProjectTree; only when
 *     activeOpenFile && onCloseFile)
 * AgentControl renders ProjectTree, which requires ActionLifecycleProvider
 * (useActionLifecycleContext throws without it).
 * ──────────────────────────────────────────────────────────────── */

function renderAgentControl(props) {
  return render(
    <ActionLifecycleProvider>
      <AgentControl {...props} />
    </ActionLifecycleProvider>,
  );
}

const agentControlProps = (overrides = {}) => ({
  runtime: { status: 'idle' },
  workingDirectory: '/workspace',
  projectTree: { status: 'idle' },
  onWorkingDirectoryChange: createSpy('onWorkingDirectoryChange'),
  ...overrides,
});

describe('AgentControl', () => {
  test('inventory: default config renders 2 buttons (更改 + 刷新文件列表)', () => {
    const { container, unmount } = renderAgentControl(agentControlProps());
    expect(buttons(container).length).toBe(2);
    expect(findBtn(container, 'title="更改工作目录"')).toBeTruthy();
    expect(findBtn(container, 'title="刷新文件列表"')).toBeTruthy();
    unmount();
  });

  test('更改工作目录 button fires onWorkingDirectoryChange', () => {
    const onWorkingDirectoryChange = createSpy('onWorkingDirectoryChange');
    const { container, unmount } = renderAgentControl(
      agentControlProps({ onWorkingDirectoryChange }),
    );
    const btn = findBtn(container, 'title="更改工作目录"');
    expect(btn).toBeTruthy();
    click(btn);
    expect(onWorkingDirectoryChange.callCount).toBe(1);
    unmount();
  });

  test('刷新文件列表 button fires projectTree.onRefresh', async () => {
    const onRefresh = createSpy('onRefresh');
    const { container, unmount } = renderAgentControl(
      agentControlProps({ projectTree: { status: 'idle', onRefresh } }),
    );
    const btn = findBtn(container, 'title="刷新文件列表"');
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(false);
    click(btn);
    await flushAsync();
    expect(onRefresh.callCount).toBe(1);
    unmount();
  });

  test('刷新文件列表 is disabled while loading or without a working directory', () => {
    const onRefresh = createSpy('onRefresh');
    const loading = renderAgentControl(
      agentControlProps({ projectTree: { status: 'loading', onRefresh } }),
    );
    const refreshBtn = findBtn(loading.container, 'title="刷新文件列表"');
    expect(refreshBtn).toBeTruthy();
    expect(refreshBtn.disabled).toBe(true);
    click(refreshBtn); // must not throw
    loading.unmount();

    const noWd = renderAgentControl(
      agentControlProps({
        workingDirectory: undefined,
        projectTree: { status: 'idle', onRefresh },
      }),
    );
    const noWdBtn = findBtn(noWd.container, 'title="刷新文件列表"');
    expect(noWdBtn.disabled).toBe(true);
    noWd.unmount();
  });

  test('关闭文件 button fires onCloseFile when an open file is active', () => {
    const onCloseFile = createSpy('onCloseFile');
    const { container, unmount } = renderAgentControl(
      agentControlProps({ activeOpenFile: 'src/index.js', onCloseFile }),
    );
    // 3 buttons: 更改 + 刷新文件列表 + 关闭文件
    expect(buttons(container).length).toBe(3);
    const btn = findBtn(container, 'title="关闭文件"');
    expect(btn).toBeTruthy();
    click(btn);
    expect(onCloseFile.callCount).toBe(1);
    unmount();
  });
});

/* ────────────────────────────────────────────────────────────────
 * AskUserFloatingCapsule
 * Buttons in source (all only when isExpanded, i.e. hasActiveRequest):
 *   - × (title="收起") → handleCollapse (always while expanded)
 *   - option buttons → handleChoice(option.value) (one per askUserInfo.options)
 *   - 确认 / 拒绝 → handleChoice('确认', {confirmed:true}) / ('拒绝', {confirmed:false})
 *     (only when askUserInfo.method === 'confirm')
 *   - submit (disabled when input empty) → handleSubmit → onContinue(value)
 *     (only when NOT confirm mode)
 *   - 取消本次请求 → handleCancel → onCancel (only when hasActiveRequest && onCancel)
 * ──────────────────────────────────────────────────────────────── */

const activeQuestion = { question: 'Which option?' };
const optionInfo = { question: 'Which option?', options: ['alpha', 'beta'] };
const confirmInfo = { method: 'confirm', question: 'Confirm the action?' };

describe('AskUserFloatingCapsule', () => {
  test('inventory: default config (no active request) renders 0 buttons', () => {
    const { container, unmount } = render(
      <AskUserFloatingCapsule askUserInfo={{}} onContinue={createSpy()} />,
    );
    expect(buttons(container).length).toBe(0);
    expect(container.textContent).not.toContain('需要你的回答');
    unmount();
  });

  test('inventory: active non-confirm request with 2 options + onCancel renders 5 buttons', () => {
    const { container, unmount } = render(
      <AskUserFloatingCapsule
        askUserInfo={optionInfo}
        onContinue={createSpy()}
        onCancel={createSpy()}
      />,
    );
    expect(buttons(container).length).toBe(5); // 收起 + 2 options + submit + 取消本次请求
    unmount();
  });

  test('收起 button collapses without throwing and stays visible while a request is active', () => {
    const { container, unmount } = render(
      <AskUserFloatingCapsule askUserInfo={activeQuestion} onContinue={createSpy()} />,
    );
    const btn = findBtn(container, 'title="收起"');
    expect(btn).toBeTruthy();
    click(btn);
    // isExpanded = hasActiveRequest || manuallyExpanded — an active request
    // keeps the capsule mounted, so the response is "still mounted, no crash".
    expect(buttons(container).length).toBe(2); // 收起 + submit
    unmount();
  });

  test('option button alpha fires onContinue with its value then onDismiss', async () => {
    const onContinue = createSpy('onContinue');
    const onDismiss = createSpy('onDismiss');
    const { container, unmount } = render(
      <AskUserFloatingCapsule
        askUserInfo={optionInfo}
        onContinue={onContinue}
        onDismiss={onDismiss}
      />,
    );
    const btn = findBtn(container, 'text="alpha"');
    expect(btn).toBeTruthy();
    click(btn);
    expect(onContinue.callCount).toBe(1);
    expect(onContinue.calls[0][0]).toBe('alpha');
    await flushAsync();
    expect(onDismiss.callCount).toBe(1);
    unmount();
  });

  test('option button beta fires onContinue with its value then onDismiss', async () => {
    const onContinue = createSpy('onContinue');
    const onDismiss = createSpy('onDismiss');
    const { container, unmount } = render(
      <AskUserFloatingCapsule
        askUserInfo={optionInfo}
        onContinue={onContinue}
        onDismiss={onDismiss}
      />,
    );
    const btn = findBtn(container, 'text="beta"');
    expect(btn).toBeTruthy();
    click(btn);
    expect(onContinue.callCount).toBe(1);
    expect(onContinue.calls[0][0]).toBe('beta');
    await flushAsync();
    expect(onDismiss.callCount).toBe(1);
    unmount();
  });

  test('确认 button fires onContinue with confirmed=true', async () => {
    const onContinue = createSpy('onContinue');
    const onDismiss = createSpy('onDismiss');
    const { container, unmount } = render(
      <AskUserFloatingCapsule
        askUserInfo={confirmInfo}
        onContinue={onContinue}
        onDismiss={onDismiss}
      />,
    );
    expect(buttons(container).length).toBe(3); // 收起 + 确认 + 拒绝 (no onCancel)
    const btn = findBtn(container, 'text="确认"');
    expect(btn).toBeTruthy();
    click(btn);
    expect(onContinue.callCount).toBe(1);
    expect(onContinue.calls[0]).toEqual(['确认', { confirmed: true }]);
    await flushAsync();
    expect(onDismiss.callCount).toBe(1);
    unmount();
  });

  test('拒绝 button fires onContinue with confirmed=false', async () => {
    const onContinue = createSpy('onContinue');
    const onDismiss = createSpy('onDismiss');
    const { container, unmount } = render(
      <AskUserFloatingCapsule
        askUserInfo={confirmInfo}
        onContinue={onContinue}
        onDismiss={onDismiss}
      />,
    );
    const btn = findBtn(container, 'text="拒绝"');
    expect(btn).toBeTruthy();
    click(btn);
    expect(onContinue.callCount).toBe(1);
    expect(onContinue.calls[0]).toEqual(['拒绝', { confirmed: false }]);
    await flushAsync();
    expect(onDismiss.callCount).toBe(1);
    unmount();
  });

  test('submit button is disabled with an empty input and fires nothing', async () => {
    const onContinue = createSpy('onContinue');
    const { container, unmount } = render(
      <AskUserFloatingCapsule askUserInfo={activeQuestion} onContinue={onContinue} />,
    );
    const submit = buttons(container).find((b) => b.disabled);
    expect(submit).toBeTruthy();
    click(submit);
    await flushAsync();
    expect(onContinue.callCount).toBe(0);
    unmount();
  });

  test('submit button with typed input fires onContinue, clears input, re-disables', async () => {
    const onContinue = createSpy('onContinue');
    const onDismiss = createSpy('onDismiss');
    const { container, unmount } = render(
      <AskUserFloatingCapsule
        askUserInfo={activeQuestion}
        onContinue={onContinue}
        onDismiss={onDismiss}
      />,
    );
    const input = container.querySelector('input[type="text"]');
    expect(input).toBeTruthy();
    act(() => {
      // React 18's value tracker ignores direct `.value =` writes; use the
      // prototype setter (canonical RTL technique) so onChange fires.
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      ).set;
      setter.call(input, '  hello  ');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // The only button without a title in non-confirm mode is submit.
    const submitBtn = buttons(container).find((b) => !b.getAttribute('title'));
    expect(submitBtn).toBeTruthy();
    expect(submitBtn.disabled).toBe(false);
    click(submitBtn);
    expect(onContinue.callCount).toBe(1);
    expect(onContinue.calls[0][0]).toBe('hello');
    await flushAsync();
    expect(onDismiss.callCount).toBe(1);
    // input cleared → submit disabled again
    expect(input.value).toBe('');
    expect(buttons(container).find((b) => b.disabled)).toBeTruthy();
    unmount();
  });

  test('取消本次请求 button fires onCancel; absent when onCancel is not provided', async () => {
    const onCancel = createSpy('onCancel');
    const withCancel = render(
      <AskUserFloatingCapsule
        askUserInfo={activeQuestion}
        onContinue={createSpy()}
        onCancel={onCancel}
      />,
    );
    const btn = findBtn(withCancel.container, 'text="取消本次请求"');
    expect(btn).toBeTruthy();
    click(btn);
    expect(onCancel.callCount).toBe(1);
    await flushAsync();
    withCancel.unmount();

    const withoutCancel = render(
      <AskUserFloatingCapsule askUserInfo={activeQuestion} onContinue={createSpy()} />,
    );
    expect(findBtn(withoutCancel.container, 'text="取消本次请求"')).toBeFalsy();
    expect(buttons(withoutCancel.container).length).toBe(2); // 收起 + submit
    withoutCancel.unmount();
  });
});

/* ────────────────────────────────────────────────────────────────
 * CommandSuggestions — no <button> in source (menu rows are <div onClick>);
 * inventory only.
 * ──────────────────────────────────────────────────────────────── */

describe('CommandSuggestions', () => {
  test('inventory: renders 0 buttons (rows are divs with onClick)', () => {
    const { container, unmount } = render(
      <CommandSuggestions input="/" onSelect={createSpy('onSelect')} />,
    );
    expect(buttons(container).length).toBe(0);
    unmount();
  });
});

/* ────────────────────────────────────────────────────────────────
 * ToolPanel — no <button> in source (tool rows are <div onClick>);
 * inventory only.
 * ──────────────────────────────────────────────────────────────── */

describe('ToolPanel', () => {
  test('inventory: renders 0 buttons, empty and with tools (rows are divs with onClick)', () => {
    const empty = render(<ToolPanel />);
    expect(buttons(empty.container).length).toBe(0);
    empty.unmount();

    const withTools = render(
      <ToolPanel tools={[{ name: 'search', description: 'Search the workspace' }]} />,
    );
    expect(buttons(withTools.container).length).toBe(0);
    withTools.unmount();
  });
});
