/**
 * Dependency Graph - 依赖关系图
 * 
 * 构建和维护代码库中模块/文件之间的依赖关系
 * 支持按需加载，理解"为什么这样改"需要的所有依赖信息
 */

import { readFile } from 'fs/promises';
import { resolve, join, relative } from 'path';
import { existsSync } from 'fs';

interface Dependency {
  source: string;      // 依赖来源文件
  target: string;      // 被依赖的目标文件
  type: 'import' | 'require' | 'extends' | 'implements' | 'decorator';
  symbols?: string[]; // 导入的具体符号
  isExternal: boolean; // 是否是外部依赖
}

interface FileNode {
  path: string;
  dependencies: Dependency[];
  dependents: string[];  // 反向索引：谁依赖这个文件
  hash: string;
  timestamp: number;
}

/**
 * 依赖关系图
 */
export class DependencyGraph {
  private _nodes: Map<string, FileNode> = new Map();
  private _externalModules: Set<string> = new Set();
  
  /**
   * 添加文件到依赖图
   */
  async addFile(filePath: string): Promise<Dependency[]> {
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = await readFile(filePath, 'utf-8');
    const dependencies = this._extractDependencies(filePath, content);
    
    const node: FileNode = {
      path: filePath,
      dependencies,
      dependents: [],
      hash: this._hashContent(content),
      timestamp: Date.now()
    };

    // 更新反向索引
    for (const dep of dependencies) {
      if (!dep.isExternal) {
        const targetNode = this._nodes.get(dep.target);
        if (targetNode) {
          if (!targetNode.dependents.includes(filePath)) {
            targetNode.dependents.push(filePath);
          }
        }
      }
    }

    this._nodes.set(filePath, node);
    return dependencies;
  }

  /**
   * 获取文件的所有依赖（直接依赖）
   */
  getDirectDependencies(filePath: string): Dependency[] {
    const node = this._nodes.get(filePath);
    return node ? node.dependencies : [];
  }

  /**
   * 获取文件的传递依赖（所有层级的依赖）
   */
  getTransitiveDependencies(filePath: string, maxDepth: number = 5): {
    depth: number;
    path: string;
    dependencies: Dependency[];
  }[] {
    const visited = new Set<string>();
    const result: { depth: number; path: string; dependencies: Dependency[] }[] = [];
    
    const traverse = (currentPath: string, depth: number) => {
      if (depth > maxDepth || visited.has(currentPath)) return;
      visited.add(currentPath);

      const node = this._nodes.get(currentPath);
      if (!node) return;

      for (const dep of node.dependencies) {
        if (!dep.isExternal) {
          result.push({
            depth: depth + 1,
            path: dep.target,
            dependencies: this.getDirectDependencies(dep.target)
          });
          traverse(dep.target, depth + 1);
        }
      }
    };

    traverse(filePath, 0);
    return result;
  }

  /**
   * 获取依赖这个文件的所有文件
   */
  getDependents(filePath: string): string[] {
    const node = this._nodes.get(filePath);
    return node ? node.dependents : [];
  }

  /**
   * 获取传递依赖者（所有依赖这个文件的文件）
   */
  getTransitiveDependents(filePath: string, maxDepth: number = 5): {
    depth: number;
    path: string;
  }[] {
    const visited = new Set<string>();
    const result: { depth: number; path: string }[] = [];
    
    const traverse = (currentPath: string, depth: number) => {
      if (depth > maxDepth || visited.has(currentPath)) return;
      visited.add(currentPath);

      const node = this._nodes.get(currentPath);
      if (!node) return;

      for (const dependent of node.dependents) {
        result.push({ depth: depth + 1, path: dependent });
        traverse(dependent, depth + 1);
      }
    };

    traverse(filePath, 0);
    return result;
  }

  /**
   * 检查修改是否会影响其他文件
   */
  analyzeImpact(filePath: string): {
    directlyAffects: string[];
    transitivelyAffects: { depth: number; path: string }[];
    directlyAffectedBy: string[];
    transitivelyAffectedBy: { depth: number; path: string }[];
  } {
    const directlyAffects = this.getDirectDependencies(filePath)
      .filter(d => !d.isExternal)
      .map(d => d.target);

    const transitivelyAffects = this.getTransitiveDependencies(filePath)
      .map(d => ({ depth: d.depth, path: d.path }));

    const directlyAffectedBy = this.getDependents(filePath);

    const transitivelyAffectedBy = this.getTransitiveDependents(filePath);

    return {
      directlyAffects,
      transitivelyAffects,
      directlyAffectedBy,
      transitivelyAffectedBy
    };
  }

