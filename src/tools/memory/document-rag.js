/**
 * Document RAG tools for user-provided files, URLs, and raw text.
 */

import { readFile, stat } from 'fs/promises';
import { basename, extname, isAbsolute, resolve } from 'path';
import { Buffer } from 'buffer';
import { URL } from 'url';
import { Embedder } from '../../core/embedder.js';
import { ToolCategory } from '../../core/types.js';

const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
const CHUNK_CHARS = 2400;
const OVERLAP_CHARS = 300;
const USER_AGENT = 'AI-Engineering-Agent/1.0 (+document-rag)';

const documents = new Map();
const chunks = [];
let embedderPromise = null;

async function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      const embedder = new Embedder();
      await embedder.initialize();
      return embedder;
    })();
  }
  return embedderPromise;
}

export function createDocumentRagTools() {
  return [
    createDocumentAddTool(),
    createDocumentSearchTool(),
    createDocumentListTool(),
    createDocumentClearTool(),
  ];
}

function createDocumentAddTool() {
  return {
    name: 'document_add',
    description: 'Add a user document to the document RAG index. Supports local .txt/.md/.json/.html/.pdf/.docx files, http(s) URLs, or raw text content. Use before document_search when the user asks questions about uploaded/provided documents or links.',
    category: ToolCategory.FILESYSTEM,
    params: {
      source: { type: 'string', description: 'Local path or http(s) URL. Optional if content is provided.' },
      content: { type: 'string', description: 'Raw document text to index directly.' },
      title: { type: 'string', description: 'Optional human-readable document title.' },
      id: { type: 'string', description: 'Optional stable document id. Defaults to a generated id.' },
    },
    handler: async ({ source, content, title, id }, ctx) => {
      const startedAt = Date.now();
      const parsed = await loadDocument({ source, content, title }, ctx);
      const documentId = sanitizeId(id) || createDocumentId(parsed.title, parsed.source);
      const documentChunks = chunkText(parsed.text).map((text, index) => ({
        text,
        metadata: {
          documentId,
          title: parsed.title,
          source: parsed.source,
          kind: parsed.kind,
          chunkIndex: index + 1,
        },
      }));

      if (documentChunks.length === 0) {
        return { success: false, error: 'Document contained no indexable text.' };
      }

      removeDocument(documentId);
      documents.set(documentId, {
        id: documentId,
        title: parsed.title,
        source: parsed.source,
        kind: parsed.kind,
        chars: parsed.text.length,
        chunks: documentChunks.length,
        addedAt: new Date().toISOString(),
      });
      chunks.push(...documentChunks);

      ctx?.ui?.debugEvent?.('Document added to RAG index', {
        id: documentId,
        title: parsed.title,
        source: parsed.source,
        kind: parsed.kind,
        chunks: documentChunks.length,
        durationMs: Date.now() - startedAt,
      });

      return {
        success: true,
        id: documentId,
        title: parsed.title,
        source: parsed.source,
        kind: parsed.kind,
        chunks: documentChunks.length,
        chars: parsed.text.length,
      };
    },
  };
}

function createDocumentSearchTool() {
  return {
    name: 'document_search',
    description: 'Search previously added user documents by meaning using embeddings. Use this to answer questions grounded in uploaded documents, PDFs, DOCX files, or web document links.',
    category: ToolCategory.FILESYSTEM,
    params: {
      query: { type: 'string', description: 'Natural-language question or concept to search for.' },
      limit: { type: 'number', description: 'Maximum matching chunks to return (default 5, max 20).' },
      document_id: { type: 'string', description: 'Optional document id to restrict search.' },
    },
    required: ['query'],
    handler: async ({ query, limit, document_id }, ctx) => {
      const scopedChunks = document_id
        ? chunks.filter(chunk => chunk.metadata.documentId === document_id)
        : chunks;

      if (scopedChunks.length === 0) {
        return 'No documents are indexed yet. Use document_add with a local path, URL, or content first.';
      }

      const embedder = await getEmbedder();
      const results = await embedder.batchFindSimilar(query, scopedChunks, {
        limit: normalizeLimit(limit),
        threshold: 0,
      });

      ctx?.ui?.debugEvent?.('Document search completed', {
        query,
        chunks: scopedChunks.length,
        resultCount: results.length,
      });

      return formatSearchResults(results);
    },
  };
}

function createDocumentListTool() {
  return {
    name: 'document_list',
    description: 'List user documents currently loaded into the document RAG index.',
    category: ToolCategory.FILESYSTEM,
    params: {},
    handler: async () => ({
      success: true,
      count: documents.size,
      documents: Array.from(documents.values()),
    }),
  };
}

