const LOCAL_PREVIEW_HOSTS = new Set(['localhost', '127.0.0.1']);

export function normalizePreviewUrlInput(value) {
  const input = String(value || '').trim();
  if (!input) return null;

  const candidate = /^https?:\/\//i.test(input) ? input : `http://${input}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (!LOCAL_PREVIEW_HOSTS.has(parsed.hostname)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function formatPreviewUrlInput(value) {
  const normalized = normalizePreviewUrlInput(value);
  if (!normalized) return String(value || '');

  const parsed = new URL(normalized);
  const path = parsed.pathname === '/' ? '' : parsed.pathname;
  return `${parsed.host}${path}${parsed.search}${parsed.hash}`;
}
