import { describe, test, expect } from 'bun:test';
import React from 'react';
import { installDomGlobals, render, click, buttons, btnLabel, createSpy } from './helpers/render-harness.js';
import { t } from '../renderer/i18n.js';
import { ChromeCapsules } from '../renderer/components/chrome/ChromeCapsules.jsx';
import { ActionFeedback } from '../renderer/components/chrome/ActionFeedback.jsx';
import { IpcDiagnosticBanner } from '../renderer/components/chrome/IpcDiagnosticBanner.jsx';
import { UIErrorBoundary } from '../renderer/components/chrome/UIErrorBoundary.jsx';
import { SettingsMenu } from '../renderer/components/SettingsMenu.jsx';
import { LLMSetupModal } from '../renderer/components/LLMSetupModal.jsx';
import { CapabilityStatusBar } from '../renderer/components/chrome/CapabilityStatusBar.jsx';

installDomGlobals();

/** Find a button by its stable harness label; fails with a useful message listing what rendered. */
function buttonByLabel(container, label) {
  const list = buttons(container);
  const btn = list.find((b) => btnLabel(b) === label);
  expect(btn, `expected a button labeled ${label}; got: ${list.map(btnLabel).join(' | ') || '(none)'}`).toBeTruthy();
  return btn;
}

describe('ChromeCapsules', () => {
  test('inventory: renders 3 window-control buttons (non-Mac, platform known)', () => {
    const { container, unmount } = render(
      <ChromeCapsules
        platformInfo={{ isMac: false }}
        windowState={{ isMaximized: false }}
        onMinimize={createSpy('onMinimize')}
        onMaximize={createSpy('onMaximize')}
        onClose={createSpy('onClose')}
      />,
    );
    expect(buttons(container).length).toBe(3);
    unmount();
  });

  test('minimize button calls onMinimize', () => {
    const onMinimize = createSpy('onMinimize');
    const onMaximize = createSpy('onMaximize');
    const onClose = createSpy('onClose');
    const { container, unmount } = render(
      <ChromeCapsules
        platformInfo={{ isMac: false }}
        windowState={{ isMaximized: false }}
        onMinimize={onMinimize}
        onMaximize={onMaximize}
        onClose={onClose}
      />,
    );
    click(buttonByLabel(container, `title="${t('window.minimize')}"`));
    expect(onMinimize.callCount).toBe(1);
    expect(onMaximize.callCount).toBe(0);
    expect(onClose.callCount).toBe(0);
    unmount();
  });

  test('maximize button calls onMaximize', () => {
    const onMinimize = createSpy('onMinimize');
    const onMaximize = createSpy('onMaximize');
    const onClose = createSpy('onClose');
    const { container, unmount } = render(
      <ChromeCapsules
        platformInfo={{ isMac: false }}
        windowState={{ isMaximized: false }}
        onMinimize={onMinimize}
        onMaximize={onMaximize}
        onClose={onClose}
      />,
    );
    click(buttonByLabel(container, `title="${t('window.maximize')}"`));
    expect(onMaximize.callCount).toBe(1);
    expect(onMinimize.callCount).toBe(0);
    expect(onClose.callCount).toBe(0);
    unmount();
  });

  test('maximize button relabels to restore when windowState.isMaximized, still calls onMaximize', () => {
    const onMaximize = createSpy('onMaximize');
    const { container, unmount } = render(
      <ChromeCapsules
        platformInfo={{ isMac: false }}
        windowState={{ isMaximized: true }}
        onMinimize={createSpy('onMinimize')}
        onMaximize={onMaximize}
        onClose={createSpy('onClose')}
      />,
    );
    click(buttonByLabel(container, `title="${t('window.restore')}"`));
    expect(onMaximize.callCount).toBe(1);
    unmount();
  });

  test('close button calls onClose', () => {
    const onMinimize = createSpy('onMinimize');
    const onMaximize = createSpy('onMaximize');
    const onClose = createSpy('onClose');
    const { container, unmount } = render(
      <ChromeCapsules
        platformInfo={{ isMac: false }}
        windowState={{ isMaximized: false }}
        onMinimize={onMinimize}
        onMaximize={onMaximize}
        onClose={onClose}
      />,
    );
    click(buttonByLabel(container, `title="${t('window.close')}"`));
    expect(onClose.callCount).toBe(1);
    expect(onMinimize.callCount).toBe(0);
    expect(onMaximize.callCount).toBe(0);
    unmount();
  });

  test('renders no window-control buttons on Mac', () => {
    const { container, unmount } = render(
      <ChromeCapsules
        platformInfo={{ isMac: true }}
        windowState={{ isMaximized: false }}
        onMinimize={createSpy('onMinimize')}
        onMaximize={createSpy('onMaximize')}
        onClose={createSpy('onClose')}
      />,
    );
    expect(buttons(container).length).toBe(0);
    unmount();
  });

  test('renders no window-control buttons when platform is unknown', () => {
    const { container, unmount } = render(
      <ChromeCapsules
        windowState={{ isMaximized: false }}
        onMinimize={createSpy('onMinimize')}
        onMaximize={createSpy('onMaximize')}
        onClose={createSpy('onClose')}
      />,
    );
    expect(buttons(container).length).toBe(0);
    unmount();
  });
});

