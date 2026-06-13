/**
 * Task Classifier — 任务分类与风险评估
 *
 * 将用户输入分类到不同的任务类型，推断迭代预算与语义风险域。
 * 原为 ReActAgent 内联的 #classifyTask / #inferSemanticRiskDomains 等方法。
 */

import {
  quickAssess,
  deepAssess,
  mergeIntentProfile,
  computeIterationBudget,
  getCompletionGates,
} from './risk-budget.js';
import {
  SEMANTIC_RISK_DOMAINS,
  MAX_ITERATIONS_DEFAULT,
} from './agent-constants.js';

export class TaskClassifier {
  #config;

  constructor(config = {}) {
    this.#config = {
      maxIterations: config.maxIterations || MAX_ITERATIONS_DEFAULT,
    };
  }

  /**
   * 分类用户输入为一个任务 profile。
   * 接受可选的 LLM 意图识别结果，用于覆盖或增强硬编码判断。
   */
  classify(userInput, intent = null) {
    const risk = intent
      ? mergeIntentProfile(quickAssess(userInput), intent, userInput)
      : quickAssess(userInput);

    return {
      isCodingTask: risk.isCodingTask,
      isModificationTask: risk.isModificationTask,
      isBugTask: risk.isBugTask,
      isLikelyTrivial: risk.isLikelyTrivial,
      requiresAutomaticPlanning: risk.isModificationTask,
      requiresSemanticRiskReview:
        risk.semanticDomains.length > 0 && risk.isModificationTask,
      semanticRiskDomains: risk.semanticDomains,
      riskLevel: risk.riskLevel,
      riskScore: risk.score,
      riskReasons: risk.reasons,
      input: String(userInput || ''),
    };
  }

  /** 基于任务 profile 计算自适应迭代预算 */
  budgetFor(profile) {
    if (!profile || profile.isLikelyTrivial) return Math.min(8, this.#config.maxIterations);
    if (profile.isBugTask) return Math.min(40, this.#config.maxIterations);
    if (profile.isModificationTask) return Math.min(25, this.#config.maxIterations);
    return this.#config.maxIterations;
  }

  /** 从用户输入推断语义风险域（用于 completion gate） */
  inferSemanticRiskDomains(userInput) {
    const text = String(userInput || '');
    return SEMANTIC_RISK_DOMAINS.filter(domain => domain.pattern.test(text)).map(
      ({ id, label, checklist }) => ({ id, label, checklist })
    );
  }

  /** 深度评估（较慢，对高风险任务启用） */
  deep(userInput) {
    return deepAssess(userInput);
  }

  /** completion gates — 对编码完成的后门策略 */
  completionGates(profile) {
    if (!profile?.isModificationTask) return [];
    return getCompletionGates?.() ?? [];
  }

  /** 用于计划任务的迭代预算（与 risk-budget 对齐） */
  iterationBudget(profile) {
    return computeIterationBudget
      ? computeIterationBudget({
          isCodingTask: profile?.isCodingTask,
          isModificationTask: profile?.isModificationTask,
          isBugTask: profile?.isBugTask,
          riskScore: profile?.riskScore ?? 0,
        })
      : this.budgetFor(profile);
  }
}

export default TaskClassifier;
