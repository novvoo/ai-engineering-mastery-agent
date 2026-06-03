/**
 * VectorIndex - 持久化向量索引
 * 将索引缓存到磁盘，agent 重启后无需重建
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const INDEX_VERSION = 1;

export class VectorIndex {
  #indexDir;

  constructor(baseDir) {
    this.#indexDir = join(baseDir, '.agent-data', 'vector-index');
  }

  /**
   * 从磁盘加载索引
   * @param {string} cacheKey
   * @returns {Promise<Array|null>} chunks 或 null（无缓存/版本不匹配）
   */
  async load(cacheKey) {
    const indexPath = this.#getIndexPath(cacheKey);
    try {
      const raw = await readFile(indexPath, 'utf-8');
      const data = JSON.parse(raw);
      if (data && data.version === INDEX_VERSION && Array.isArray(data.chunks) && data.chunks.length > 0) {
        return { chunks: data.chunks, stale: false };
      }
    } catch {}
    return null;
  }

  /**
   * 保存索引到磁盘
   * @param {string} cacheKey
   * @param {Array} chunks
   */
  async save(cacheKey, chunks) {
    const indexPath = this.#getIndexPath(cacheKey);
    await mkdir(this.#indexDir, { recursive: true });
    const data = {
      version: INDEX_VERSION,
      createdAt: new Date().toISOString(),
      chunks,
    };
    await writeFile(indexPath, JSON.stringify(data), 'utf-8');
  }

  #getIndexPath(cacheKey) {
    const hash = this.#simpleHash(cacheKey);
    return join(this.#indexDir, `${hash}.json`);
  }

  #simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
    }
    return Math.abs(hash).toString(36);
  }
}
