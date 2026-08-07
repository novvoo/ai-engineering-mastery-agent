import React from 'react';
import { describe, test, expect } from 'bun:test';
import { installDomGlobals, render, createSpy, type } from './helpers/render-harness.js';

installDomGlobals();

const { ProjectTree } = await import('../renderer/components/workbench/ProjectTree.jsx');
const { ActionLifecycleProvider } = await import('../renderer/contexts/ActionLifecycleContext.jsx');

function treeProps(overrides = {}) {
  return {
    projectTree: {
      type: 'directory', name: 'proj', path: '/workspace/proj',
      children: [
        { type: 'directory', name: 'src', path: '/workspace/proj/src', children: [] },
        { type: 'file', name: 'README.md', path: '/workspace/proj/README.md', children: [] },
      ],
      onToggleDirectory: createSpy('onToggleDirectory'),
      onOpenFile: createSpy('onOpenFile'),
      onRefresh: createSpy('onRefresh'),
      onCloseFile: createSpy('onCloseFile'),
      onCreateFile: createSpy('onCreateFile'),
      onCreateDirectory: createSpy('onCreateDirectory'),
      onRenameItem: createSpy('onRenameItem'),
      onDeleteItem: createSpy('onDeleteItem'),
    },
    workingDirectory: '/workspace/proj',
    ...overrides,
  };
}

async function clickAsync(el) {
  const { act } = require('react');
  await act(async () => {
    el.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true, cancelable: true }));
    for (let i = 0; i < 50; i += 1) await Promise.resolve();
  });
}

function openContextMenu(el, x = 120, y = 90) {
  const { act } = require('react');
  act(() => {
    el.dispatchEvent(new globalThis.MouseEvent('contextmenu', {
      bubbles: true, cancelable: true, clientX: x, clientY: y,
    }));
  });
}

describe('probe', () => {
  test('probe typing into InputDialog inside ProjectTree', async () => {
    const p = treeProps();
    const { container, unmount } = render(
      <ActionLifecycleProvider><ProjectTree {...p} /></ActionLifecycleProvider>
    );
    const treeArea = container.querySelector('[role="tree"]').parentElement;
    openContextMenu(treeArea);
    const span = [...globalThis.document.body.querySelectorAll('span')]
      .find((s) => (s.textContent || '').trim() === '新建文件');
    expect(span).toBeTruthy();
    await clickAsync(span.parentElement);
    const input = container.querySelector('input[type="text"]');
    expect(input).toBeTruthy();
    const findConfirm = () => [...container.querySelectorAll('button')]
      .find((b) => (b.textContent || '').trim() === '确定');
    const before = findConfirm();
    console.log('BEFORE type: input.value=', JSON.stringify(input.value), 'confirm.disabled=', before?.disabled);
    type(input, 'probe.txt');
    const after = findConfirm();
    console.log('AFTER type:  input.value=', JSON.stringify(input.value), 'confirm2.disabled=', after?.disabled, 'same node?', before === after);
    expect(input.value).toBe('probe.txt');
    expect(after.disabled).toBe(false);
    await clickAsync(after);
    console.log('onCreateFile calls:', JSON.stringify(p.projectTree.onCreateFile.calls));
    expect(p.projectTree.onCreateFile.calls).toEqual([['probe.txt']]);
    unmount();
  });
});
