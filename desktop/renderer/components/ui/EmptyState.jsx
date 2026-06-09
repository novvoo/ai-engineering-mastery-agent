/**
 * EmptyState — 空状态占位组件
 */
import React from 'react';

export default function EmptyState({
  icon = '📭',
  title = '暂无数据',
  description,
  action,
  style,
}) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--spacing-xl) var(--spacing-lg)',
        textAlign: 'center',
        color: 'var(--text-dark)',
        ...style,
      }}
    >
      <span style={{ fontSize: '32px', marginBottom: 'var(--spacing-md)', lineHeight: 1 }}>{icon}</span>
      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>{title}</div>
      {description && <div style={{ fontSize: '12px', lineHeight: 1.5, maxWidth: '280px' }}>{description}</div>}
      {action && <div style={{ marginTop: 'var(--spacing-md)' }}>{action}</div>}
    </div>
  );
}
