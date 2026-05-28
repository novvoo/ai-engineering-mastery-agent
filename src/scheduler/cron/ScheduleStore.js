/**
 * ScheduleStore.js
 * 调度计划持久化存储实现
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';

/**
 * 调度计划存储类
 * 负责将调度计划数据持久化到JSON文件
 */
export class ScheduleStore {
  /**
   * 创建存储实例
   * @param {string} filePath - 存储文件路径
   */
  constructor(filePath) {
    this.filePath = filePath;
  }

  /**
   * 加载调度计划数据
   * @returns {Promise<Array>} 调度计划对象数组
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
      const schedules = JSON.parse(data);

      // 确保返回数组
      if (!Array.isArray(schedules)) {
        return [];
      }

      return schedules;
    } catch (error) {
      // 如果读取或解析失败，返回空数组
      console.error('Failed to load schedules from store:', error.message);
      return [];
    }
  }

  /**
   * 保存调度计划数据
   * @param {Array} schedules - 调度计划对象数组
   * @returns {Promise<void>}
   */
  async save(schedules) {
    try {
      // 确保目录存在
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      // 序列化为JSON（格式化输出，便于调试）
      const data = JSON.stringify(schedules, null, 2);

      // 写入文件
      await writeFile(this.filePath, data, 'utf-8');
    } catch (error) {
      console.error('Failed to save schedules to store:', error.message);
      throw error;
    }
  }
}

export default ScheduleStore;
