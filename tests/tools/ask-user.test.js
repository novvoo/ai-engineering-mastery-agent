import { describe, expect, test } from 'bun:test';
import createAskUserTool from '../../src/tools/skills/ask_user.js';

describe('ask_user skill', () => {
  test('should return a structured user input request', async () => {
    const tool = createAskUserTool();
    const result = await tool.handler({
      reason: '缺少业务约束，无法安全选择实现方案。',
      questions: ['优先保证速度还是可维护性？', '上线时间是什么时候？'],
      blocking_facts: ['业务优先级', '上线时间'],
      suggestions: ['速度优先', '可维护性优先'],
    });

    expect(result.type).toBe('user_input_required');
    expect(result.status).toBe('needs_user_input');
    expect(result.requiresUserInput).toBe(true);
    expect(result.questions).toHaveLength(2);
    expect(result.blockingFacts).toContain('业务优先级');
    expect(result.answer).toContain('需要你补充一点信息');
    expect(result.answer).toContain('优先保证速度还是可维护性？');
  });

  test('should cap questions at three', async () => {
    const tool = createAskUserTool();
    const result = await tool.handler({
      reason: '需要收敛范围。',
      questions: ['A?', 'B?', 'C?', 'D?'],
    });

    expect(result.questions).toHaveLength(3);
    expect(result.answer).not.toContain('4. D?');
  });
});
