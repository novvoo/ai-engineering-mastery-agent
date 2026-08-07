/**
 * Button-interaction ("响应") tests for desktop/renderer/components/ui/*.
 *
 * Every <button> each component can render is surfaced, clicked, and its
 * response asserted (spy invoked / state flipped / disabled blocks).
 * Runs on jsdom via the shared harness — no electronAPI stub needed here
 * (none of these components touch useIPC).
 */
import React, { useState } from 'react';
import { describe, test, expect } from 'bun:test';
import {
  installDomGlobals,
  render,
  click,
  buttons,
  btnLabel,
  createSpy,
  type,
} from './helpers/render-harness.js';

installDomGlobals();

// Dynamic imports AFTER installDomGlobals(): react-dom computes
// `isInputEventSupported` at module load, and a static `import { act } from
// 'react'` (or any static react-dom import) hoists above the DOM install,
// silently breaking controlled-input onChange. Loading the components here
// keeps react-dom evaluation after jsdom is in place.
const { default: Button } = await import('../renderer/components/ui/Button.jsx');
const { default: Switch } = await import('../renderer/components/ui/Switch.jsx');
const { TabGroup, TabItem } = await import('../renderer/components/ui/Tab.jsx');
const { default: ConfirmDialog } = await import('../renderer/components/ui/ConfirmDialog.jsx');
const { default: InputDialog } = await import('../renderer/components/ui/InputDialog.jsx');
const { default: ContextMenu } = await import('../renderer/components/ui/ContextMenu.jsx');
const { default: Badge } = await import('../renderer/components/ui/Badge.jsx');
const { default: Panel, PanelHeader } = await import('../renderer/components/ui/Panel.jsx');
const { default: EmptyState } = await import('../renderer/components/ui/EmptyState.jsx');
const { default: Icon } = await import('../renderer/components/ui/Icon.jsx');

/** find the button whose trimmed textContent equals `text` */
function byText(list, text) {
  return list.find((b) => (b.textContent || '').trim() === text);
}

describe('Button', () => {
  test('inventory: renders exactly 1 button', () => {
    const { container, unmount } = render(<Button>Save</Button>);
    expect(buttons(container).length).toBe(1);
    unmount();
  });

  test(`click on ${btnLabel({ textContent: 'Save' })} fires onClick`, () => {
    const spy = createSpy('onClick');
    const { container, unmount } = render(<Button onClick={spy}>Save</Button>);
    click(buttons(container)[0]);
    expect(spy.callCount).toBe(1);
    expect(spy.calls[0]).toHaveLength(1); // receives the SyntheticEvent
    unmount();
  });

  test('disabled blocks onClick (handler NOT fired)', () => {
    const spy = createSpy('onClick');
    const { container, unmount } = render(<Button disabled onClick={spy}>Save</Button>);
    const btn = buttons(container)[0];
    expect(btn.disabled).toBe(true);
    click(btn);
    expect(spy.callCount).toBe(0);
    unmount();
  });

  test('busy disables the button (aria-busy + disabled) and blocks onClick', () => {
    const spy = createSpy('onClick');
    const { container, unmount } = render(<Button busy onClick={spy}>Deploy</Button>);
    const btn = buttons(container)[0];
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-busy')).toBe('true');
    click(btn);
    expect(spy.callCount).toBe(0);
    unmount();
  });

  test('pressed renders aria-pressed and passes actionId + aria-label', () => {
    const { container, unmount } = render(
      <Button pressed actionId="pin" ariaLabel="Pin chat">Pin</Button>
    );
    const btn = buttons(container)[0];
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.getAttribute('data-action-id')).toBe('pin');
    expect(btn.getAttribute('aria-label')).toBe('Pin chat');
    unmount();
  });

  test('unpressed renders no aria-pressed attribute; variant maps to btn-* class', () => {
    const { container, unmount } = render(
      <Button variant="primary" size="sm">Go</Button>
    );
    const btn = buttons(container)[0];
    expect(btn.getAttribute('aria-pressed')).toBeNull();
    expect(btn.className).toContain('btn-primary');
    expect(btn.className).toContain('btn-sm');
    unmount();
  });
});

