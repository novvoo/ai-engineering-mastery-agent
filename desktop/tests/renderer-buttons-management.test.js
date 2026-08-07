/**
 * Button-interaction ("响应") tests for desktop/renderer/components/management/*.
 *
 * Covers every <button> each component can render:
 *   - ManagementPage  — tab buttons (role=tab) + close button (+ Escape key).
 *   - ModelManagement — provider group header toggles, add-model, per-card
 *                       switch/edit/delete, and the edit-form cancel/save.
 *   - McpManagement   — add-server (empty-state + footer), per-server
 *                       connect/disconnect (conditional on status), delete,
 *                       and the add-form cancel/save (name input gates save).
 *
 * Runs on jsdom via the shared harness. No window.electronAPI stub needed:
 * none of these components touch useIPC.
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
} from './helpers/render-harness.js';
import ManagementPage from '../renderer/components/management/ManagementPage.jsx';
import ModelManagement from '../renderer/components/management/ModelManagement.jsx';
import McpManagement from '../renderer/components/management/McpManagement.jsx';
import { t } from '../renderer/i18n.js';
import { LLM_PROVIDER_OPTIONS } from '../renderer/app/config/index.js';

const dom = installDomGlobals();

/** localized button titles/labels (kept in one place so tests stay robust) */
const L = {
  close: t('common.close'),
  edit: t('common.edit'),
  deleteModel: t('management.delete_model'),
  delete: t('management.delete'),
  cancel: t('common.cancel'),
  save: t('common.save'),
  connect: t('management.mcp_connect'),
  disconnect: t('management.mcp_disconnect'),
  enable: t('management.enable'),
  disable: t('management.disable'),
  addModel: t('management.add_model'),
  addServer: t('management.mcp_add_server'),
  models: t('management.models'),
  general: t('management.general'),
};

/** first button whose `title` attribute equals `title` */
function byTitle(container, title) {
  return buttons(container).find((b) => b.getAttribute('title') === title);
}

/** first button whose textContent contains `text` */
function byText(container, text) {
  return buttons(container).find((b) => (b.textContent || '').includes(text));
}

/** set a controlled input's value the way React 18 expects (native setter + input event) */
function setInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(
    globalThis.HTMLInputElement.prototype,
    'value'
  ).set;
  setter.call(input, value);
  input.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
}

/* ------------------------------------------------------------------ */
/* fixtures                                                            */
/* ------------------------------------------------------------------ */

const modelConfigs = [
  {
    id: 'm1',
    provider: 'openai',
    name: 'GPT-4o',
    apiKey: 'sk-test',
    model: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
    enabled: true, // active model
  },
  {
    id: 'm2',
    provider: 'deepseek',
    name: 'DeepSeek V3',
    apiKey: '',
    hasApiKey: false,
    model: '',
    baseUrl: 'https://api.deepseek.com/v1',
    enabled: false, // unconfigured → switch disabled
  },
];

const mcpServers = [
  {
    id: 's1',
    name: 'Filesystem',
    type: 'stdio',
    command: 'npx',
    args: '-y @modelcontextprotocol/server-filesystem /tmp',
    status: 'disconnected',
    tools: [],
    resources: [],
  },
  {
    id: 's2',
    name: 'HTTP Svc',
    type: 'http',
    url: 'http://localhost:8080',
    status: 'connected',
    tools: ['read', 'write'],
    resources: [],
  },
];

/**
 * Stateful wrapper so ModelManagement's add/delete/toggle callbacks actually
 * mutate `modelConfigs` — lets us surface (and assert) the post-add edit form,
 * the flipped switch state, and row removal.
 */
function ModelManagementHarness({ initialModels = [], spies }) {
  const [models, setModels] = useState(initialModels);
  return (
    <ModelManagement
      modelConfigs={models}
      onAddModel={(m) => {
        spies.onAdd(m);
        setModels((prev) => [...prev, m]);
      }}
      onUpdateModel={spies.onUpdate}
      onDeleteModel={(id) => {
        spies.onDelete(id);
        setModels((prev) => prev.filter((c) => c.id !== id));
      }}
      onToggleModel={(id) => {
        spies.onToggle(id);
        setModels((prev) =>
          prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
        );
      }}
    />
  );
}

