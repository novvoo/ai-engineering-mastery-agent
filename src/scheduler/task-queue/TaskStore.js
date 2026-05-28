/**
 * TaskStore.js
 * 任务持久化存储实现
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';

/**
 * 任务存储类
 * 负责将任务数据持久化到JSON文件
 */
export class TaskStore {
  /**
   * 创建存储实例
   * @param {string} filePath - 存储文件路径
   */
  constructor(filePath) {
    this.filePath = filePath;
  }

  /**
   * 加载任务数据
   * @returns {Promise<Array>} 任务对象数组
   */
  async load() {
    try {
      // 检查文件是否存在
      if (!existsSync(this.filePath)) {
        return [];
      }

      // 读取文件内容
      const data = await readFile(this.filePath, 'utf-8');

      // 解析JSON
      const tasks = JSON.parse(data);

      // 确保返回数组
      if (!Array.isArray(tasks)) {
        return [];
      }

      return tasks;
    } catch (error) {
      // 如果读取或解析失败，返回空数组
      console.error('Failed to load tasks from store:', error.message);
      return [];
    }
  }

  /**
   * 保存任务数据
   * @param {Array} tasks - 任务对象数组
   * @returns {Promise<void>}
   */
  async save(tasks) {
    try {
      // 确保目录存在
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      // 序列化为JSON（格式化输出，便于调试）
      const data = JSON.stringify(tasks, null, 2);

      // 写入文件
      await writeFile(this.filePath, data, 'utf-8');
    } catch (error) {
      console.error('Failed to save tasks to store:', error.message);
      throw error;
    }
  }
}

export default TaskStore;
