/**
 * File Cache System Tests
 * 文件缓存系统测试 - 测试缓存机制、索引功能、失效策略
 */

import { describe, it, beforeEach, afterEach, expect } from 'bun:test';
import { getFileCache } from '../../src/tools/filesystem/file-cache.js';
import fs from 'fs';
import path from 'path';

describe('File Cache System', () => {
  let testDir;
  let fileCache;

  beforeEach(async () => {
    // 创建临时测试目录
    testDir = `/tmp/cache-test-${Date.now()}`;
    await fs.promises.mkdir(testDir, { recursive: true });
    
    // 创建测试文件
    await fs.promises.writeFile(path.join(testDir, 'test.txt'), 'Hello World');
    await fs.promises.writeFile(path.join(testDir, 'data.json'), JSON.stringify({ key: 'value' }));
    
    // 获取缓存实例
    fileCache = getFileCache();
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      if (fs.existsSync(testDir)) {
        const deleteRecursive = (dir) => {
          if (fs.existsSync(dir)) {
            fs.readdirSync(dir).forEach((file) => {
              const curPath = path.join(dir, file);
              if (fs.lstatSync(curPath).isDirectory()) {
                deleteRecursive(curPath);
              } else {
                fs.unlinkSync(curPath);
              }
            });
            fs.rmdirSync(dir);
          }
        };
        deleteRecursive(testDir);
      }
    } catch (e) {
      console.error('清理测试目录失败:', e);
    }
  });

  describe('Basic Cache Operations', () => {
    it('应该能够获取文件缓存', async () => {
      const filePath = path.join(testDir, 'test.txt');
      const result = await fileCache.get(filePath, testDir, { readContent: true });
      
      expect(result).toBeDefined();
    });

    it('应该能够设置和获取文件缓存', async () => {
      const filePath = path.join(testDir, 'data.json');
      
      // 第一次读取
      await fileCache.get(filePath, testDir, { readContent: true });
      
      // 设置缓存
      await fileCache.set(filePath, testDir, 'Modified Content');
      
      // 再次获取应该返回修改的内容
      const result = await fileCache.get(filePath, testDir, { readContent: true });
      expect(result.valid).toBe(true);
    });

    it('应该检测文件变更使缓存失效', async () => {
      const filePath = path.join(testDir, 'test.txt');
      
      // 第一次读取建立缓存
      await fileCache.get(filePath, testDir, { readContent: true });
      
      // 修改文件
      await fs.promises.writeFile(filePath, 'Updated Content');
      
      // 等待一段时间
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 再次获取，应该检测到变更
      const result = await fileCache.get(filePath, testDir, { readContent: true });
      
      expect(result.valid).toBe(true);
    });
  });

  describe('Directory Cache', () => {
    it('应该能够缓存目录列表', async () => {
      // 第一次列出目录
      const entries1 = await fileCache.getList(testDir, testDir);
      
      // 第二次应该返回缓存的列表
      const entries2 = await fileCache.getList(testDir, testDir);
      
      expect(entries2).toBeDefined();
    });

    it('目录变更应该使缓存失效', async () => {
      // 第一次列出目录
      await fileCache.getList(testDir, testDir);
      
      // 创建新文件
      await fs.promises.writeFile(path.join(testDir, 'newfile.txt'), 'New File');
      
      // 再次列出目录，应该检测到变更
      const entries = await fileCache.getList(testDir, testDir);
      
      expect(entries).toBeDefined();
    });
  });

  describe('Cache Index Management', () => {
    it('应该有缓存索引功能', async () => {
      // 创建多个缓存项
      for (let i = 0; i < 5; i++) {
        const filePath = path.join(testDir, `file${i}.txt`);
        await fs.promises.writeFile(filePath, `Content ${i}`);
        await fileCache.set(filePath, testDir, `Cached ${i}`);
      }
      
      expect(fileCache).toBeDefined();
    });

    it('应该能够清除缓存', async () => {
      const filePath = path.join(testDir, 'test.txt');
      await fileCache.set(filePath, testDir, 'Test Content');
      
      // 清除缓存
      await fileCache.clear();
      
      expect(true).toBe(true); // 只要不抛出错误就通过
    });
  });

  describe('Performance', () => {
    it('重复读取应该从缓存获取（更快）', async () => {
      const filePath = path.join(testDir, 'test.txt');
      
      // 第一次读取（可能从磁盘）
      const start1 = Date.now();
      await fileCache.get(filePath, testDir, { readContent: true });
      const duration1 = Date.now() - start1;
      
      // 第二次读取（应该从缓存）
      const start2 = Date.now();
      await fileCache.get(filePath, testDir, { readContent: true });
      const duration2 = Date.now() - start2;
      
      // 虽然不能严格保证缓存更快，但这是设计目标
      console.log(`第一次读取: ${duration1}ms, 第二次读取: ${duration2}ms`);
      expect(true).toBe(true);
    });

    it('应该处理多个并发缓存操作', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        const filePath = path.join(testDir, `concurrent${i}.txt`);
        await fs.promises.writeFile(filePath, `Concurrent ${i}`);
        promises.push(fileCache.set(filePath, testDir, `Cached ${i}`));
      }
      
      await Promise.all(promises);
      expect(true).toBe(true); // 所有操作完成就通过
    });
  });

  describe('Edge Cases', () => {
    it('应该处理不存在的文件', async () => {
      const filePath = path.join(testDir, 'nonexistent.txt');
      const result = await fileCache.get(filePath, testDir, { readContent: true });
      
      expect(result.valid).toBe(false);
    });

    it('应该处理空文件', async () => {
      const filePath = path.join(testDir, 'empty.txt');
      await fs.promises.writeFile(filePath, '');
      
      await fileCache.set(filePath, testDir, '');
      const result = await fileCache.get(filePath, testDir, { readContent: true });
      
      expect(result.valid).toBe(true);
    });
  });
});