const modelSpies = () => ({
  onAdd: createSpy('onAdd'),
  onUpdate: createSpy('onUpdate'),
  onDelete: createSpy('onDelete'),
  onToggle: createSpy('onToggle'),
});

const mcpSpies = () => ({
  onAdd: createSpy('onAdd'),
  onDelete: createSpy('onDelete'),
  onToggle: createSpy('onToggle'),
  onConnect: createSpy('onConnect'),
});

/* ------------------------------------------------------------------ */
/* ManagementPage                                                      */
/* ------------------------------------------------------------------ */

describe('ManagementPage', () => {
  const baseProps = () => ({
    agentOptions: { autoSave: true },
    setAgentOptions: createSpy('setAgentOptions'),
    theme: 'dark',
    onToggleTheme: createSpy('onToggleTheme'),
    language: 'zh-CN',
    onChangeLanguage: createSpy('onChangeLanguage'),
    modelConfigs: [],
    onAddModel: createSpy('onAddModel'),
    onUpdateModel: createSpy('onUpdateModel'),
    onDeleteModel: createSpy('onDeleteModel'),
    onToggleModel: createSpy('onToggleModel'),
    onClose: createSpy('onClose'),
  });

  test('inventory: default render shows 3 buttons (2 tabs + close)', () => {
    const { container, unmount } = render(<ManagementPage {...baseProps()} />);
    expect(buttons(container).length).toBe(3);
    const tabs = buttons(container).filter((b) => b.getAttribute('role') === 'tab');
    expect(tabs.length).toBe(2);
    expect(byTitle(container, L.close)).toBeTruthy();
    unmount();
  });

  test('tab buttons switch panels (aria-selected flips + content swaps)', () => {
    const { container, unmount } = render(<ManagementPage {...baseProps()} />);
    const [generalTab, modelsTab] = buttons(container).filter(
      (b) => b.getAttribute('role') === 'tab'
    );
    expect(generalTab.getAttribute('aria-selected')).toBe('true');
    expect(modelsTab.getAttribute('aria-selected')).toBe('false');
    expect(container.querySelector('#management-page-title')).not.toBeNull();

    click(modelsTab); // → ModelManagement panel
    expect(modelsTab.getAttribute('aria-selected')).toBe('true');
    expect(generalTab.getAttribute('aria-selected')).toBe('false');
    expect(container.querySelector('#management-page-title')).toBeNull();
    expect(container.textContent).toContain(L.models);

    click(generalTab); // → back to general settings
    expect(generalTab.getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('#management-page-title')).not.toBeNull();
    unmount();
  });

  test('close button fires onClose', () => {
    const props = baseProps();
    const { container, unmount } = render(<ManagementPage {...props} />);
    click(byTitle(container, L.close));
    expect(props.onClose.callCount).toBe(1);
    expect(props.onClose.calls[0]).toEqual([]);
    unmount();
  });

  test('Escape key fires onClose (keydown listener)', () => {
    const props = baseProps();
    const { container, unmount } = render(<ManagementPage {...props} />);
    dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
    expect(props.onClose.callCount).toBe(1);
    unmount();
  });
});

/* ------------------------------------------------------------------ */
/* ModelManagement                                                     */
/* ------------------------------------------------------------------ */