  /**
   * 查找两个文件之间的最短路径
   */
  findPath(from: string, to: string): string[] | null {
    const visited = new Set<string>();
    const queue: { path: string[]; current: string }[] = [
      { path: [from], current: from }
    ];

    while (queue.length > 0) {
      const { path, current } = queue.shift()!;
      
      if (current === to) {
        return path;
      }

      if (visited.has(current)) continue;
      visited.add(current);

      const node = this._nodes.get(current);
      if (!node) continue;

      for (const dep of node.dependencies) {
        if (!dep.isExternal && !visited.has(dep.target)) {
          queue.push({
            path: [...path, dep.target],
            current: dep.target
          });
        }
      }
    }

    return null;
  }

  /**
   * 提取依赖关系
   */
  private _extractDependencies(filePath: string, content: string): Dependency[] {
    const dependencies: Dependency[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // ES6 import
      const es6Match = trimmed.match(
        /^import\s+(?:{([^}]+)}|(\*)\s+as\s+(\w+)|(\w+))\s+from\s+['"]([^'"]+)['"]/
      );
      
      if (es6Match) {
        const [, namedImports, , , defaultImport, source] = es6Match;
        const symbols = namedImports 
          ? namedImports.split(',').map(s => s.trim().split(' as ')[0].trim())
          : defaultImport ? [defaultImport] : [];

        dependencies.push({
          source: filePath,
          target: this._resolvePath(filePath, source),
          type: 'import',
          symbols,
          isExternal: this._isExternalModule(source)
        });
        continue;
      }

      // CommonJS require
      const cjsMatch = trimmed.match(/^const\s+\{([^}]+)\}\s+=\s+require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
      if (cjsMatch) {
        dependencies.push({
          source: filePath,
          target: this._resolvePath(filePath, cjsMatch[2]),
          type: 'require',
          symbols: cjsMatch[1].split(',').map(s => s.trim().split(' as ')[0].trim()),
          isExternal: this._isExternalModule(cjsMatch[2])
        });
        continue;
      }

      // Class extends
      const extendsMatch = trimmed.match(/class\s+\w+\s+extends\s+([A-Z][\w]*)/);
      if (extendsMatch) {
        dependencies.push({
          source: filePath,
          target: extendsMatch[1], // 需要通过符号索引找到实际文件
          type: 'extends',
          isExternal: false
        });
      }
    }

    return dependencies;
  }

  /**
   * 解析模块路径到实际文件路径
   */
  private _resolvePath(fromFile: string, modulePath: string): string {
    if (this._isExternalModule(modulePath)) {
      return modulePath;
    }

    const baseDir = resolve(fromFile, '..');
    
    // 处理相对路径
    if (modulePath.startsWith('.')) {
      return resolve(baseDir, modulePath);
    }

    // 处理包名（简化处理，实际应该检查 node_modules）
    return join(baseDir, 'node_modules', modulePath);
  }

  /**
   * 检查是否是外部模块
   */
  private _isExternalModule(modulePath: string): boolean {
    // 外部模块通常不以 . 或 / 开头
    return !modulePath.startsWith('.') && !modulePath.startsWith('/');
  }

  /**
   * 内容哈希
   */
  private _hashContent(content: string): string {
    const { createHash } = require('crypto');
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * 获取依赖图统计
   */
  getStats(): {
    files: number;
    externalModules: number;
    avgDependencies: number;
    mostDependent: { path: string; count: number }[];
  } {
    let totalDeps = 0;
    let mostDependent: { path: string; count: number }[] = [];

    for (const [path, node] of this._nodes.entries()) {
      totalDeps += node.dependencies.filter(d => !d.isExternal).length;
      mostDependent.push({ path, count: node.dependents.length });
    }

    mostDependent.sort((a, b) => b.count - a.count);

    return {
      files: this._nodes.size,
      externalModules: this._externalModules.size,
      avgDependencies: this._nodes.size > 0 ? totalDeps / this._nodes.size : 0,
      mostDependent: mostDependent.slice(0, 10)
    };
  }

  /**
   * 导出图数据（用于可视化或序列化）
   */
  export(): {
    nodes: Array<{ path: string; hash: string; timestamp: number }>;
    edges: Array<{ from: string; to: string; type: string }>;
  } {
    const nodes: Array<{ path: string; hash: string; timestamp: number }> = [];
    const edges: Array<{ from: string; to: string; type: string }> = [];

    for (const [path, node] of this._nodes.entries()) {
      nodes.push({
        path,
        hash: node.hash,
        timestamp: node.timestamp
      });

      for (const dep of node.dependencies) {
        if (!dep.isExternal) {
          edges.push({
            from: path,
            to: dep.target,
            type: dep.type
          });
        }
      }
    }

    return { nodes, edges };
  }
}

export default DependencyGraph;
