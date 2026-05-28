/**
 * TokenJuice - 智能上下文压缩引擎
 * 灵感来自 OpenHuman 的 TokenJuice 和 vincentkoc/tokenjuice
 *
 * 核心功能：
 * - HTML → Markdown 转换
 * - 冗余内容去重
 * - 长输出智能截断
 * - Token 估算
 */

const DEFAULT_MAX_CHARS = 8000;
const CJK_CHAR_REGEX = /[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/g;

export class TokenJuice {
  #rules;
  #maxChars;

  constructor(options = {}) {
    this.#maxChars = options.maxChars || DEFAULT_MAX_CHARS;
    this.#rules = [];

    // 内置压缩规则
    this.#addBuiltinRules();
  }

  /**
   * 添加内置压缩规则
   */
  #addBuiltinRules() {
    // HTML → Markdown
    this.addRule({
      name: 'html_to_markdown',
      pattern: /<[^>]+>/g,
      replacement: '',
      description: 'Strip HTML tags',
    });

    // 多余空行压缩
    this.addRule({
      name: 'collapse_blank_lines',
      pattern: /\n{3,}/g,
      replacement: '\n\n',
      description: 'Collapse multiple blank lines',
    });

    // 多余空格压缩
    this.addRule({
      name: 'collapse_spaces',
      pattern: /[ \t]+/g,
      replacement: ' ',
      description: 'Collapse multiple spaces',
    });

    // 去除行尾空格
    this.addRule({
      name: 'trim_lines',
      pattern: /[ \t]+$/gm,
      replacement: '',
      description: 'Trim trailing whitespace',
    });

    // ANSI 转义码移除
    this.addRule({
      name: 'strip_ansi',
      pattern: /\x1b\[[0-9;]*m/g,
      replacement: '',
      description: 'Strip ANSI escape codes',
    });

    // 压缩 git diff 路径前缀
    this.addRule({
      name: 'git_diff_prefix',
      pattern: /^(a\/|b\/)/gm,
      replacement: '',
      description: 'Strip git diff file prefixes',
    });
  }

  /**
   * 添加自定义压缩规则
   */
  addRule(rule) {
    this.#rules.push({
      name: rule.name,
      pattern: rule.pattern,
      replacement: rule.replacement || '',
      description: rule.description || '',
    });
  }

  /**
   * 压缩文本
   * @param {string} text - 原始文本
   * @param {object} options - 选项
   * @returns {string} 压缩后的文本
   */
  compress(text, options = {}) {
    if (!text || typeof text !== 'string') return '';

    let result = text;
    const maxChars = options.maxChars || this.#maxChars;

    // 应用所有规则
    for (const rule of this.#rules) {
      result = result.replace(rule.pattern, rule.replacement);
    }

    // 去重：移除连续重复的行
    result = this.#deduplicateLines(result);

    // 截断
    result = this.#smartTruncate(result, maxChars);

    return result.trim();
  }

  /**
   * 压缩工具结果
   * @param {any} result - 工具返回结果
   * @param {object} options - 选项
   * @returns {string} 压缩后的文本
   */
  compressToolResult(result, options = {}) {
    let text;
    if (typeof result === 'string') {
      text = result;
    } else if (result && typeof result === 'object') {
      // 优先使用 output 或 content 字段
      text = result.output || result.content || result.message || result.result || JSON.stringify(result, null, 2);
    } else {
      text = String(result);
    }

    return this.compress(text, options);
  }

  /**
   * 行去重
   */
  #deduplicateLines(text) {
    const lines = text.split('\n');
    const seen = new Set();
    const result = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && seen.has(trimmed)) {
        continue; // 跳过重复行
      }
      seen.add(trimmed);
      result.push(line);
    }

    return result.join('\n');
  }

  /**
   * 智能截断 - 在句子/段落边界截断
   */
  #smartTruncate(text, maxChars) {
    if (text.length <= maxChars) return text;

    // 在最后一个完整段落处截断
    const truncated = text.substring(0, maxChars);
    const lastParagraph = truncated.lastIndexOf('\n\n');
    if (lastParagraph > maxChars * 0.5) {
      return truncated.substring(0, lastParagraph) + '\n\n... [truncated]';
    }

    // 在最后一个完整句子处截断
    const lastSentence = Math.max(
      truncated.lastIndexOf('. '),
      truncated.lastIndexOf('! '),
      truncated.lastIndexOf('? '),
      truncated.lastIndexOf('。'),
      truncated.lastIndexOf('！'),
      truncated.lastIndexOf('？'),
    );
    if (lastSentence > maxChars * 0.5) {
      return truncated.substring(0, lastSentence + 1) + '... [truncated]';
    }

    // 最后手段：在空格处截断
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxChars * 0.5) {
      return truncated.substring(0, lastSpace) + '... [truncated]';
    }

    return truncated + '... [truncated]';
  }

  /**
   * 估算 token 数量
   * 规则：~4 字符/token (英文), ~1.5 字符/token (CJK)
   */
  estimateTokens(text) {
    if (!text) return 0;

    let tokens = 0;
    let lastIndex = 0;
    const cjkMatches = text.matchAll(CJK_CHAR_REGEX);

    for (const match of cjkMatches) {
      // CJK 之前的非 CJK 文本
      const nonCjkLength = match.index - lastIndex;
      tokens += Math.ceil(nonCjkLength / 4);

      // CJK 字符
      tokens += match[0].length * 0.67; // ~1.5 chars per token

      lastIndex = match.index + match[0].length;
    }

    // 剩余的非 CJK 文本
    const remaining = text.length - lastIndex;
    tokens += Math.ceil(remaining / 4);

    return Math.ceil(tokens);
  }

  /**
   * 获取压缩统计
   */
  getStats(original, compressed) {
    const origTokens = this.estimateTokens(original);
    const compTokens = this.estimateTokens(compressed);
    const savings = origTokens > 0 ? ((origTokens - compTokens) / origTokens * 100).toFixed(1) : 0;

    return {
      originalChars: original.length,
      compressedChars: compressed.length,
      originalTokens: origTokens,
      compressedTokens: compTokens,
      savingsPercent: savings,
      compressionRatio: compressed.length / (original.length || 1),
    };
  }
}

export default TokenJuice;