describe('ModelManagement', () => {
  test('inventory: empty configs render 8 buttons (4 provider headers + 4 add)', () => {
    const { container, unmount } = render(<ModelManagement modelConfigs={[]} />);
    expect(buttons(container).length).toBe(8);
    const headers = buttons(container).filter((b) =>
      (b.textContent || '').includes('▶')
    );
    expect(headers.length).toBe(4);
    const adds = buttons(container).filter((b) =>
      (b.textContent || '').includes(L.addModel)
    );
    expect(adds.length).toBe(4);
    unmount();
  });

  test('inventory: 2 configs render 14 buttons (4 headers + 2 cards × 3 + 4 add)', () => {
    const s = modelSpies();
    const { container, unmount } = render(
      <ModelManagement
        modelConfigs={modelConfigs}
        onToggleModel={s.onToggle}
        onDeleteModel={s.onDelete}
      />
    );
    expect(buttons(container).length).toBe(14);
    expect(buttons(container).filter((b) => b.getAttribute('role') === 'switch').length).toBe(2);
    expect(byTitle(container, L.edit)).toBeTruthy();
    expect(
      buttons(container).filter((b) => b.getAttribute('title') === L.deleteModel).length
    ).toBe(2);
    unmount();
  });

  test('provider header toggle collapses then re-expands its group', () => {
    const s = modelSpies();
    const { container, unmount } = render(
      <ModelManagement
        modelConfigs={modelConfigs}
        onToggleModel={s.onToggle}
        onDeleteModel={s.onDelete}
      />
    );
    const header = byText(container, LLM_PROVIDER_OPTIONS.openai.label);
    expect(header).toBeTruthy();
    expect(buttons(container).length).toBe(14);
    expect(byTitle(container, L.edit)).toBeTruthy(); // m1 card visible

    click(header); // collapse openai group → card + add button disappear
    expect(buttons(container).length).toBe(10);
    expect(byTitle(container, L.edit)).toBeFalsy(); // m1's actions hidden
    expect(container.textContent).toContain('DeepSeek V3'); // other groups intact

    click(header); // re-expand
    expect(buttons(container).length).toBe(14);
    expect(byTitle(container, L.edit)).toBeTruthy();
    unmount();
  });

  test('add-model adds a config and opens its form; cancel closes it', () => {
    const s = modelSpies();
    const { container, unmount } = render(
      <ModelManagementHarness initialModels={modelConfigs} spies={s} />
    );
    click(byText(container, L.addModel)); // first add button = openai group
    expect(s.onAdd.callCount).toBe(1);
    const added = s.onAdd.calls[0][0];
    expect(added.provider).toBe('openai');
    expect(added.id).toMatch(/^model_/);

    // new card renders with its edit form open → save + cancel surfaced
    const saveBtn = byText(container, L.save);
    const cancelBtn = byText(container, L.cancel);
    expect(saveBtn).toBeTruthy();
    expect(cancelBtn).toBeTruthy();

    click(cancelBtn);
    expect(byText(container, L.cancel)).toBeFalsy();
    expect(byText(container, L.save)).toBeFalsy();
    expect(s.onUpdate.callCount).toBe(0);
    unmount();
  });

  test('add-model then save persists the new config via onUpdateModel', () => {
    const s = modelSpies();
    const { container, unmount } = render(
      <ModelManagementHarness initialModels={modelConfigs} spies={s} />
    );
    click(byText(container, L.addModel));
    const added = s.onAdd.calls[0][0];
    expect(s.onUpdate.callCount).toBe(0);

    click(byText(container, L.save));
    expect(s.onUpdate.callCount).toBe(1);
    expect(s.onUpdate.calls[0][0]).toBe(added.id);
    expect(s.onUpdate.calls[0][1].name).toBe('');
    expect(byText(container, L.save)).toBeFalsy(); // form closed after save
    unmount();
  });

  test('edit → save calls onUpdateModel(id, form) and closes the form', () => {
    const s = modelSpies();
    const { container, unmount } = render(
      <ModelManagement modelConfigs={modelConfigs} onUpdateModel={s.onUpdate} />
    );
    click(byTitle(container, L.edit)); // m1 card
    expect(byText(container, L.save)).toBeTruthy();
    // m1's edit is hidden while editing; m2's edit remains
    expect(buttons(container).filter((b) => b.getAttribute('title') === L.edit).length).toBe(1);

    click(byText(container, L.save));
    expect(s.onUpdate.callCount).toBe(1);
    expect(s.onUpdate.calls[0][0]).toBe('m1');
    expect(s.onUpdate.calls[0][1].name).toBe('GPT-4o');
    expect(s.onUpdate.calls[0][1].model).toBe('gpt-4o');
    expect(byText(container, L.save)).toBeFalsy();
    expect(buttons(container).filter((b) => b.getAttribute('title') === L.edit).length).toBe(2); // both back
    unmount();
  });

  test('edit → cancel closes the form without updating', () => {
    const s = modelSpies();
    const { container, unmount } = render(
      <ModelManagement modelConfigs={modelConfigs} onUpdateModel={s.onUpdate} />
    );
    click(byTitle(container, L.edit));
    expect(byText(container, L.cancel)).toBeTruthy();

    click(byText(container, L.cancel));
    expect(s.onUpdate.callCount).toBe(0);
    expect(byText(container, L.cancel)).toBeFalsy();
    expect(byText(container, L.save)).toBeFalsy();
    unmount();
  });

  test('delete removes a non-active config', () => {
    const s = modelSpies();
    const { container, unmount } = render(
      <ModelManagementHarness initialModels={modelConfigs} spies={s} />
    );
    const delBtns = buttons(container).filter(
      (b) => b.getAttribute('title') === L.deleteModel
    );
    expect(delBtns.length).toBe(2);
    // m1 is the active model → its delete is disabled; m2 is deletable
    expect(delBtns.filter((b) => b.disabled).length).toBe(1);
    const deletable = delBtns.find((b) => !b.disabled);

    click(deletable);
    expect(s.onDelete.callCount).toBe(1);
    expect(s.onDelete.calls[0][0]).toBe('m2');
    expect(container.textContent).not.toContain('DeepSeek V3'); // row removed
    unmount();
  });

  test('delete on the active config is disabled — handler NOT fired', () => {
    const s = modelSpies();
    const { container, unmount } = render(
      <ModelManagement modelConfigs={modelConfigs} onDeleteModel={s.onDelete} />
    );
    const activeDelete = buttons(container).find(
      (b) => b.getAttribute('title') === L.deleteModel && b.disabled
    );
    expect(activeDelete).toBeTruthy();
    click(activeDelete);
    expect(s.onDelete.callCount).toBe(0);
    unmount();
  });

  test('switch on a configured model fires onToggleModel and flips aria-checked', () => {
    const s = modelSpies();
    const { container, unmount } = render(
      <ModelManagementHarness initialModels={modelConfigs} spies={s} />
    );
    const sw = buttons(container).find(
      (b) => b.getAttribute('role') === 'switch' && !b.disabled
    );
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(sw.getAttribute('aria-label')).toBe(L.disable);

    click(sw);
    expect(s.onToggle.callCount).toBe(1);
    expect(s.onToggle.calls[0][0]).toBe('m1');
    expect(sw.getAttribute('aria-checked')).toBe('false'); // state flipped
    unmount();
  });

  test('switch on an unconfigured model is disabled — handler NOT fired', () => {
    const s = modelSpies();
    const { container, unmount } = render(
      <ModelManagement modelConfigs={modelConfigs} onToggleModel={s.onToggle} />
    );
    const sw = buttons(container).find(
      (b) => b.getAttribute('role') === 'switch' && b.disabled
    );
    expect(sw).toBeTruthy();
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(sw.getAttribute('aria-label')).toBe(L.enable);
    click(sw);
    expect(s.onToggle.callCount).toBe(0);
    unmount();
  });
});

