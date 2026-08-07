import React from 'react';
import { describe, test, expect } from 'bun:test';
import { installDomGlobals, render, buttons, createSpy, type } from './helpers/render-harness.js';

installDomGlobals();

const { InputDialog } = await import('../renderer/components/ui/InputDialog.jsx');

describe('probe2', () => {
  test('bare InputDialog typing enables confirm', () => {
    const onConfirm = createSpy('onConfirm');
    const { container, unmount } = render(
      <InputDialog title="T" label="L" confirmText="OK" onConfirm={onConfirm} />
    );
    const input = container.querySelector('input');
    const findOK = () => buttons(container).find((b) => (b.textContent || '').trim() === 'OK');
    console.log('before: disabled=', findOK().disabled);
    type(input, 'hello');
    console.log('after input event: value=', JSON.stringify(input.value), 'disabled=', findOK().disabled);
    const { act } = require('react');
    let viaChange = false;
    act(() => {
      input.dispatchEvent(new globalThis.Event('change', { bubbles: true }));
    });
    console.log('after change event: disabled=', findOK().disabled);
    expect(findOK().disabled).toBe(false);
    unmount();
  });
});