function createDocumentClearTool() {
  return {
    name: 'document_clear',
    description: 'Clear one document or the entire document RAG index.',
    category: ToolCategory.FILESYSTEM,
    params: {
      document_id: { type: 'string', description: 'Optional document id to remove. If omitted, clears all documents.' },
    },
    handler: async ({ document_id }) => {
      if (document_id) {
        const removed = removeDocument(document_id);
        return { success: removed, removed: removed ? 1 : 0 };
      }
      const count = documents.size;
      documents.clear();
      chunks.length = 0;
      return { success: true, removed: count };
    },
  };
}

async function loadDocument({ source, content, title }, ctx) {
  if (typeof content === 'string' && content.trim()) {
    return {
      title: title || 'Inline document',
      source: 'inline',
      kind: 'text',
      text: content,
    };
  }

  if (!source) {
    throw new Error('document_add requires either source or content.');
  }

  const sourceValue = String(source).trim();
  if (/^https?:\/\//i.test(sourceValue)) {
    return await loadURL(sourceValue, title);
  }

  return await loadLocalFile(sourceValue, title, ctx?.workingDirectory || process.cwd());
}

async function loadLocalFile(path, title, workingDirectory) {
  const absolutePath = isAbsolute(path) ? path : resolve(workingDirectory, path);
  const fileStat = await stat(absolutePath);
  if (fileStat.size > MAX_DOCUMENT_BYTES) {
    throw new Error(`Document is too large (${fileStat.size} bytes). Limit is ${MAX_DOCUMENT_BYTES} bytes.`);
  }

  const buffer = await readFile(absolutePath);
  const kind = inferKind(absolutePath, '');
  const text = await parseBuffer(buffer, kind);
  return {
    title: title || basename(absolutePath),
    source: absolutePath,
    kind,
    text,
  };
}

async function loadURL(url, title) {
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch document URL: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length > MAX_DOCUMENT_BYTES) {
    throw new Error(`Document is too large (${buffer.length} bytes). Limit is ${MAX_DOCUMENT_BYTES} bytes.`);
  }

  const kind = inferKind(url, contentType);
  const text = await parseBuffer(buffer, kind);
  return {
    title: title || inferTitleFromURL(url),
    source: url,
    kind,
    text,
  };
}

async function parseBuffer(buffer, kind) {
  if (kind === 'pdf') {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return normalizeText(result.text || '');
    } finally {
      await parser.destroy();
    }
  }

  if (kind === 'docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return normalizeText(result.value || '');
  }

  const text = buffer.toString('utf-8');
  if (kind === 'html') {
    return cleanHTML(text);
  }
  return normalizeText(text);
}

function chunkText(text) {
  const normalized = normalizeText(text);
  const result = [];

  for (let start = 0; start < normalized.length; start += CHUNK_CHARS - OVERLAP_CHARS) {
    const end = Math.min(normalized.length, start + CHUNK_CHARS);
    const chunk = normalized.slice(start, end).trim();
    if (chunk) {
      result.push(chunk);
    }
    if (end === normalized.length) {
      break;
    }
  }

  return result;
}

function inferKind(source, contentType = '') {
  const ext = extname(getURLSafePath(source)).toLowerCase();
  const type = contentType.toLowerCase();
  if (ext === '.pdf' || type.includes('application/pdf')) return 'pdf';
  if (ext === '.docx' || type.includes('wordprocessingml.document')) return 'docx';
  if (ext === '.html' || ext === '.htm' || type.includes('text/html')) return 'html';
  if (ext === '.json' || type.includes('application/json')) return 'json';
  if (ext === '.md' || ext === '.markdown') return 'markdown';
  return 'text';
}

function getURLSafePath(source) {
  try {
    return new URL(source).pathname;
  } catch {
    return source;
  }
}

function cleanHTML(html) {
  return normalizeText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
  );
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,*/*;q=0.8',
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function formatSearchResults(results) {
  if (results.length === 0) {
    return 'No document matches found.';
  }

  return results.map((result, index) => {
    const metadata = result.metadata || {};
    const preview = result.text.slice(0, 1200);
    return [
      `${index + 1}. ${metadata.title} (${metadata.documentId}#${metadata.chunkIndex}) score=${result.score.toFixed(3)}`,
      `Source: ${metadata.source}`,
      preview,
    ].join('\n');
  }).join('\n\n');
}

function normalizeLimit(limit) {
  return Math.max(1, Math.min(Number(limit) || 5, 20));
}

function removeDocument(documentId) {
  const existed = documents.delete(documentId);
  for (let i = chunks.length - 1; i >= 0; i--) {
    if (chunks[i].metadata.documentId === documentId) {
      chunks.splice(i, 1);
    }
  }
  return existed;
}

function createDocumentId(title, source) {
  const base = sanitizeId(title || source || 'document') || 'document';
  let candidate = base;
  let suffix = 2;
  while (documents.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix++;
  }
  return candidate;
}

function sanitizeId(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function inferTitleFromURL(url) {
  try {
    const parsed = new URL(url);
    return basename(parsed.pathname) || parsed.hostname;
  } catch {
    return url;
  }
}

export default createDocumentRagTools;
