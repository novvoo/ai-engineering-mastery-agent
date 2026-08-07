/**
 * Renderer button-interaction test harness.
 *
 * Provides a jsdom-backed React 18 mounting surface for `bun test` so we can
 * render the renderer's components, enumerate every <button>, click it, and
 * assert the component responds (handler fired / state flipped / no crash).
 *
 * Usage:
 *   import { installDomGlobals, render, click, buttons, createSpy } from './helpers/render-harness.js';
 *
 *   installDomGlobals(); // once per test file, before rendering
 *   const { container, unmount } = render(<MyComponent {...props} />);
 *   for (const btn of buttons(container)) { click(btn); }
 */

import { JSDOM } from 'jsdom';

let installed = false;

/**
 * Install jsdom's window/document/constructors as globalThis globals.
 * Idempotent — safe to call from every test file. Bun's own web globals
 * (fetch, Request, Blob, …) are kept so nothing else in the process breaks.
 */
export function installDomGlobals() {
  if (installed) return;
  installed = true;

  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost:3000/',
    pretendToBeVisual: true, // gives requestAnimationFrame
  });
  const { window } = dom;

  // Copy every own property of the jsdom window onto globalThis, except a
  // denylist of Bun/Node runtime essentials that must keep their native impls.
  const keep = new Set([
    'fetch', 'Request', 'Response', 'Headers', 'FormData', 'File', 'Blob',
    'WebSocket', 'EventSource', 'ReadableStream', 'WritableStream',
    'TransformStream', 'TextEncoder', 'TextDecoder', 'URL', 'URLSearchParams',
    'AbortController', 'AbortSignal', 'structuredClone', 'queueMicrotask',
    'atob', 'btoa', 'performance', 'crypto', 'MessageChannel', 'MessagePort',
    'BroadcastChannel', 'CompressionStream', 'DecompressionStream',
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  ]);
  for (const key of Object.getOwnPropertyNames(window)) {
    if (keep.has(key)) continue;
    try {
      Object.defineProperty(globalThis, key, {
        value: window[key],
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch {
      // non-configurable or read-only host globals — leave as-is
    }
  }

  // jsdom intentionally omits these; components touch them.
  if (!globalThis.matchMedia) {
    globalThis.matchMedia = () => ({
      matches: false,
      media: '',
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      onchange: null,
      dispatchEvent() { return false; },
    });
  }
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!globalThis.IntersectionObserver) {
    globalThis.IntersectionObserver = class IntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    };
  }
  if (typeof globalThis.document?.createElement === 'function') {
    const proto = globalThis.HTMLElement?.prototype;
    if (proto && !proto.scrollIntoView) proto.scrollIntoView = () => {};
    if (proto && !proto.scrollTo) proto.scrollTo = () => {};
  }
  if (!globalThis.navigator?.clipboard) {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: {
        writeText: async () => {},
        readText: async () => '',
        write: async () => {},
      },
      configurable: true,
    });
  }

  // React 18 act() contract
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  return dom;
}

/** Function spy: records every invocation's args. `createSpy('x').calls` → [[args…], …] */
export function createSpy(name = 'spy') {
  const fn = function (...args) {
    fn.calls.push(args);
    fn.callCount += 1;
  };
  fn.calls = [];
  fn.callCount = 0;
  return fn;
}

/** Mount `element` into a fresh container and flush effects. Returns { container, root, unmount }. */
export function render(element, { container } = {}) {
  const { act } = require('react');
  const { createRoot } = require('react-dom/client');
  const host = container ?? globalThis.document.createElement('div');
  if (host.parentNode === null) {
    (globalThis.document.body || globalThis.document.documentElement).appendChild(host);
  }
  let root;
  act(() => {
    root = createRoot(host);
    root.render(element);
  });
  return {
    container: host,
    root,
    unmount: () => act(() => root.unmount()),
  };
}

/** All <button> elements inside `container` (deep). */
export function buttons(container) {
  return Array.from(container.querySelectorAll('button'));
}

/** Stable short label for a button-like node (title → aria-label → text → class). */
export function btnLabel(btn) {
  if (!btn || typeof btn.getAttribute !== 'function') {
    const text = (btn && typeof btn.textContent === 'string' ? btn.textContent : '')
      .trim().replace(/\s+/g, ' ').slice(0, 40);
    return text ? `text="${text}"` : '<non-element>';
  }
  const t = btn.getAttribute('title');
  if (t) return `title="${t}"`;
  const a = btn.getAttribute('aria-label');
  if (a) return `aria-label="${a}"`;
  const text = (btn.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  if (text) return `text="${text}"`;
  return `class="${btn.className}"`;
}

/** Dispatch a bubbling click on `el` inside React's act(). */
export function click(el) {
  const { act } = require('react');
  act(() => {
    el.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  return el;
}

/**
 * Type `value` into a controlled <input>/<textarea> the way React 18 tracks it:
 * native value setter on the prototype + a bubbling input event, inside act().
 * Returns the input element.
 */
export function type(input, value) {
  const { act } = require('react');
  act(() => {
    const proto = input instanceof globalThis.HTMLTextAreaElement
      ? globalThis.HTMLTextAreaElement.prototype
      : globalThis.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value);
    input.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
  });
  return input;
}

/** Convenience: click every button in `container`; returns the buttons clicked. */
export function clickAll(container) {
  const list = buttons(container);
  for (const btn of list) click(btn);
  return list;
}
