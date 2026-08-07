import { describe, test, expect } from 'bun:test';
import React from 'react';
import { installDomGlobals, render, click, buttons, btnLabel, createSpy } from './helpers/render-harness.js';
import Button from '../renderer/components/ui/Button.jsx';
import Switch from '../renderer/components/ui/Switch.jsx';

installDomGlobals();

describe('harness smoke', () => {
  test('Button responds to click', () => {
    const onClick = createSpy('onClick');
    const { container, unmount } = render(<Button onClick={onClick}>Go</Button>);
    const list = buttons(container);
    expect(list.length).toBe(1);
    click(list[0]);
    expect(onClick.callCount).toBe(1);
    unmount();
  });

  test('Button disabled blocks click', () => {
    const onClick = createSpy('onClick');
    const { container, unmount } = render(<Button disabled onClick={onClick}>Go</Button>);
    const btn = buttons(container)[0];
    expect(btn.disabled).toBe(true);
    click(btn);
    expect(onClick.callCount).toBe(0);
    unmount();
  });

  test('Switch toggles checked state', () => {
    const onChange = createSpy('onChange');
    const { container, unmount } = render(<Switch checked={false} onChange={onChange} ariaLabel="theme" />);
    const btn = buttons(container)[0];
    expect(btn.getAttribute('role')).toBe('switch');
    click(btn);
    expect(onChange.callCount).toBe(1);
    expect(onChange.calls[0][0]).toBe(true);
    expect(btnLabel(btn)).toContain('theme');
    unmount();
  });
});