describe('Switch', () => {
  test('inventory: renders exactly 1 role=switch button', () => {
    const { container, unmount } = render(<Switch ariaLabel="Notifications" />);
    const list = buttons(container);
    expect(list.length).toBe(1);
    expect(list[0].getAttribute('role')).toBe('switch');
    unmount();
  });

  test(`click on unchecked switch fires onChange(!checked) = onChange(true)`, () => {
    const spy = createSpy('onChange');
    const { container, unmount } = render(<Switch checked={false} onChange={spy} />);
    click(buttons(container)[0]);
    expect(spy.callCount).toBe(1);
    expect(spy.calls[0]).toEqual([true]);
    unmount();
  });

  test(`click on checked switch fires onChange(false)`, () => {
    const spy = createSpy('onChange');
    const { container, unmount } = render(<Switch checked onChange={spy} />);
    const btn = buttons(container)[0];
    expect(btn.getAttribute('aria-checked')).toBe('true');
    click(btn);
    expect(spy.callCount).toBe(1);
    expect(spy.calls[0]).toEqual([false]);
    unmount();
  });

  test('disabled switch blocks onChange and keeps aria-checked', () => {
    const spy = createSpy('onChange');
    const { container, unmount } = render(<Switch checked disabled onChange={spy} />);
    const btn = buttons(container)[0];
    expect(btn.disabled).toBe(true);
    click(btn);
    expect(spy.callCount).toBe(0);
    expect(btn.getAttribute('aria-checked')).toBe('true');
    unmount();
  });

  test('aria-label is forwarded to the button', () => {
    const { container, unmount } = render(<Switch ariaLabel="Dark mode" />);
    expect(buttons(container)[0].getAttribute('aria-label')).toBe('Dark mode');
    unmount();
  });
});

describe('Tab', () => {
  function Tabs({ onChange }) {
    const [active, setActive] = useState('a');
    return (
      <TabGroup
        activeTab={active}
        onChange={(id) => {
          onChange(id);
          setActive(id);
        }}
      >
        <TabItem id="a">Tab A</TabItem>
        <TabItem id="b">Tab B</TabItem>
      </TabGroup>
    );
  }

  test('inventory: one role=tab button per TabItem', () => {
    const { container, unmount } = render(
      <TabGroup activeTab="a" onChange={() => {}}>
        <TabItem id="a">A</TabItem>
        <TabItem id="b">B</TabItem>
      </TabGroup>
    );
    const list = buttons(container);
    expect(list.length).toBe(2);
    for (const b of list) expect(b.getAttribute('role')).toBe('tab');
    unmount();
  });

  test(`click on inactive tab fires onChange(id) and switches the active tab`, () => {
    const spy = createSpy('onChange');
    const { container, unmount } = render(<Tabs onChange={spy} />);
    const tabB = byText(buttons(container), 'Tab B');
    expect(tabB.getAttribute('aria-selected')).toBe('false');
    expect(tabB.tabIndex).toBe(-1);
    click(tabB);
    expect(spy.callCount).toBe(1);
    expect(spy.calls[0]).toEqual(['b']);
    expect(tabB.getAttribute('aria-selected')).toBe('true');
    expect(tabB.tabIndex).toBe(0);
    const tabA = byText(buttons(container), 'Tab A');
    expect(tabA.getAttribute('aria-selected')).toBe('false');
    unmount();
  });

  test(`click on the already-active tab still fires onChange(id)`, () => {
    const spy = createSpy('onChange');
    const { container, unmount } = render(<Tabs onChange={spy} />);
    click(byText(buttons(container), 'Tab A'));
    expect(spy.callCount).toBe(1);
    expect(spy.calls[0]).toEqual(['a']);
    unmount();
  });
});

