import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { styles } from './MessageLog.styles.js';

const AUTO_LINK_RE = /(?<!<)(?<!\]\()(?<!\[)(\b(?:https?:\/\/|www\.)[^\s<>\]\[()"']+[^\s<>\]\[()"'\.,;!?\n])/gi;
const MARKDOWN_STYLE = {
  maxHeight: 'none',
  overflowY: 'visible',
};
const REMARK_PLUGINS = [remarkGfm];

function toUrl(src, workingDirectory, fileServerUrl) {
  if (!src) return src;
  if (/^(https?:)?\/\//i.test(src)) return src;
  if (/^data:/i.test(src)) return src;

  let relative;
  if (/^[a-zA-Z]:[\\\/]/.test(src) || src.startsWith('/')) {
    const cleanAbs = src.replace(/\\/g, '/');
    const cleanWd = (workingDirectory || '').replace(/\\/g, '/').replace(/\/$/, '');
    if (cleanWd && cleanAbs.startsWith(cleanWd + '/')) {
      relative = cleanAbs.slice(cleanWd.length + 1);
    } else {
      relative = cleanAbs.replace(/^\/+/, '');
    }
  } else {
    relative = src.replace(/^\.?\//, '').replace(/\\/g, '/');
  }

  if (fileServerUrl) {
    const base = fileServerUrl.replace(/\/$/, '');
    return `${base}/${relative.split('/').map(encodeURIComponent).join('/')}`;
  }

  let absPath;
  if (/^[a-zA-Z]:/.test(src) || src.startsWith('/')) {
    absPath = src.replace(/\\/g, '/');
  } else {
    absPath = workingDirectory
      ? `${workingDirectory.replace(/[\\\/]+$/, '').replace(/\\/g, '/')}/${relative}`
      : relative;
  }
  return `file://${absPath.startsWith('/') ? '' : '/'}${absPath}`;
}

function preprocessTextForLinks(text) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(AUTO_LINK_RE, (match) => `[${match}](${match})`);
}

function preprocessImagePaths(text, workingDirectory, fileServerUrl) {
  if (!text || typeof text !== 'string') return text;
  let next = text;
  next = next.replace(
    /(!\[[^\]]*\]\()(\s*)([^)\s]+)(\s*([^)]*)\))/g,
    (match, prefix, sp1, src, sp2, rest) => {
      const resolved = toUrl(src, workingDirectory, fileServerUrl);
      return `${prefix}${sp1}${resolved}${sp2}${rest}`;
    }
  );
  next = next.replace(
    /(<img\b[^>]*\bsrc=")([^"]+)("[^>]*>)/gi,
    (match, prefix, src, suffix) => {
      const resolved = toUrl(src, workingDirectory, fileServerUrl);
      return `${prefix}${resolved}${suffix}`;
    }
  );
  next = next.replace(
    /(<img\b[^>]*\bsrc=')([^']+)('[^>]*>)/gi,
    (match, prefix, src, suffix) => {
      const resolved = toUrl(src, workingDirectory, fileServerUrl);
      return `${prefix}${resolved}${suffix}`;
    }
  );
  return next;
}

export const MarkdownMessageContent = React.memo(function MarkdownMessageContent({
  text,
  isCollapsed,
  isUser,
  workingDirectory,
  fileServerUrl,
  markdownComponents,
  onLinkClick,
}) {
  const markdownText = useMemo(() => {
    const linked = preprocessTextForLinks(text || '');
    return preprocessImagePaths(linked, workingDirectory, fileServerUrl);
  }, [text, workingDirectory, fileServerUrl]);

  if (!text) {
    return null;
  }

  return (
    <div style={{
      ...styles.messageContent,
      ...(isCollapsed ? styles.messageContentCollapsed : {}),
      ...(isUser ? { textAlign: 'right' } : {})
    }}>
      <div
        className="markdown"
        style={MARKDOWN_STYLE}
        onClick={onLinkClick}
      >
        <ReactMarkdown
          remarkPlugins={REMARK_PLUGINS}
          components={markdownComponents}
          remarkPluginSettings={{ gfm: true }}
        >
          {markdownText}
        </ReactMarkdown>
      </div>
    </div>
  );
});


