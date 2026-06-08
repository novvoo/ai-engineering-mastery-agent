/**
 * AST Metadata Extractor - AST 元数据提取器
 * 
 * 提供代码的 AST（抽象语法树）级别元数据
 * 支持代码理解，理解"这段代码做什么"
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';

interface ASTNode {
  type: string;
  name?: string;
  start: { line: number; column: number };
  end: { line: number; column: number };
  children?: ASTNode[];
  metadata?: Record<string, any>;
}

interface FunctionMetadata {
  name: string;
  params: Array<{
    name: string;
    type?: string;
    defaultValue?: string;
  }>;
  returnType?: string;
  isAsync: boolean;
  isGenerator: boolean;
  calls: string[];  // 函数调用的其他函数
  references: string[];  // 引用的变量
  complexity: number;  // 圈复杂度估算
  startLine: number;
  endLine: number;
}

interface ClassMetadata {
  name: string;
  extends?: string;
  implements?: string[];
  properties: Array<{
    name: string;
    type?: string;
    visibility: 'public' | 'private' | 'protected';
    isStatic: boolean;
    initializer?: string;
  }>;
  methods: Array<{
    name: string;
    visibility: 'public' | 'private' | 'protected';
    isStatic: boolean;
    isAsync: boolean;
    isGetter: boolean;
    isSetter: boolean;
  }>;
  decorators?: string[];
  startLine: number;
  endLine: number;
}

interface CodeRegion {
  type: 'function' | 'class' | 'method' | 'block' | 'import' | 'export' | 'comment';
  name?: string;
  startLine: number;
  endLine: number;
  content: string;
  children: CodeRegion[];
  metadata: Record<string, any>;
}

/**
 * AST 元数据提取器
 */
export class ASTMetadataExtractor {
  private _cache: Map<string, {
    functions: Map<string, FunctionMetadata>;
    classes: Map<string, ClassMetadata>;
    regions: CodeRegion[];
    hash: string;
  }> = new Map();

  /**
   * 提取文件的 AST 元数据
   */
  async extract(filePath: string): Promise<{
    functions: FunctionMetadata[];
    classes: ClassMetadata[];
    regions: CodeRegion[];
  }> {
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = await readFile(filePath, 'utf-8');
    const hash = this._hashContent(content);

    // 检查缓存
    const cached = this._cache.get(filePath);
    if (cached && cached.hash === hash) {
      return {
        functions: Array.from(cached.functions.values()),
        classes: Array.from(cached.classes.values()),
        regions: cached.regions
      };
    }

    const lines = content.split('\n');
    
    const functions = this._extractFunctions(lines, content);
    const classes = this._extractClasses(lines, content);
    const regions = this._extractRegions(lines, content);

    const data = {
      functions: new Map(functions.map(f => [f.name, f])),
      classes: new Map(classes.map(c => [c.name, c])),
      regions,
      hash
    };

    this._cache.set(filePath, data);

    return {
      functions,
      classes,
      regions
    };
  }

  /**
   * 获取函数元数据
   */
  getFunctionMetadata(filePath: string, functionName: string): FunctionMetadata | null {
    const cached = this._cache.get(filePath);
    if (!cached) return null;
    return cached.functions.get(functionName) || null;
  }

  /**
   * 获取类的元数据
   */
  getClassMetadata(filePath: string, className: string): ClassMetadata | null {
    const cached = this._cache.get(filePath);
    if (!cached) return null;
    return cached.classes.get(className) || null;
  }

  /**
   * 获取代码区域
   */
  getCodeRegion(filePath: string, line: number): CodeRegion | null {
    const cached = this._cache.get(filePath);
    if (!cached) return null;

    const findRegion = (regions: CodeRegion[]): CodeRegion | null => {
      for (const region of regions) {
        if (line >= region.startLine && line <= region.endLine) {
          const child = findRegion(region.children);
          return child || region;
        }
      }
      return null;
    };

    return findRegion(cached.regions);
  }