describe('ConfirmDialog', () => {
  test('inventory: closed dialog renders no buttons', () => {
    const { container, unmount } = render(
      <ConfirmDialog isOpen={false} title="T" message="M" />
    );
    expect(buttons(container).length).toBe(0);
    unmount();
  });

  test('inventory: open dialog renders cancel + confirm buttons', () => {
    const { container, unmount } = render(
      <ConfirmDialog isOpen title="T" message="M" />
    );
    expect(buttons(container).length).toBe(2);
    unmount();
  });

  test(`click on cancel button fires onCancel`, () => {
    const onCancel = createSpy('onCancel');
    const onConfirm = createSpy('onConfirm');
    const { container, unmount } = render(
      <ConfirmDialog isOpen title="Delete?" message="Sure?" cancelText="No" confirmText="Yes" onCancel={onCancel} onConfirm={onConfirm} />
    );
    click(byText(buttons(container), 'No'));
    expect(onCancel.callCount).toBe(1);
    expect(onConfirm.callCount).toBe(0);
    unmount();
  });

  test(`click on confirm button fires onConfirm (and not onCancel)`, () => {
    const onCancel = createSpy('onCancel');
    const onConfirm = createSpy('onConfirm');
    const { container, unmount } = render(
      <ConfirmDialog isOpen title="Delete?" message="Sure?" cancelText="No" confirmText="Yes" onCancel={onCancel} onConfirm={onConfirm} />
    );
    click(byText(buttons(container), 'Yes'));
    expect(onConfirm.callCount).toBe(1);
    expect(onCancel.callCount).toBe(0);
    unmount();
  });

  test('danger variant: still 2 buttons, confirm styled danger, click fires onConfirm', () => {
    const onConfirm = createSpy('onConfirm');
    const { container, unmount } = render(
      <ConfirmDialog isOpen danger title="Delete" message="Irreversible" confirmText="Delete" onConfirm={onConfirm} />
    );
    const list = buttons(container);
    expect(list.length).toBe(2);
    const confirmBtn = byText(list, 'Delete');
    expect(confirmBtn.style.backgroundColor).toBe('var(--error-color)');
    click(confirmBtn);
    expect(onConfirm.callCount).toBe(1);
    unmount();
  });
});

describe('InputDialog', () => {
  test('inventory: renders cancel + confirm buttons', () => {
    const { container, unmount } = render(<InputDialog title="T" label="L" />);
    expect(buttons(container).length).toBe(2);
    unmount();
  });

  test(`click on cancel button fires onCancel`, () => {
    const onCancel = createSpy('onCancel');
    const onConfirm = createSpy('onConfirm');
    const { container, unmount } = render(
      <InputDialog title="T" label="L" cancelText="Abort" confirmText="OK" onCancel={onCancel} onConfirm={onConfirm} />
    );
    click(byText(buttons(container), 'Abort'));
    expect(onCancel.callCount).toBe(1);
    expect(onConfirm.callCount).toBe(0);
    unmount();
  });

  test('empty input disables confirm; click does not fire onConfirm', () => {
    const onConfirm = createSpy('onConfirm');
    const { container, unmount } = render(
      <InputDialog title="T" label="L" confirmText="OK" onConfirm={onConfirm} />
    );
    const confirmBtn = byText(buttons(container), 'OK');
    expect(confirmBtn.disabled).toBe(true);
    click(confirmBtn);
    expect(onConfirm.callCount).toBe(0);
    unmount();
  });

  test(`click on confirm with defaultValue fires onConfirm(trimmed value)`, () => {
    const onConfirm = createSpy('onConfirm');
    const { container, unmount } = render(
      <InputDialog title="T" label="L" defaultValue="  hello  " confirmText="OK" onConfirm={onConfirm} />
    );
    const confirmBtn = byText(buttons(container), 'OK');
    expect(confirmBtn.disabled).toBe(false);
    click(confirmBtn);
    expect(onConfirm.callCount).toBe(1);
    expect(onConfirm.calls[0]).toEqual(['hello']);
    unmount();
  });

  test('typing in the input enables confirm and submits the new value', () => {
    const onConfirm = createSpy('onConfirm');
    const { container, unmount } = render(
      <InputDialog title="T" label="L" confirmText="OK" onConfirm={onConfirm} />
    );
    const input = container.querySelector('input');
    expect(byText(buttons(container), 'OK').disabled).toBe(true);
    type(input, 'typed value');
    const confirmBtn = byText(buttons(container), 'OK');
    expect(confirmBtn.disabled).toBe(false);
    click(confirmBtn);
    expect(onConfirm.callCount).toBe(1);
    expect(onConfirm.calls[0]).toEqual(['typed value']);
    unmount();
  });

  test('danger variant styles confirm with error color and still submits', () => {
    const onConfirm = createSpy('onConfirm');
    const { container, unmount } = render(
      <InputDialog danger title="T" label="L" defaultValue="x" confirmText="Delete" onConfirm={onConfirm} />
    );
    const confirmBtn = byText(buttons(container), 'Delete');
    expect(confirmBtn.style.backgroundColor).toBe('var(--error-color)');
    click(confirmBtn);
    expect(onConfirm.callCount).toBe(1);
    expect(onConfirm.calls[0]).toEqual(['x']);
    unmount();
  });
});

