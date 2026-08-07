import { useEffect, useMemo, useState } from 'react';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'aborted']);

function isTerminal(s) {
  return TERMINAL_STATUSES.has(s?.status);
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '';
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m${String(s).padStart(2, '0')}s`;
}

function dotBackground(status) {
  if (status === 'failed' || status === 'aborted') return 'var(--ds-status-error)';
  if (isTerminal({ status })) return 'var(--ds-status-success)';
  return 'var(--ds-brand)';
}

function formatCurrentTool(s) {
  const tool = s.currentTool || s.progress?.currentTool;
  if (!tool) return isTerminal(s) ? `exit ${s.exitCode ?? 0}` : 'starting…';
  return tool;
}

const styles = {
  section: {
    marginTop: '6px',
    marginBottom: '6px',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    overflow: 'hidden',
    maxWidth: '88%',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 10px',
    fontSize: '11px',
    color: 'var(--ds-text-secondary)',
    borderBottom: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--bg-overlay-l1)',
  },
  headerPulse: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
    background: 'var(--ds-brand)',
    animation: 'pulse 1.4s ease-in-out infinite',
  },
  headerPulseIdle: {
    background: 'var(--ds-status-success)',
    animation: 'none',
    opacity: 0.7,
  },
  headerTitle: {
    fontWeight: 600,
  },
  headerCount: {
    color: 'var(--ds-brand)',
    fontWeight: 700,
  },
  headerMeta: {
    marginLeft: 'auto',
    color: 'var(--ds-text-tertiary)',
    fontSize: '10px',
    fontVariantNumeric: 'tabular-nums',
    fontFamily: 'var(--font-mono)',
  },

  // 第一段：job 树
  jobTree: {
    padding: '6px 10px',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    lineHeight: '22px',
  },
  jobRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: 'var(--ds-text-primary)',
  },
  jobRowTerminal: {
    color: 'var(--ds-text-tertiary)',
  },
  jobBranch: {
    color: 'var(--ds-text-tertiary)',
    width: '18px',
    flexShrink: 0,
  },
  jobSpinner: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
    border: '2px solid var(--ds-border-l2)',
    borderTopColor: 'var(--ds-brand)',
    backgroundColor: 'transparent',
    animation: 'spin 1s linear infinite',
  },
  jobDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
    border: 'none',
    animation: 'none',
  },
  jobTag: {
    fontSize: '10px',
    padding: '1px 5px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--ds-brand-soft)',
    color: 'var(--ds-brand)',
    fontWeight: 600,
    letterSpacing: '0.02em',
    fontFamily: 'var(--font-sans)',
  },
  jobName: {
    fontWeight: 600,
    color: 'var(--ds-text-primary)',
  },
  jobNameTerminal: {
    color: 'var(--ds-text-tertiary)',
  },
  jobNameFailed: {
    color: 'var(--ds-status-error)',
  },
  jobDuration: {
    marginLeft: 'auto',
    color: 'var(--ds-text-tertiary)',
    fontVariantNumeric: 'tabular-nums',
    fontSize: '11px',
  },

  // 第二段：subagent 详情
  subSection: {
    borderTop: '1px solid var(--border-subtle)',
  },
  subSectionTitle: {
    padding: '4px 10px',
    fontSize: '10px',
    color: 'var(--ds-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontWeight: 700,
    backgroundColor: 'var(--bg-overlay-l1)',
  },
  subList: {
    padding: '4px 10px 6px',
  },
  subRow: {
    display: 'grid',
    gridTemplateColumns: '8px 1fr auto',
    gap: '10px',
    alignItems: 'center',
    padding: '6px 0',
  },
  subRowDivider: {
    borderTop: '1px solid var(--border-subtle)',
  },
  subDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    animation: 'pulse 1.4s ease-in-out infinite',
  },
  subDotTerminal: {
    animation: 'none',
  },
  subName: {
    fontWeight: 600,
    fontSize: '12px',
    color: 'var(--ds-text-primary)',
  },
  subNameFailed: {
    color: 'var(--ds-status-error)',
  },
  subDesc: {
    color: 'var(--ds-text-tertiary)',
    fontSize: '11px',
    lineHeight: '16px',
    marginTop: '2px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  subMeta: {
    textAlign: 'right',
    fontSize: '10px',
    color: 'var(--ds-text-tertiary)',
    fontFamily: 'var(--font-mono)',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  subToolTag: {
    display: 'block',
    color: 'var(--ds-brand)',
    marginBottom: '2px',
    fontWeight: 600,
  },
};

/**
 * SubagentStatusPanel —— 在活跃 turn 末尾渲染 subagent 批次进度。
 *
 * 数据来源：useRuntime 订阅 `subagent:update` 事件后维护的 subagents Map。
 * 不订阅任何 IPC 事件，纯受控组件。
 *
 * Props:
 *   subagents    Record<string, SubagentState>  由 useRuntime 维护
 *   onJumpToToolCall?  (toolCallId: string) => void  可选，点击行跳到对应工具卡片
 */
export default function SubagentStatusPanel({ subagents, onJumpToToolCall }) {
  // 本地 tick：仅在有 running 项时每秒 force update，刷新计时
  const [, setTick] = useState(0);
  useEffect(() => {
    const list = Object.values(subagents || {});
    if (!list.some((s) => !isTerminal(s))) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [subagents]);

  const list = useMemo(() => {
    return Object.values(subagents || {})
      .sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));
  }, [subagents]);

  if (list.length === 0) return null;

  const runningCount = list.filter((s) => !isTerminal(s)).length;
  const doneCount = list.filter((s) => isTerminal(s) && s.status !== 'failed' && s.status !== 'aborted').length;
  const failedCount = list.filter((s) => s.status === 'failed' || s.status === 'aborted').length;
  const totalTokens = list.reduce((sum, s) => sum + (s.tokens || s.progress?.tokens || 0), 0);
  const totalCost = list.reduce((sum, s) => sum + (s.cost || s.progress?.cost || 0), 0);
  const now = Date.now();

  const metaParts = [];
  if (doneCount > 0) metaParts.push(`${doneCount} done`);
  if (failedCount > 0) metaParts.push(`${failedCount} failed`);
  if (metaParts.length === 0) {
    metaParts.push(`${list.length} total`);
    if (totalTokens > 0) metaParts.push(`${(totalTokens / 1000).toFixed(1)}k tokens`);
    if (totalCost > 0) metaParts.push(`$${totalCost.toFixed(2)}`);
  }

  return (
    <div style={styles.section}>
      <div style={styles.header}>
        <span style={{ ...styles.headerPulse, ...(runningCount === 0 ? styles.headerPulseIdle : {}) }} />
        <span style={styles.headerTitle}>
          {runningCount > 0
            ? <>waiting on <span style={styles.headerCount}>{runningCount}</span> jobs</>
            : <>subagents done</>}
        </span>
        <span style={styles.headerMeta}>{metaParts.join(' · ')}</span>
      </div>

      {/* 第一段：job 树 */}
      <div style={styles.jobTree}>
        {list.map((s, idx) => {
          const isLast = idx === list.length - 1;
          const terminal = isTerminal(s);
          const failed = s.status === 'failed' || s.status === 'aborted';
          const durationMs = terminal
            ? (s.endedAt || 0) - (s.startedAt || 0)
            : now - (s.startedAt || now);
          const bg = dotBackground(s.status);

          const nameStyle = {
            ...styles.jobName,
            ...(failed ? styles.jobNameFailed : terminal ? styles.jobNameTerminal : {}),
          };

          return (
            <div key={s.id || idx} style={{ ...styles.jobRow, ...(terminal ? styles.jobRowTerminal : {}) }}>
              <span style={styles.jobBranch}>{isLast ? '└─' : '├─'}</span>
              <span style={terminal ? { ...styles.jobDot, background: bg } : styles.jobSpinner} />
              <span style={styles.jobTag}>task</span>
              <span
                style={nameStyle}
                onClick={s.parentToolCallId ? () => onJumpToToolCall?.(s.parentToolCallId) : undefined}
                role={s.parentToolCallId ? 'button' : undefined}
              >
                {s.id || s.agent || 'subagent'}
              </span>
              <span style={styles.jobDuration}>{formatDuration(durationMs)}</span>
            </div>
          );
        })}
      </div>

      {/* 第二段：subagent 详情 */}
      <div style={styles.subSection}>
        <div style={styles.subSectionTitle}>Subagents</div>
        <div style={styles.subList}>
          {list.map((s, idx) => {
            const terminal = isTerminal(s);
            const failed = s.status === 'failed' || s.status === 'aborted';
            const durationMs = terminal
              ? (s.endedAt || 0) - (s.startedAt || 0)
              : now - (s.startedAt || now);
            const tokens = s.tokens || s.progress?.tokens || 0;
            const toolCount = s.toolCount || s.progress?.toolCount || 0;
            const currentTool = formatCurrentTool(s);

            const nameStyle = failed ? { ...styles.subName, ...styles.subNameFailed } : styles.subName;
            const dotStyle = {
              ...styles.subDot,
              background: dotBackground(s.status),
              ...(terminal ? styles.subDotTerminal : {}),
            };

            return (
              <div key={s.id || idx} style={{ ...styles.subRow, ...(idx > 0 ? styles.subRowDivider : {}) }}>
                <span style={dotStyle} />
                <div style={{ minWidth: 0 }}>
                  <div style={nameStyle}>{s.id || s.agent || 'subagent'}</div>
                  {s.description ? <div style={styles.subDesc} title={s.description}>{s.description}</div> : null}
                </div>
                <div style={styles.subMeta}>
                  <span style={styles.subToolTag}>{currentTool}</span>
                  <span>
                    {formatDuration(durationMs)}
                    {toolCount > 0 ? ` · ${toolCount} tools` : ''}
                    {tokens > 0 ? ` · ${(tokens / 1000).toFixed(1)}k` : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