/* ------------------------------------------------------------------ */
/* McpManagement                                                       */
/* ------------------------------------------------------------------ */

describe('McpManagement', () => {
  test('inventory: empty list renders 2 buttons (empty-state add + footer add)', () => {
    const { container, unmount } = render(<McpManagement mcpServers={[]} />);
    expect(buttons(container).length).toBe(2);
    expect(
      buttons(container).filter((b) => (b.textContent || '').includes(L.addServer)).length
    ).toBe(2);
    unmount();
  });

  test('inventory: 2 servers render 5 buttons (2 × connect/disconnect+delete + footer add)', () => {
    const s = mcpSpies();
    const { container, unmount } = render(
      <McpManagement mcpServers={mcpServers} onConnectServer={s.onConnect} onToggleServer={s.onToggle} onDeleteServer={s.onDelete} />
    );
    expect(buttons(container).length).toBe(5);
    expect(byTitle(container, L.connect)).toBeTruthy();
    expect(byTitle(container, L.disconnect)).toBeTruthy();
    expect(
      buttons(container).filter((b) => b.getAttribute('title') === L.delete).length
    ).toBe(2);
    unmount();
  });

  test('add-server: form opens, save is disabled until a name is typed, then adds', () => {
    const s = mcpSpies();
    const { container, unmount } = render(<McpManagement mcpServers={[]} onAddServer={s.onAdd} />);
    click(buttons(container)[0]); // empty-state add
    let saveBtn = byText(container, L.save);
    const cancelBtn = byText(container, L.cancel);
    expect(saveBtn).toBeTruthy();
    expect(cancelBtn).toBeTruthy();
    expect(saveBtn.disabled).toBe(true);

    click(saveBtn); // disabled → no-op
    expect(s.onAdd.callCount).toBe(0);

    const nameInput = container.querySelector('input[placeholder="e.g. filesystem-server"]');
    expect(nameInput).toBeTruthy();
    setInputValue(nameInput, 'filesystem-server');
    saveBtn = byText(container, L.save);
    expect(saveBtn.disabled).toBe(false);

    click(saveBtn);
    expect(s.onAdd.callCount).toBe(1);
    const added = s.onAdd.calls[0][0];
    expect(added.id).toMatch(/^mcp_/);
    expect(added.name).toBe('filesystem-server');
    expect(added.type).toBe('http');
    expect(added.status).toBe('disconnected');
    expect(byText(container, L.save)).toBeFalsy(); // form closed
    unmount();
  });

  test('add-server form cancel closes the form without adding', () => {
    const s = mcpSpies();
    const { container, unmount } = render(<McpManagement mcpServers={[]} onAddServer={s.onAdd} />);
    click(buttons(container)[0]); // empty-state add
    click(byText(container, L.cancel));
    expect(byText(container, L.save)).toBeFalsy();
    expect(byText(container, L.cancel)).toBeFalsy();
    expect(s.onAdd.callCount).toBe(0);
    unmount();
  });

  test('footer add-server opens the form when servers exist', () => {
    const s = mcpSpies();
    const { container, unmount } = render(
      <McpManagement mcpServers={mcpServers} onAddServer={s.onAdd} />
    );
    const footerAdd = buttons(container)
      .filter((b) => (b.textContent || '').includes(L.addServer))
      .at(-1);
    click(footerAdd);
    expect(byText(container, L.cancel)).toBeTruthy();
    expect(byText(container, L.save)).toBeTruthy();
    unmount();
  });

  test('connect on a disconnected server fires onConnectServer', () => {
    const s = mcpSpies();
    const { container, unmount } = render(
      <McpManagement mcpServers={mcpServers} onConnectServer={s.onConnect} />
    );
    const connectBtn = byTitle(container, L.connect);
    expect(connectBtn).toBeTruthy();
    // exactly one connect (s1) and one disconnect (s2) — status-conditional
    expect(buttons(container).filter((b) => b.getAttribute('title') === L.connect).length).toBe(1);
    expect(buttons(container).filter((b) => b.getAttribute('title') === L.disconnect).length).toBe(1);
    click(connectBtn);
    expect(s.onConnect.callCount).toBe(1);
    expect(s.onConnect.calls[0][0]).toBe('s1');
    unmount();
  });

  test('disconnect on a connected server fires onToggleServer', () => {
    const s = mcpSpies();
    const { container, unmount } = render(
      <McpManagement mcpServers={mcpServers} onToggleServer={s.onToggle} />
    );
    const discBtn = byTitle(container, L.disconnect);
    expect(discBtn).toBeTruthy();
    // exactly one disconnect (s2) and one connect (s1) — status-conditional
    expect(buttons(container).filter((b) => b.getAttribute('title') === L.disconnect).length).toBe(1);
    expect(buttons(container).filter((b) => b.getAttribute('title') === L.connect).length).toBe(1);
    click(discBtn);
    expect(s.onToggle.callCount).toBe(1);
    expect(s.onToggle.calls[0][0]).toBe('s2');
    unmount();
  });

  test('delete fires onDeleteServer for each server', () => {
    const s = mcpSpies();
    const { container, unmount } = render(
      <McpManagement mcpServers={mcpServers} onDeleteServer={s.onDelete} />
    );
    const delBtns = buttons(container).filter((b) => b.getAttribute('title') === L.delete);
    expect(delBtns.length).toBe(2);
    click(delBtns[0]);
    click(delBtns[1]);
    expect(s.onDelete.callCount).toBe(2);
    expect(s.onDelete.calls[0][0]).toBe('s1');
    expect(s.onDelete.calls[1][0]).toBe('s2');
    unmount();
  });
});