describe('ActionFeedback', () => {
  test('inventory: renders 1 dismiss button when feedback is present', () => {
    const { container, unmount } = render(
      <ActionFeedback feedback={{ message: 'Saved', tone: 'success' }} onDismiss={createSpy('onDismiss')} />,
    );
    expect(buttons(container).length).toBe(1);
    unmount();
  });

  test('close button calls onDismiss', () => {
    const onDismiss = createSpy('onDismiss');
    const { container, unmount } = render(
      <ActionFeedback feedback={{ message: 'Saved', tone: 'success' }} onDismiss={onDismiss} />,
    );
    click(buttonByLabel(container, 'aria-label="关闭提示"'));
    expect(onDismiss.callCount).toBe(1);
    unmount();
  });

  test('renders no buttons without feedback', () => {
    const { container, unmount } = render(<ActionFeedback feedback={null} onDismiss={createSpy('onDismiss')} />);
    expect(buttons(container).length).toBe(0);
    unmount();
  });
});

describe('IpcDiagnosticBanner', () => {
  test('inventory: renders 1 dismiss button when electron API is unavailable', () => {
    const { container, unmount } = render(
      <IpcDiagnosticBanner diagnostic={{ hasElectronAPI: false }} onDismiss={createSpy('onDismiss')} />,
    );
    expect(buttons(container).length).toBe(1);
    unmount();
  });

  test('dismiss button calls onDismiss', () => {
    const onDismiss = createSpy('onDismiss');
    const { container, unmount } = render(
      <IpcDiagnosticBanner diagnostic={{ hasElectronAPI: false }} onDismiss={onDismiss} />,
    );
    click(buttonByLabel(container, `text="${t('common.close')}"`));
    expect(onDismiss.callCount).toBe(1);
    unmount();
  });

  test('renders nothing when electron API is available', () => {
    const { container, unmount } = render(
      <IpcDiagnosticBanner diagnostic={{ hasElectronAPI: true }} onDismiss={createSpy('onDismiss')} />,
    );
    expect(buttons(container).length).toBe(0);
    unmount();
  });
});

describe('UIErrorBoundary', () => {
  test('inventory: no buttons while children render normally', () => {
    const { container, unmount } = render(
      <UIErrorBoundary><div>healthy</div></UIErrorBoundary>,
    );
    expect(buttons(container).length).toBe(0);
    expect(container.textContent).toContain('healthy');
    unmount();
  });

  test('inventory: error state renders Retry and Reload buttons', () => {
    function Boom() {
      throw new Error('boom');
    }
    const { container, unmount } = render(
      <UIErrorBoundary onRetry={createSpy('onRetry')} onReload={createSpy('onReload')}><Boom /></UIErrorBoundary>,
    );
    const list = buttons(container);
    expect(list.length).toBe(2);
    expect(list.some((b) => b.textContent.includes('重试界面'))).toBe(true);
    expect(list.some((b) => b.textContent.includes('重新加载应用'))).toBe(true);
    unmount();
  });

  test('Retry clears the error UI, restores children, and calls onRetry', () => {
    // The child throws on every render attempt while `recover` is false, so the
    // boundary fallback (Retry/Reload buttons) stays surfaced even through
    // React's error-recovery re-render. Flipping `recover` simulates the error
    // being fixed; pressing Retry then re-renders the children successfully.
    let recover = false;
    function Boom() {
      if (!recover) throw new Error('boom');
      return <div data-testid="recovered">recovered content</div>;
    }
    const onRetry = createSpy('onRetry');
    const onReload = createSpy('onReload');
    const { container, unmount } = render(
      <UIErrorBoundary onRetry={onRetry} onReload={onReload}><Boom /></UIErrorBoundary>,
    );
    expect(container.querySelector('.mastery-ui-failure')).toBeTruthy();
    recover = true;
    click(buttonByLabel(container, 'text="重试界面"'));
    expect(onRetry.callCount).toBe(1);
    expect(onReload.callCount).toBe(0);
    expect(container.querySelector('.mastery-ui-failure')).toBeNull();
    expect(container.querySelector('[data-testid="recovered"]')).toBeTruthy();
    expect(container.textContent).toContain('recovered content');
    unmount();
  });

  test('Reload button calls onReload', () => {
    function Boom() {
      throw new Error('boom');
    }
    const onRetry = createSpy('onRetry');
    const onReload = createSpy('onReload');
    const { container, unmount } = render(
      <UIErrorBoundary onRetry={onRetry} onReload={onReload}><Boom /></UIErrorBoundary>,
    );
    click(buttonByLabel(container, 'text="重新加载应用"'));
    expect(onReload.callCount).toBe(1);
    expect(onRetry.callCount).toBe(0);
    expect(container.querySelector('.mastery-ui-failure')).toBeTruthy();
    unmount();
  });
});

