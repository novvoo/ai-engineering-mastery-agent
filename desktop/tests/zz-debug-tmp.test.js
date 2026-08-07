import React, { act } from 'react';
import { test } from 'bun:test';
import { installDomGlobals, render, buttons, btnLabel, createSpy } from './helpers/render-harness.js';
import { ActionLifecycleProvider } from '../renderer/contexts/ActionLifecycleContext.jsx';
import { SidebarPanel } from '../renderer/components/workbench/SidebarPanel.jsx';

installDomGlobals();

const elProto = globalThis.HTMLElement?.prototype;
if (elProto && !elProto.attachEvent) {
  elProto.attachEvent = () => {};
  elProto.detachEvent = () => {};
}

function spyProps(names) {
  const out = {};
  for (const name of names) out[name] = createSpy(name);
  return out;
}

test('which events reach React onChange on a controlled text input', () => {
  const { container, unmount } = render(
    React.createElement('div', null,
      React.createElement('input', {
        value: '',
        onChange: () => { window.__fired = (window.__fired || 0) + 1; },
      }),
    ),
  );
  const input = container.querySelector('input');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const events = ['focusin', 'focus', 'keydown', 'keypress', 'keyup', 'input', 'change', 'selectionchange', 'paste', 'blur', 'focusout'];
  for (const evName of events) {
    window.__fired = 0;
    act(() => {
      setter.call(input, 'v-' + evName);
      let ev;
      if (evName === 'focusin' || evName === 'focusout' || evName === 'focus' || evName === 'blur') {
        ev = new FocusEvent(evName);
      } else if (evName === 'keydown' || evName === 'keypress' || evName === 'keyup') {
        ev = new KeyboardEvent(evName, { bubbles: true, key: 'a' });
      } else if (evName === 'selectionchange') {
        ev = new Event(evName);
      } else if (evName === 'paste') {
        ev = new ClipboardEvent('paste', { bubbles: true, clipboardData: null });
      } else {
        ev = new Event(evName, { bubbles: true });
      }
      input.dispatchEvent(ev);
    });
    if (window.__fired > 0) {
      console.log('  EVENT', evName, '-> onChange fired:', window.__fired);
    } else {
      console.log('  EVENT', evName, '-> no onChange');
    }
  }
  unmount();
});

test('sidebar select: React props on button + host capture listener', () => {
  const p = {
    activeTab: 'chat',
    runtime: { status: 'idle', tools: [], loading: false, messages: [], stats: null },
    workingDirectory: '/workspace/proj',
    workingDirectorySyncMessage: '',
    agentOptions: {},
    sessions: [{ id: 't1', title: '任务一' }],
    activeSessionId: null,
    projectTree: {},
    ...spyProps([
      'onOptionsChange', 'onInsertText', 'onWorkingDirectoryChange', 'onNewTask',
      'onOpenFile', 'onCloseFile', 'onSelectSession', 'onDeleteSession',
      'onClearSessions', 'onShowTools', 'onSettings',
    ]),
  };
  const { container, unmount } = render(<ActionLifecycleProvider><SidebarPanel {...p} /></ActionLifecycleProvider>);
  const btn = [...buttons(container)].find((b) => b.getAttribute('title') === '任务一');
  const reactKey = Object.keys(btn).find((k) => k.startsWith('__reactProps$'));
  console.log('reactProps on select btn:', reactKey ? JSON.stringify(Object.keys(btn[reactKey])) : 'NONE');
  console.log('onClick present:', reactKey ? typeof btn[reactKey].onClick : 'n/a');
  const navBtn = [...buttons(container)].find((b) => b.getAttribute('data-action-id') === 'navigation.new-task');
  const navKey = Object.keys(navBtn).find((k) => k.startsWith('__reactProps$'));
  console.log('onClick present on nav btn:', navKey ? typeof navBtn[navKey].onClick : 'n/a');
  const seen = [];
  container.addEventListener('click', (e) => seen.push(e.target === btn ? 'target=btn' : 'other'), true);
  act(() => {
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  console.log('host capture saw click:', JSON.stringify(seen), '| onSelectSession:', JSON.stringify(p.onSelectSession.calls));
  unmount();
});

test('input: does dispatching on the root container work instead', () => {
  const { container, unmount } = render(
    React.createElement('div', null,
      React.createElement('input', {
        value: '',
        onChange: () => { window.__fired = (window.__fired || 0) + 1; },
      }),
    ),
  );
  const input = container.querySelector('input');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  window.__fired = 0;
  act(() => {
    setter.call(input, 'xyz');
    container.dispatchEvent(new Event('input', { bubbles: true }));
  });
  console.log('input dispatched on container -> onChange:', window.__fired);
  unmount();
});
