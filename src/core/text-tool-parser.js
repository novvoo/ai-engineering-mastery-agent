/**
 * Text Tool Parser
 * 为不支持 function calling 的语言类 LLM 提供鲁棒的工具调用解析
 * 
 * 支持多种格式：
 * 1. CALL tool_name({"param": "value"})
 * 2. ```tool\n{"name": "tool_name", "arguments": {...}}\n```
 * 3. <action>{"tool_name": {"param": "value"}}</action>
 * 4. {"action": {"tool_name": {"param": "value"}}}
 * 5. Mixed text containing {"action": {"tool_name": {"param": "value"}}}
 * 6. <tool>tool_name</tool><arg>value</arg>
 * 7. <function_call><function_name>tool</function_name>...</function_call>
 * 8. 自然语言描述（通过关键词匹配）
 */

export class TextToolParser {
  #toolRegistry;
  #fallbackPatterns;

  constructor(toolRegistry) {
    this.#toolRegistry = toolRegistry;
    this.#fallbackPatterns = this.#buildFallbackPatterns();
  }

  /**
   * 解析文本中的工具调用
   * @param {string} text - LLM 输出文本
   * @returns {Array<object>} 解析出的工具调用列表
   */
  parse(text) {
    if (!text || typeof text !== 'string') return [];

    const toolCalls = [];

    // 尝试多种解析策略
    toolCalls.push(...this.#parseCALLFormat(text));
    toolCalls.push(...this.#parseJSONBlockFormat(text));
    toolCalls.push(...this.#parseActionTagFormat(text));
    toolCalls.push(...this.#parseRawJSONActionFormat(text));
    toolCalls.push(...this.#parseEmbeddedJSONActionFormat(text));
    toolCalls.push(...this.#parseXMLFormat(text));
    toolCalls.push(...this.#parseFunctionCallTagFormat(text));
    toolCalls.push(...this.#parseNaturalLanguage(text));

    // 去重
    return this.#deduplicate(toolCalls);
  }

  /**
   * 格式 1: CALL tool_name({"param": "value"})
   */
  #parseCALLFormat(text) {
    const toolCalls = [];
    // 支持多行和嵌套括号
    const callRegex = /CALL\s+\/?([A-Za-z_][\w-]*)\s*\((\{[\s\S]*?\})\)/g;
    let match;

    while ((match = callRegex.exec(text)) !== null) {
      const name = this.#resolveToolName(match[1]);
      const argsStr = match[2];
      
      try {
        const args = this.#safeJSONParse(argsStr);
        if (args) {
          toolCalls.push({
            id: `call_${Date.now()}_${toolCalls.length}`,
            name,
            arguments: args,
            source: 'CALL_format',
          });
        }
      } catch (e) {
        console.debug(`Failed to parse CALL format: ${argsStr.substring(0, 50)}`);
      }
    }

    return toolCalls;
  }

  /**
   * 格式 2: ```tool\n{"name": "tool_name", "arguments": {...}}\n```
   */
  #parseJSONBlockFormat(text) {
    const toolCalls = [];
    const blockRegex = /```(?:tool)?\s*\n?\s*(\{[\s\S]*?\})\s*\n?```/g;
    let match;

    while ((match = blockRegex.exec(text)) !== null) {
      try {
        const json = this.#safeJSONParse(match[1]);
        toolCalls.push(...this.#toolCallsFromJSON(json, 'JSON_block', toolCalls.length));
      } catch (e) {
        // 不是有效的工具调用 JSON
      }
    }

    return toolCalls;
  }
  
  /**
   * 格式 3: <action>{"tool_name": {"param": "value"}}</action>
   * Some models emit XML-wrapped JSON even when instructed to use CALL.
   */
  #parseActionTagFormat(text) {
    const toolCalls = [];
    const actionRegex = /<action>\s*([\s\S]*?)\s*<\/action>/gi;
    let match;

    while ((match = actionRegex.exec(text)) !== null) {
      const json = this.#safeJSONParse(match[1].trim());
      toolCalls.push(...this.#toolCallsFromJSON(json, 'action_tag', toolCalls.length));
    }

    return toolCalls;
  }

  /**
   * 格式 4: {"action": {"tool_name": {"param": "value"}}}
   */
  #parseRawJSONActionFormat(text) {
    const trimmed = text.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
      return [];
    }

    return this.#toolCallsFromJSON(this.#safeJSONParse(trimmed), 'raw_JSON_action', 0);
  }

  /**
   * 格式 5: mixed prose/final text with an embedded JSON action object.
   */
  #parseEmbeddedJSONActionFormat(text) {
    if (!text.includes('"action"') && !text.includes("'action'")) {
      return [];
    }

    const toolCalls = [];
    for (const candidate of this.#extractJSONObjectCandidates(text)) {
      const json = this.#safeJSONParse(candidate);
      toolCalls.push(...this.#toolCallsFromJSON(json, 'embedded_JSON_action', toolCalls.length));
    }
    return toolCalls;
  }

  #extractJSONObjectCandidates(text) {
    const candidates = [];
    for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
      let depth = 0;
      let inString = false;
      let quote = '';
      let escaped = false;

      for (let index = start; index < text.length; index++) {
        const char = text[index];
        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (char === '\\') {
            escaped = true;
          } else if (char === quote) {
            inString = false;
            quote = '';
          }
          continue;
        }

        if (char === '"' || char === "'") {
          inString = true;
          quote = char;
          continue;
        }
        if (char === '{') depth++;
        if (char === '}') depth--;
        if (depth === 0) {
          candidates.push(text.slice(start, index + 1));
          break;
        }
      }
    }
    return candidates;
  }

  /**
   * 格式 6: <tool>tool_name</tool><arg>value</arg>
   */
  #parseXMLFormat(text) {
    const toolCalls = [];
    const toolRegex = /<tool>\/?([A-Za-z_][\w-]*)<\/tool>/g;
    let match;

    while ((match = toolRegex.exec(text)) !== null) {
      const name = this.#resolveToolName(match[1]);
      const args = {};
      
      // 提取参数
      const argRegex = new RegExp(`<arg(?:\s+name="([^"]+)")?>([^<]*)</arg>`, 'g');
      let argMatch;
      let argIndex = 0;
      
      while ((argMatch = argRegex.exec(text)) !== null) {
        const argName = argMatch[1] || `arg${argIndex++}`;
        args[argName] = argMatch[2].trim();
      }

      toolCalls.push({
        id: `call_${Date.now()}_${toolCalls.length}`,
        name,
        arguments: args,
        source: 'XML_format',
      });
    }

    return toolCalls;
  }

  /**
   * 格式 7: <function_call><function_name>tool</function_name><parameters>...</parameters></function_call>
   * Some OpenAI-compatible models emit this XML-ish shape for tool calls.
   */
  #parseFunctionCallTagFormat(text) {
    const toolCalls = [];
    const callRegex = /<function_call>\s*([\s\S]*?)\s*<\/function_call>/gi;
    let match;

    while ((match = callRegex.exec(text)) !== null) {
      const body = match[1];
      const nameMatch = body.match(/<function_name>\s*([^<]+?)\s*<\/function_name>/i)
        || body.match(/<name>\s*([^<]+?)\s*<\/name>/i);
      if (!nameMatch) continue;

      const rawName = nameMatch[1].trim();
      const resolved = this.#resolveFunctionTagToolName(rawName);
      if (!this.#toolRegistry?.has?.(resolved)) {
        continue;
      }

      const args = this.#extractFunctionTagArgs(body, resolved);
      toolCalls.push({
        id: `call_${Date.now()}_${toolCalls.length}`,
        name: resolved,
        arguments: args,
        source: 'function_call_tag',
      });
    }

    return toolCalls;
  }

