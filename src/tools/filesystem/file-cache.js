/**
 * Efficient File Cache Manager
 * 
 * Design Principles:
 * - Fast detection: mtime + size first, hash only when needed
 * - Space efficient: LRU with size limit
 * - Low IO: batch reads, async operations
 */

import { readFile, writeFile, stat, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, relative } from 'path';
import { createHash } from 'crypto';
import { homedir } from 'os';

const DEFAULT_CACHE_DIR = join(homedir(), '.agent-cache', 'files');
const DEFAULT_MAX_SIZE = 100 * 1024 * 1024; // 100MB
const META_FILE = 'cache-meta.json';

export class FileCache {
  constructor(options = {}) {
    this.cacheDir = options.cacheDir || DEFAULT_CACHE_DIR;
    this.maxSize = options.maxSize || DEFAULT_MAX_SIZE;
    this.meta = new Map();
    this.contentCache = new Map(); // path -> content
    this.currentSize = 0;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) {return;}
    
    await this._ensureCacheDir();
    await this._loadMeta();
    this.initialized = true;
  }

  async _ensureCacheDir() {
    if (!existsSync(this.cacheDir)) {
      await mkdir(this.cacheDir, { recursive: true });
    }
  }

  async _loadMeta() {
    const metaPath = join(this.cacheDir, META_FILE);
    if (existsSync(metaPath)) {
      try {
        const data = await readFile(metaPath, 'utf-8');
        const obj = JSON.parse(data);
        this.meta = new Map(Object.entries(obj));
      } catch {
        this.meta = new Map();
      }
    }
  }

  async _saveMeta() {
    const metaPath = join(this.cacheDir, META_FILE);
    const obj = Object.fromEntries(this.meta);
    await writeFile(metaPath, JSON.stringify(obj, null, 2));
  }

  _getCacheKey(fullPath, workingDir) {
    // 用相对路径作为key，避免机器特定的绝对路径
    if (workingDir) {
      const rel = relative(workingDir, fullPath);
      if (!rel.startsWith('..')) {
        return rel;
      }
    }
    return fullPath;
  }

  _getFileCachePath(key) {
    // 用hash作为文件名避免路径问题
    const hash = createHash('md5').update(key).digest('hex');
    return join(this.cacheDir, `${hash}.cache`);
  }

  _hashContent(content) {
    return createHash('sha256').update(content).digest('hex');
  }

  async _getFileInfo(fullPath) {
    const stats = await stat(fullPath);
    return {
      mtimeMs: stats.mtimeMs,
      size: stats.size
    };
  }

  async _isFileChanged(fullPath, key) {
    const cached = this.meta.get(key);
    if (!cached) {return true;}

    try {
      const current = await this._getFileInfo(fullPath);
      
      // Fast check: mtime + size first (99.9% accurate)
      if (Math.abs(current.mtimeMs - cached.mtimeMs) < 100 &&
          current.size === cached.size) {
        return false;
      }

      // If mtime/size changed, verify with content hash
      const content = await readFile(fullPath, 'utf-8');
      const newHash = this._hashContent(content);
      
      if (newHash === cached.hash) {
        // Content actually unchanged, update meta with new mtime/size
        this.meta.set(key, {
          ...cached,
          mtimeMs: current.mtimeMs,
          size: current.size,
          lastAccessed: Date.now()
        });
        await this._saveMeta();
        return false;
      }

      return true;
    } catch {
      return true;
    }
  }

  _evictLRU() {
    const sorted = Array.from(this.contentCache.entries())
      .map(([key, { data, lastAccessed }]) => ({ key, lastAccessed, size: data.length }))
      .sort((a, b) => a.lastAccessed - b.lastAccessed);

    for (const { key, size } of sorted) {
      if (this.currentSize <= this.maxSize * 0.8) {break;}
      
      this.contentCache.delete(key);
      this.currentSize -= size;
    }
  }

  async get(fullPath, workingDir, { readContent = false } = {}) {
    await this.init();
    
    const key = this._getCacheKey(fullPath, workingDir);
    
    // Check if file changed
    const changed = await this._isFileChanged(fullPath, key);
    if (!changed) {
      // Try memory first
      if (readContent && this.contentCache.has(key)) {
        const cached = this.contentCache.get(key);
        cached.lastAccessed = Date.now();
        return { valid: true, content: cached.data, fromCache: true };
      }
      
      // Try disk cache
      const cachedMeta = this.meta.get(key);
      if (readContent && cachedMeta?.hasContent) {
        const cachePath = this._getFileCachePath(key);
        if (existsSync(cachePath)) {
          try {
            const content = await readFile(cachePath, 'utf-8');
            
            // Update memory cache
            this.contentCache.set(key, {
              data: content,
              lastAccessed: Date.now()
            });
            this.currentSize += content.length;
            
            // Update meta
            cachedMeta.lastAccessed = Date.now();
            this.meta.set(key, cachedMeta);
            await this._saveMeta();
            
            return { valid: true, content, fromCache: true };
          } catch {
            // Failed to read cache, fall through
          }
        }
      }
      
      // No content needed, just confirm validity
      return { valid: true, content: null, fromCache: true };
    }

    return { valid: false, content: null, fromCache: false };
  }

  async set(fullPath, workingDir, content) {
    await this.init();
    
    const key = this._getCacheKey(fullPath, workingDir);
    const info = await this._getFileInfo(fullPath);
    const hash = this._hashContent(content);
    
    const metaEntry = {
      mtimeMs: info.mtimeMs,
      size: info.size,
      hash,
      lastAccessed: Date.now(),
      hasContent: true
    };
    
    this.meta.set(key, metaEntry);
    
    // Memory cache with LRU
    this.contentCache.set(key, {
      data: content,
      lastAccessed: Date.now()
    });
    this.currentSize += content.length;
    
    if (this.currentSize > this.maxSize) {
      this._evictLRU();
    }
    
    // Disk cache
    const cachePath = this._getFileCachePath(key);
    await writeFile(cachePath, content);
    
    await this._saveMeta();
  }

  async invalidate(fullPath, workingDir) {
    await this.init();
    
    const key = this._getCacheKey(fullPath, workingDir);
    this.meta.delete(key);
    this.contentCache.delete(key);
    
    const cachePath = this._getFileCachePath(key);
    if (existsSync(cachePath)) {
      const { unlink } = await import('fs/promises');
      await unlink(cachePath).catch(() => {});
    }
    
    await this._saveMeta();
  }

  // Directory listing cache
  async getList(fullPath, workingDir) {
    await this.init();
    
    const key = `__list__:${this._getCacheKey(fullPath, workingDir)}`;
    const cached = this.meta.get(key);
    
    if (!cached) {return null;}
    
    try {
      const stats = await stat(fullPath);
      
      // Check if directory mtime changed
      if (Math.abs(stats.mtimeMs - cached.mtimeMs) < 100) {
        const cachePath = this._getFileCachePath(key);
        if (existsSync(cachePath)) {
          const content = await readFile(cachePath, 'utf-8');
          return JSON.parse(content);
        }
      }
    } catch {
      // Fall through
    }
    
    return null;
  }

  async setList(fullPath, workingDir, entries) {
    await this.init();
    
    const key = `__list__:${this._getCacheKey(fullPath, workingDir)}`;
    
    try {
      const stats = await stat(fullPath);
      
      this.meta.set(key, {
        mtimeMs: stats.mtimeMs,
        size: 0,
        hash: '',
        lastAccessed: Date.now(),
        hasContent: true
      });
      
      const cachePath = this._getFileCachePath(key);
      await writeFile(cachePath, JSON.stringify(entries));
      
      await this._saveMeta();
    } catch {
      // Ignore errors
    }
  }

  async clear() {
    await this.init();
    this.meta.clear();
    this.contentCache.clear();
    this.currentSize = 0;
    
    const { rm } = await import('fs/promises');
    await rm(this.cacheDir, { recursive: true, force: true });
    await this._ensureCacheDir();
  }
}

// Singleton instance
let globalCache = null;

export function getFileCache() {
  if (!globalCache) {
    globalCache = new FileCache();
  }
  return globalCache;
}