describe('ContextMenu', () => {
  const items = [
    { id: 'rename', label: 'Rename', onClick: createSpy('rename') },
    { id: 'div', type: 'divider' },
    { id: 'delete', label: 'Delete', danger: true, onClick: createSpy('delete') },
  ];

  /**
   * ContextMenu portals into document.body, so menu items never live inside
   * `container`. Locate a menu item div by its label + React onClick prop
   * (the wrapper div concatenates child text, so label alone is ambiguous).
   */
  function menuItemByLabel(label) {
    return Array.from(document.body.querySelectorAll('div')).find((d) => {
      const propsKey = Object.keys(d).find((k) => k.startsWith('__reactProps'));
      return propsKey && typeof d[propsKey].onClick === 'function' && (d.textContent || '').trim() === label;
    });
  }

  test('inventory: menu items are <div>s, not <button>s — 0 buttons rendered', () => {
    const { container, unmount } = render(<ContextMenu x={10} y={10} items={items} onClose={() => {}} />);
    // items portal into document.body; the harness container never holds them
    expect(buttons(container).length).toBe(0);
    const itemEl = menuItemByLabel('Rename');
    expect(itemEl).toBeTruthy();
    expect(itemEl.tagName).toBe('DIV');
    expect(itemEl.closest('button')).toBeNull();
    // the whole portaled menu subtree contains no <button> either
    expect(itemEl.parentElement.querySelectorAll('button').length).toBe(0);
    unmount();
  });

  test('clicking a menu item fires item.onClick + onClose', () => {
    const onClose = createSpy('onClose');
    const { unmount } = render(<ContextMenu x={10} y={10} items={items} onClose={onClose} />);
    click(menuItemByLabel('Rename'));
    expect(items[0].onClick.callCount).toBe(1);
    expect(onClose.callCount).toBe(1);
    expect(items[2].onClick.callCount).toBe(0);
    unmount();
  });
});

describe('Badge', () => {
  test('inventory: renders no buttons', () => {
    const { container, unmount } = render(<Badge variant="success">Ready</Badge>);
    expect(buttons(container).length).toBe(0);
    expect(container.textContent).toContain('Ready');
    unmount();
  });
});

describe('Panel', () => {
  test('inventory: Panel renders no buttons by default', () => {
    const { container, unmount } = render(<Panel>Content</Panel>);
    expect(buttons(container).length).toBe(0);
    unmount();
  });

  test('inventory: collapsed Panel renders nothing', () => {
    const { container, unmount } = render(<Panel variant="sidebar" collapsed>Content</Panel>);
    expect(container.children.length).toBe(0);
    expect(buttons(container).length).toBe(0);
    unmount();
  });

  test('PanelHeader renders action buttons given via `actions` and they are clickable', () => {
    const spy = createSpy('action');
    const { container, unmount } = render(
      <PanelHeader title="Header" actions={<button onClick={spy}>Open</button>} />
    );
    const list = buttons(container);
    expect(list.length).toBe(1);
    click(list[0]);
    expect(spy.callCount).toBe(1);
    unmount();
  });
});

describe('EmptyState', () => {
  test('inventory: renders no buttons without an action', () => {
    const { container, unmount } = render(<EmptyState title="Nothing here" />);
    expect(buttons(container).length).toBe(0);
    unmount();
  });

  test('action slot button is clickable', () => {
    const spy = createSpy('action');
    const { container, unmount } = render(
      <EmptyState title="Nothing here" action={<button onClick={spy}>Retry</button>} />
    );
    const list = buttons(container);
    expect(list.length).toBe(1);
    click(list[0]);
    expect(spy.callCount).toBe(1);
    unmount();
  });
});

describe('Icon', () => {
  test('inventory: renders an svg, no buttons', () => {
    const { container, unmount } = render(<Icon name="agent" />);
    expect(buttons(container).length).toBe(0);
    expect(container.querySelector('svg')).toBeTruthy();
    unmount();
  });
});
