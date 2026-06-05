/**
 * 消息日志组件
 * 显示 Agent 执行过程中的消息和结果
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';

// 样式定义
const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
    borderRadius: '8px'
  },
  
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #0f3460'
  },
  
  title: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#e94560'
  },
  
  headerButtons: {
    display: 'flex',
    gap: '8px'
  },
  
  button: {
    padding: '4px 12px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#0f3460',
    color: '#eaeaea',
    cursor: 'pointer',
    fontSize: '12px'
  },
  
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px'
  },
  
  messageItem: {
    marginBottom: '12px',
    borderRadius: '6px',
    padding: '12px',
    backgroundColor: '#16213e'
  },
  
  messageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  
  messageType: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '500'
  },
  
  typeInfo: {
    backgroundColor: '#17a2b8',
    color: '#ffffff'
  },
  
  typeSuccess: {
    backgroundColor: '#28a745',
    color: '#ffffff'
  },
  
  typeError: {
    backgroundColor: '#dc3545',
    color: '#ffffff'
  },
  
  typeWarning: {
    backgroundColor: '#ffc107',
    color: '#000000'
  },
  
  typeDebug: {
    backgroundColor: '#6c757d',
    color: '#ffffff'
  },
  
  typeTool: {
    backgroundColor: '#e94560',
    color: '#ffffff'
  },
  
  typeResult: {
    backgroundColor: '#007bff',
    color: '#ffffff'
  },
  
  messageTime: {
    fontSize: '11px',
    color: '#888888'
  },
  
  messageContent: {
    fontSize: '13px',
    color: '#eaeaea',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  
  messageMeta: {
    marginTop: '8px',
    fontSize: '11px',
    color: '#888888',
    display: 'flex',
    gap: '12px'
  },
  
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: '#888888',
    textAlign: 'center'
  },
  
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px'
  },
  
  emptyText: {
    fontSize: '16px',
    marginBottom: '8px'
  },
  
  emptyHint: {
    fontSize: '12px',
    color: '#666666'
  },
  
  runningIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: '#16213e',
    borderRadius: '6px',
    marginBottom: '12px'
  },
  
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid #0f3460',
    borderTopColor: '#e94560',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  
  runningText: {
    fontSize: '13px',
    color: '#ffc107'
  }
};

/**
 * 消息日志组件
 * @param {Object} props - 组件属性
 * @param {Array} props.messages - 消息列表
 * @param {string} props.status - 当前状态
 * @param {Function} props.onClear - 清空消息回调
 */
function MessageLog({ messages, status, onClear }) {
  // 状态
  const [filter, setFilter] = useState('all');
  const [autoScroll, setAutoScroll] = useState(true);
  
  // 引用
  const listRef = useRef(null);
  
  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);
  
  // 过滤消息
  const filteredMessages = React.useMemo(() => {
    if (filter === 'all') {
      return messages;
    }
    return messages.filter(msg => msg.type === filter);
  }, [messages, filter]);
  
  // 处理过滤变更
  const handleFilterChange = useCallback((newFilter) => {
    setFilter(newFilter);
  }, []);
  
  // 处理自动滚动变更
  const handleAutoScrollChange = useCallback(() => {
    setAutoScroll(!autoScroll);
  }, [autoScroll]);
  
  // 处理清空
  const handleClear = useCallback(() => {
    if (onClear) {
      onClear();
    }
  }, [onClear]);
  
  // 获取消息类型样式
  const getTypeStyle = (type) => {
    switch (type) {
      case 'info':
        return { ...styles.messageType, ...styles.typeInfo };
      case 'success':
        return { ...styles.messageType, ...styles.typeSuccess };
      case 'error':
        return { ...styles.messageType, ...styles.typeError };
      case 'warning':
        return { ...styles.messageType, ...styles.typeWarning };
      case 'debug':
        return { ...styles.messageType, ...styles.typeDebug };
      case 'tool':
        return { ...styles.messageType, ...styles.typeTool };
      case 'result':
        return { ...styles.messageType, ...styles.typeResult };
      default:
        return styles.messageType;
    }
  };
  
  // 获取消息类型文本
  const getTypeText = (type) => {
    switch (type) {
      case 'info':
        return 'ℹ️ 信息';
      case 'success':
        return '✅ 成功';
      case 'error':
        return '❌ 错误';
      case 'warning':
        return '⚠️ 警告';
      case 'debug':
        return '🔍 调试';
      case 'tool':
        return '🔧 工具';
      case 'result':
        return '📊 结果';
      default:
        return '📄 消息';
    }
  };
  
  // 渲染消息项
  const renderMessage = (msg, index) => {
    return (
      <div key={index} style={styles.messageItem}>
        <div style={styles.messageHeader}>
          <span style={getTypeStyle(msg.type)}>
            {getTypeText(msg.type)}
          </span>
          <span style={styles.messageTime}>
            {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''}
          </span>
        </div>
        
        <div style={styles.messageContent}>
          {msg.content || msg.message || ''}
        </div>
        
        {/* 元数据 */}
        {msg.toolName && (
          <div style={styles.messageMeta}>
            <span>工具: {msg.toolName}</span>
            {msg.duration && <span>耗时: {msg.duration}ms</span>}
          </div>
        )}
      </div>
    );
  };
  
  // 渲染运行指示器
  const renderRunningIndicator = () => {
    if (status !== 'running') return null;
    
    return (
      <div style={styles.runningIndicator}>
        <div style={styles.spinner}></div>
        <span style={styles.runningText}>
          Agent 正在执行...
        </span>
      </div>
    );
  };
  
  // 渲染空状态
  if (messages.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyContainer}>
          <div style={styles.emptyIcon}>💬</div>
          <div style={styles.emptyText}>暂无消息</div>
          <div style={styles.emptyHint}>
            输入任务并点击执行按钮开始
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div style={styles.container}>
      {/* 头部 */}
      <div style={styles.header}>
        <div style={styles.title}>
          📋 消息日志 ({filteredMessages.length}/{messages.length})
        </div>
        
        <div style={styles.headerButtons}>
          {/* 过滤按钮 */}
          <select
            style={{
              ...styles.button,
              padding: '4px 8px',
              cursor: 'pointer'
            }}
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value)}
          >
            <option value="all">全部</option>
            <option value="info">信息</option>
            <option value="success">成功</option>
            <option value="error">错误</option>
            <option value="tool">工具</option>
            <option value="result">结果</option>
          </select>
          
          {/* 自动滚动按钮 */}
          <button
            style={{
              ...styles.button,
              backgroundColor: autoScroll ? '#e94560' : '#0f3460'
            }}
            onClick={handleAutoScrollChange}
            title={autoScroll ? '停止自动滚动' : '启用自动滚动'}
          >
            {autoScroll ? '📍 自动' : '📌 手动'}
          </button>
          
          {/* 清空按钮 */}
          <button
            style={styles.button}
            onClick={handleClear}
            title="清空消息"
          >
            🗑️ 清空
          </button>
        </div>
      </div>
      
      {/* 消息列表 */}
      <div ref={listRef} style={styles.messageList}>
        {/* 运行指示器 */}
        {renderRunningIndicator()}
        
        {/* 消息项 */}
        {filteredMessages.map((msg, index) => renderMessage(msg, index))}
        
        {filteredMessages.length === 0 && (
          <div style={styles.emptyContainer}>
            <div style={styles.emptyText}>没有匹配的消息</div>
          </div>
        )}
      </div>
      
      {/* CSS 动画 */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}

export default MessageLog;