  /**
   * 提取函数元数据
   */
  private _extractFunctions(lines: string[], content: string): FunctionMetadata[] {
    const functions: FunctionMetadata[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // 函数声明
      const funcMatch = trimmed.match(
        /^(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_$][\w$]*)\s*\(/
      );
      
      if (funcMatch) {
        const name = funcMatch[1];
        const isAsync = trimmed.includes('async');
        const endLine = this._findBlockEnd(lines, i);
        
        functions.push({
          name,
          params: this._extractParams(line),
          returnType: this._extractReturnType(trimmed),
          isAsync,
          isGenerator: trimmed.includes('*'),
          calls: this._extractCalls(lines.slice(i, endLine).join('\n')),
          references: this._extractReferences(lines.slice(i, endLine).join('\n')),
          complexity: this._estimateComplexity(lines.slice(i, endLine).join('\n')),
          startLine: i + 1,
          endLine
        });
      }

      // 箭头函数赋值
      const arrowMatch = trimmed.match(
        /^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s+)?\s*\([^)]*\)\s*=>/
      );
      if (arrowMatch) {
        const name = arrowMatch[1];
        const isAsync = trimmed.includes('async');
        const endLine = this._findBlockEnd(lines, i);

        functions.push({
          name,
          params: this._extractParams(trimmed),
          isAsync,
          isGenerator: false,
          calls: this._extractCalls(lines.slice(i, endLine).join('\n')),
          references: this._extractReferences(lines.slice(i, endLine).join('\n')),
          complexity: this._estimateComplexity(lines.slice(i, endLine).join('\n')),
          startLine: i + 1,
          endLine
        });
      }
    }

    return functions;
  }

  /**
   * 提取类元数据
   */
  private _extractClasses(lines: string[], content: string): ClassMetadata[] {
    const classes: ClassMetadata[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      const classMatch = trimmed.match(/^(?:export\s+)?class\s+([a-zA-Z_$][\w$]*)/);
      if (classMatch) {
        const name = classMatch[1];
        const endLine = this._findBlockEnd(lines, i);
        const classLines = lines.slice(i, endLine).join('\n');

        // 提取 extends
        const extendsMatch = trimmed.match(/extends\s+([A-Z][\w]*)/);
        
        // 提取属性和方法
        const properties: ClassMetadata['properties'] = [];
        const methods: ClassMetadata['methods'] = [];

        for (let j = i + 1; j < endLine; j++) {
          const methodLine = lines[j].trim();
          
          // 方法
          const methodMatch = methodLine.match(
            /^(?:(private|protected|public)\s+)?(?:static\s+)?(?:async\s+)?([a-zA-Z_$][\w$]*)\s*\(/
          );
          if (methodMatch) {
            const [, visibility, methodName] = methodMatch;
            methods.push({
              name: methodName,
              visibility: this._parseVisibility(visibility),
              isStatic: methodLine.includes('static'),
              isAsync: methodLine.includes('async'),
              isGetter: false,
              isSetter: false
            });
          }

          // 属性
          const propMatch = methodLine.match(
            /^(?:(private|protected|public)\s+)?(?:static\s+)?(?:readonly\s+)?([a-zA-Z_$][\w$]*)\s*[=:]/,
          );
          if (propMatch && !methodLine.includes('(')) {
            properties.push({
              name: propMatch[2],
              visibility: this._parseVisibility(propMatch[1]),
              isStatic: methodLine.includes('static'),
              initializer: methodLine.split(/[=:]/)[1]?.trim()
            });
          }
        }

        classes.push({
          name,
          extends: extendsMatch?.[1],
          properties,
          methods,
          decorators: this._extractDecorators(classLines),
          startLine: i + 1,
          endLine
        });
      }
    }

    return classes;
  }

  /**
   * 提取代码区域
   */
  private _extractRegions(lines: string[], content: string): CodeRegion[] {
    const regions: CodeRegion[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        regions.push({
          type: 'comment',
          startLine: i + 1,
          endLine: i + 1,
          content: trimmed,
          children: [],
          metadata: { isBlock: trimmed.startsWith('/*') }
        });
      }
    }

    return regions;
  }

  /**
   * 提取参数
   */
  private _extractParams(line: string): Array<{ name: string; type?: string; defaultValue?: string }> {
    const match = line.match(/\(([^)]*)\)/);
    if (!match) return [];

    const params: Array<{ name: string; type?: string; defaultValue?: string }> = [];
    const paramStr = match[1];

    const paramList = paramStr.split(',').map(p => p.trim()).filter(Boolean);
    
    for (const param of paramList) {
      const [namePart, defaultPart] = param.split('=').map(s => s.trim());
      const name = namePart.split(':')[0].trim();
      const type = namePart.split(':')[1]?.trim();

      params.push({
        name,
        type,
        defaultValue: defaultPart
      });
    }

    return params;
  }

  /**
   * 提取返回类型
   */
  private _extractReturnType(line: string): string | undefined {
    const match = line.match(/\)\s*(?::\s*([^=]+))?\s*[{=]/);
    return match?.[1]?.trim();
  }

  /**
   * 提取函数调用
   */
  private _extractCalls(code: string): string[] {
    const calls: string[] = [];
    const regex = /\b([a-zA-Z_$][\w$]*)\s*\(/g;
    let match;

    while ((match = regex.exec(code)) !== null) {
      const name = match[1];
      // 过滤内置函数和关键字
      if (!['if', 'for', 'while', 'switch', 'catch', 'return', 'throw', 'new'].includes(name)) {
        calls.push(name);
      }
    }

    return [...new Set(calls)];
  }

  /**
   * 提取引用
   */
  private _extractReferences(code: string): string[] {
    const refs: string[] = [];
    const regex = /\b([a-zA-Z_$][\w$]*)\b/g;
    let match;

    while ((match = regex.exec(code)) !== null) {
      const name = match[1];
      // 过滤关键字
      if (!['const', 'let', 'var', 'function', 'class', 'if', 'for', 'while', 'return', 'import', 'export', 'from', 'async', 'await', 'new', 'this', 'super'].includes(name)) {
        refs.push(name);
      }
    }

    return [...new Set(refs)];
  }

  /**
   * 估算圈复杂度
   */
  private _estimateComplexity(code: string): number {
    let complexity = 1; // 基础复杂度

    // 条件语句
    complexity += (code.match(/\bif\b/g) || []).length;
    complexity += (code.match(/\belse\s+if\b/g) || []).length;
    complexity += (code.match(/\bcase\b/g) || []).length;
    
    // 循环
    complexity += (code.match(/\bfor\b/g) || []).length;
    complexity += (code.match(/\bwhile\b/g) || []).length;
    complexity += (code.match(/\bdo\b/g) || []).length;
    
    // 逻辑运算符
    complexity += (code.match(/&&|\|\|/g) || []).length;
    
    // 异常处理
    complexity += (code.match(/\bcatch\b/g) || []).length;
    complexity += (code.match(/\bthrow\b/g) || []).length;

    return complexity;
  }

  /**
   * 查找代码块结束行
   */
  private _findBlockEnd(lines: string[], startLine: number): number {
    let braceCount = 0;
    let foundOpen = false;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          foundOpen = true;
        } else if (char === '}') {
          braceCount--;
        }
      }
      
      if (foundOpen && braceCount === 0) {
        return i + 1;
      }
    }

    return startLine + 1;
  }

  /**
   * 解析可见性
   */
  private _parseVisibility(modifier?: string): 'public' | 'private' | 'protected' {
    switch (modifier) {
      case 'private': return 'private';
      case 'protected': return 'protected';
      default: return 'public';
    }
  }

  /**
   * 提取装饰器
   */
  private _extractDecorators(code: string): string[] {
    const decorators: string[] = [];
    const regex = /@([a-zA-Z_$][\w$]*)/g;
    let match;

    while ((match = regex.exec(code)) !== null) {
      decorators.push(match[1]);
    }

    return decorators;
  }

  /**
   * 内容哈希
   */
  private _hashContent(content: string): string {
    const { createHash } = require('crypto');
    return createHash('sha256').update(content).digest('hex');
  }
}

export default ASTMetadataExtractor;