  #resolveFunctionTagToolName(name) {
    const normalized = String(name || '').trim().replace(/^\//, '').toLowerCase();
    if (['bash', 'terminal', 'exec', 'execute_command', 'run_command', 'run_in_terminal'].includes(normalized)) {
      return 'shell';
    }
    return this.#resolveToolName(normalized);
  }

  #extractFunctionTagArgs(body, toolName) {
    const parametersMatch = body.match(/<parameters>\s*([\s\S]*?)\s*<\/parameters>/i);
    const parameters = parametersMatch ? parametersMatch[1].trim() : body;

    const json = this.#safeJSONParse(parameters);
    if (json && typeof json === 'object' && !Array.isArray(json)) {
      return this.#normalizeFunctionTagArgs(json, toolName);
    }

    const args = {};
    const parameterRegex = /<parameter(?:\s+name="([^"]+)")?>\s*([\s\S]*?)\s*<\/parameter>/gi;
    let parameterMatch;
    let index = 0;

    while ((parameterMatch = parameterRegex.exec(parameters)) !== null) {
      let key = parameterMatch[1]?.trim();
      let value = parameterMatch[2].trim();
      const inlineName = value.match(/^([A-Za-z_][\w-]*)\s*\n([\s\S]*)$/);

      if (!key && inlineName) {
        key = inlineName[1];
        value = inlineName[2].trim();
      }

      args[key || `arg${index++}`] = value;
    }

    return this.#normalizeFunctionTagArgs(args, toolName);
  }

  #normalizeFunctionTagArgs(args, toolName) {
    if (toolName === 'shell') {
      const command = args.command || args.commands || args.cmd || args.code || args.arg0;
      return command ? { command } : args;
    }
    return args;
  }

  /**
   * 格式 8: 自然语言关键词匹配（fallback）
   */
  #parseNaturalLanguage(text) {
    const toolCalls = [];
    const lowerText = text.toLowerCase();

    for (const pattern of this.#fallbackPatterns) {
      const match = lowerText.match(pattern.regex);
      if (match) {
        // 提取参数
        const args = {};
        if (pattern.paramExtractor) {
          Object.assign(args, pattern.paramExtractor(match, text));
        }

        const required = pattern.required || [];
        if (required.some(paramName => args[paramName] === undefined || args[paramName] === '')) {
          continue;
        }

        toolCalls.push({
          id: `call_${Date.now()}_${toolCalls.length}`,
          name: pattern.toolName,
          arguments: args,
          source: 'natural_language',
          confidence: 0.6,
        });
      }
    }

    return toolCalls;
  }

  /**
   * 构建自然语言 fallback 模式
   */
  #buildFallbackPatterns() {
    const tools = this.#toolRegistry ? this.#toolRegistry.getAll() : [];
    const patterns = [];

    for (const tool of tools) {
      const name = tool.name.toLowerCase();
      const desc = (tool.description || '').toLowerCase();

      // 为每个工具构建关键词模式
      const keywords = [name];
      
      // 从描述中提取动词
      if (desc.includes('read') || desc.includes('show') || desc.includes('get')) {
        keywords.push('read', 'show', 'get', 'display');
      }
      if (desc.includes('write') || desc.includes('create') || desc.includes('save')) {
        keywords.push('write', 'create', 'save', 'add');
      }
      if (desc.includes('delete') || desc.includes('remove')) {
        keywords.push('delete', 'remove', 'clear');
      }
      if (desc.includes('search') || desc.includes('find')) {
        keywords.push('search', 'find', 'look for');
      }
      if (desc.includes('execute') || desc.includes('run')) {
        keywords.push('execute', 'run', 'start');
      }

      // 构建正则
      const keywordPattern = keywords.join('|');
      patterns.push({
        toolName: tool.name,
        regex: new RegExp(`\\b(${keywordPattern})\\b.*\\b(${name.replace(/_/g, '[_ ]')}|[${name.split('_').join('|')}])\\b`, 'i'),
        paramExtractor: (match, fullText) => this.#extractParamsFromContext(tool, fullText),
        required: tool.required || (tool.parameters && tool.parameters.required ? tool.parameters.required : []),
      });

      if (name === 'glob') {
        patterns.push({
          toolName: tool.name,
          regex: /\b(list|find|show|get|count)\b.*\b(javascript|js)\b.*\b(files?|目录|文件)\b/i,
          paramExtractor: (match, fullText) => this.#extractParamsFromContext(tool, fullText),
          required: tool.required || (tool.parameters && tool.parameters.required ? tool.parameters.required : []),
        });
      }
    }

    return patterns;
  }

  /**
   * 从上下文中提取参数
   */
  #extractParamsFromContext(tool, text) {
    const args = {};
    const params = tool.params || (tool.parameters && tool.parameters.properties ? tool.parameters.properties : tool.parameters) || {};

    for (const [paramName, paramSchema] of Object.entries(params)) {
      const lowerText = text.toLowerCase();
      if (tool.name === 'glob' && paramName === 'pattern') {
        const explicitGlob = text.match(/["'`]((?:\*\*\/)?[^"'`\s]*\.(?:js|mjs|cjs|ts|tsx|jsx))["'`]/i)
          || text.match(/(?:^|\s)((?:\*\*\/)?\*\.js)\b/i);
        if (explicitGlob) {
          args[paramName] = explicitGlob[1];
          continue;
        }
        if (/\b(javascript|js)\b/i.test(text) || /js\s*文件|javascript\s*文件/i.test(lowerText)) {
          args[paramName] = '*.js';
          continue;
        }
      }

      // 尝试从文本中提取参数值
      const patterns = [
        new RegExp(`${paramName}[:=]\\s*["']?([^"'\\s,]+)["']?`, 'i'),
        new RegExp(`${paramName}\\s+is\\s+["']?([^"'\\n]+)["']?`, 'i'),
        new RegExp(`${paramName}\\s*\\(([^)]+)\\)`, 'i'),
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          args[paramName] = this.#castParam(match[1].trim(), paramSchema.type);
          break;
        }
      }
    }

    return args;
  }

  /**
   * 类型转换
   */
  #castParam(value, type) {
    if (type === 'boolean') {
      return ['true', 'yes', '1', 'on'].includes(value.toLowerCase());
    }
    if (type === 'number' || type === 'integer') {
      const num = Number(value);
      return isNaN(num) ? value : num;
    }
    if (type === 'array') {
      try {
        return JSON.parse(value);
      } catch {
        return value.split(/[,;]/).map(s => s.trim());
      }
    }
    return value;
  }

  /**
   * 安全的 JSON 解析
   */
  #safeJSONParse(str) {
    try {
      // 先尝试直接解析
      return JSON.parse(str);
    } catch {
      // 尝试修复常见 JSON 错误
      try {
        // 单引号转双引号
        const fixed = str
          .replace(/'/g, '"')
          .replace(/(\w+):/g, '"$1":')
          .replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(fixed);
      } catch {
        return null;
      }
    }
  }

  #toolCallsFromJSON(json, source, startIndex = 0) {
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      return [];
    }

    const directName = json.name || json.tool;
    if (directName) {
      const name = this.#resolveToolName(directName);
      if (!this.#toolRegistry?.has?.(name)) {
        return [];
      }
      return [{
        id: `call_${Date.now()}_${startIndex}`,
        name,
        arguments: json.arguments || json.args || json.params || {},
        source,
      }];
    }

    const action = json.action && typeof json.action === 'object' && !Array.isArray(json.action)
      ? json.action
      : json;
    const entries = Object.entries(action);
    if (entries.length !== 1) {
      return [];
    }

    const [rawName, args] = entries[0];
    const name = this.#resolveFunctionTagToolName(rawName);
    if (!this.#toolRegistry?.has?.(name)) {
      return [];
    }

    return [{
      id: `call_${Date.now()}_${startIndex}`,
      name,
      arguments: this.#normalizeFunctionTagArgs(
        args && typeof args === 'object' && !Array.isArray(args) ? args : {},
        name
      ),
      source,
    }];
  }

  #resolveToolName(name) {
    const rawName = String(name || '').replace(/^\//, '');
    if (this.#toolRegistry?.has?.(rawName)) {
      return rawName;
    }

    const underscored = rawName.replace(/-/g, '_');
    if (this.#toolRegistry?.has?.(underscored)) {
      return underscored;
    }

    return rawName;
  }

  /**
   * 去重
   */
  #deduplicate(toolCalls) {
    const seen = new Set();
    return toolCalls.filter(tc => {
      const key = `${tc.name}:${JSON.stringify(tc.arguments)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * 生成工具使用提示
   * 用于指导语言类 LLM 如何调用工具
   */
  generateToolPrompt() {
    const tools = this.#toolRegistry ? this.#toolRegistry.getAll() : [];
    
    const lines = [
      'You have access to the following tools:',
      '',
      ...tools.map(t => {
        const params = Object.entries(t.parameters || {})
          .map(([k, v]) => `${k}: ${v.type}`)
          .join(', ');
        return `- ${t.name}(${params}): ${t.description}`;
      }),
      '',
      'To use a tool, output in one of these formats:',
      '1. CALL tool_name({"param": "value"})',
      '2. ```tool\n{"name": "tool_name", "arguments": {"param": "value"}}\n```',
      '3. <action>{"tool_name": {"param": "value"}}</action>',
      '4. {"action": {"tool_name": {"param": "value"}}}',
      '',
      'After receiving tool results, continue reasoning or output FINAL_ANSWER: followed by your final response.',
    ];

    return lines.join('\n');
  }
}

export default TextToolParser;