describe('SettingsMenu', () => {
  const defaultProps = {
    agentOptions: { autoSave: true, autoScroll: true, debug: false, verbose: false, maxIterations: 60 },
    setAgentOptions: createSpy('setAgentOptions'),
    theme: 'dark',
    onToggleTheme: createSpy('onToggleTheme'),
    language: 'zh-CN',
    onChangeLanguage: createSpy('onChangeLanguage'),
  };

  test('inventory: renders exactly 1 button (language/theme switches are radios, not buttons)', () => {
    const { container, unmount } = render(
      <SettingsMenu {...defaultProps} onClose={createSpy('onClose')} onOpenLLMSetup={createSpy('onOpenLLMSetup')} />,
    );
    expect(buttons(container).length).toBe(1);
    unmount();
  });

  test('setup button closes the menu and opens LLM setup, in that order', () => {
    const order = [];
    const onClose = (...args) => { order.push('close'); onCloseSpy(...args); };
    const onOpenLLMSetup = (...args) => { order.push('open'); onOpenLLMSetupSpy(...args); };
    const onCloseSpy = createSpy('onClose');
    const onOpenLLMSetupSpy = createSpy('onOpenLLMSetup');
    const { container, unmount } = render(
      <SettingsMenu {...defaultProps} onClose={onClose} onOpenLLMSetup={onOpenLLMSetup} />,
    );
    click(buttonByLabel(container, `text="${t('ui.setup')}"`));
    expect(onCloseSpy.callCount).toBe(1);
    expect(onOpenLLMSetupSpy.callCount).toBe(1);
    expect(order).toEqual(['close', 'open']);
    unmount();
  });
});

describe('LLMSetupModal', () => {
  const baseProps = {
    llmConfigStatus: null,
    llmForm: { provider: 'openai', model: '', apiKey: '', baseUrl: '' },
    llmSetupError: null,
    llmSetupSaving: false,
    modelConfigs: [],
    onFormChange: createSpy('onFormChange'),
    onProviderChange: createSpy('onProviderChange'),
  };

  test('inventory: renders cancel and save buttons', () => {
    const { container, unmount } = render(
      <LLMSetupModal {...baseProps} onClose={createSpy('onClose')} onSave={createSpy('onSave')} />,
    );
    expect(buttons(container).length).toBe(2);
    unmount();
  });

  test('cancel button calls onClose', () => {
    const onClose = createSpy('onClose');
    const onSave = createSpy('onSave');
    const { container, unmount } = render(<LLMSetupModal {...baseProps} onClose={onClose} onSave={onSave} />);
    click(buttonByLabel(container, 'text="稍后配置"'));
    expect(onClose.callCount).toBe(1);
    expect(onSave.callCount).toBe(0);
    unmount();
  });

  test('save button calls onSave', () => {
    const onClose = createSpy('onClose');
    const onSave = createSpy('onSave');
    const { container, unmount } = render(<LLMSetupModal {...baseProps} onClose={onClose} onSave={onSave} />);
    click(buttonByLabel(container, 'text="保存并启用"'));
    expect(onSave.callCount).toBe(1);
    expect(onClose.callCount).toBe(0);
    unmount();
  });

  test('while llmSetupSaving, both cancel and save are disabled and handlers do not fire', () => {
    const onClose = createSpy('onClose');
    const onSave = createSpy('onSave');
    const { container, unmount } = render(
      <LLMSetupModal {...baseProps} llmSetupSaving onClose={onClose} onSave={onSave} />,
    );
    const list = buttons(container);
    expect(list.length).toBe(2);
    for (const btn of list) {
      expect(btn.disabled).toBe(true);
      click(btn);
    }
    expect(onClose.callCount).toBe(0);
    expect(onSave.callCount).toBe(0);
    unmount();
  });
});

describe('CapabilityStatusBar', () => {
  const degradedState = {
    status: 'degraded',
    error: null,
    graph: {
      ui: { agent: { status: 'degraded' } },
      manifest: [{ id: 'terminal.execute', status: 'degraded' }],
    },
  };

  test('inventory: degraded bar renders with 0 buttons', () => {
    const { container, unmount } = render(<CapabilityStatusBar capabilityState={degradedState} />);
    expect(container.querySelector('.capability-status-bar')).toBeTruthy();
    expect(buttons(container).length).toBe(0);
    unmount();
  });

  test('idle state renders nothing (0 buttons)', () => {
    const { container, unmount } = render(
      <CapabilityStatusBar
        capabilityState={{
          status: 'idle',
          error: null,
          graph: { ui: { agent: { status: 'available' } }, manifest: [] },
        }}
      />,
    );
    expect(buttons(container).length).toBe(0);
    expect(container.querySelector('.capability-status-bar')).toBeNull();
    unmount();
  });
});
