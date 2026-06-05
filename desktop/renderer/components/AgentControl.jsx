/**
 * Agent 控制面板组件
 * 提供 Agent 的输入、执行控制等功能
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';

// 样式定义
const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  
  section: {
    padding: '12px',
    borderBottom: '1px solid #0f3460'
  },
  
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#e94560',
    marginBottom: '8px'
  },
  
  inputContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  
  textarea: {
    width: '100%',
    minHeight: '120px',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #0f3460',
    backgroundColor: '#1a1a2e',
    color: '#eaeaea',
    fontSize: '14px',
    resize: 'vertical',
    fontFamily: 'inherit'
  },
  
  buttonGroup: {
    display: 'flex',
    gap: '8px'
  },
  
  button: {
    flex: 1,
    padding: '10px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#0f3460',
    color: '#eaeaea',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s'
  },
  
  primaryButton: {
    backgroundColor: '#e94560',
    color: '#ffffff'
  },
  
  disabledButton: {
    backgroundColor: '#0f3460',
    color: '#666666',
    cursor: 'not-allowed'
  },
  
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500',
    marginBottom: '8px'
  },
  
  statusRunning: {
    backgroundColor: '#ffc107',
    color: '#000000'
  },
  
  statusIdle: {
    backgroundColor: '#28a745',
    color: '#ffffff'
  },
  
  statusError: {
    backgroundColor: '#dc3545',
    color: '#ffffff'
  },
  
  statusCompleted: {
    backgroundColor: '#17a2b8',
    color: '#ffffff'
  },
  
  workingDirectory: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    borderRadius: '4px',
    backgroundColor: '#1a1a2e',
    marginBottom: '8px'
  },
  
  directoryText: {
    flex: 1,
    fontSize: '12px',
    color: '#eaeaea',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  
  changeButton: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#0f3460',
    color: '#eaeaea',
    cursor: 'pointer',
    fontSize: '11px'
  },
  
  historyList: {
    maxHeight: '200px',
    overflowY: 'auto'
  },
  
  historyItem: {
    padding: '8px',
    borderRadius: '4px',
    backgroundColor: '#1a1a2e',
    marginBottom: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#eaeaea',
    transition: 'background-color 0.2s'
  },
  
  optionsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  
  checkbox: {
    width: '16px',
    height: '16px',
    cursor: 'pointer'
  },
  
  label: {
    fontSize: '13px',
    color: '#eaeaea'
  }
};

/**
 * Agent 控制面板组件
 * @param {Object} props - 组件属性
 * @param {Object} props.runtime - Runtime Hook 返回的对象
 * @param {string} props.workingDirectory - 当前工作目录
 * @param {Function} props.onWorkingDirectoryChange - 工作目录变更回调
 */
function AgentControl({ runtime, workingDirectory, onWorkingDirectoryChange }) {
  // 状态
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [options, setOptions] = useState({
    debug: false,
    maxIterations: 180,
    autoSave: true
  });
  
  // 引用
  const textareaRef = useRef(null);
  
  // 加载历史记录
  useEffect(() => {
    // 从 localStorage 加载历史记录
    try {
      const savedHistory = localStorage.getItem('agentHistory');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.error('[AgentControl] 加载历史记录失败:', error);
    }
  }, []);
  
  // 处理输入变更
  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
  }, []);
  
  // 处理执行
  const handleExecute = useCallback(async () => {
    if (!input.trim()) {
      return;
    }
    
    // 保存到历史记录
    const newHistory = [
      { input: input.trim(), timestamp: Date.now() },
      ...history.slice(0, 9) // 最多保存 10 条
    ];
    setHistory(newHistory);
    
    try {
      localStorage.setItem('agentHistory', JSON.stringify(newHistory));
    } catch (error) {
      console.error('[AgentControl] 保存历史记录失败:', error);
    }
    
    // 执行
    try {
      await runtime.processInput(input.trim(), options);
      setInput('');
    } catch (error) {
      console.error('[AgentControl] 执行失败:', error);
    }
  }, [input, history, runtime, options]);
  
  // 处理停止
  const handleStop = useCallback(async () => {
    try {
      await runtime.stop();
    } catch (error) {
      console.error('[AgentControl] 停止失败:', error);
    }
  }, [runtime]);
  
  // 处理历史记录点击
  const handleHistoryClick = useCallback((item) => {
    setInput(item.input);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);
  
  // 处理选项变更
  const handleOptionChange = useCallback((key, value) => {
    setOptions(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);
  
  // 获取状态样式
  const getStatusStyle = () => {
    switch (runtime.status) {
      case 'running':
        return { ...styles.statusBadge, ...styles.statusRunning };
      case 'idle':
        return { ...styles.statusBadge, ...styles.statusIdle };
      case 'error':
        return { ...styles.statusBadge, ...styles.statusError };
      case 'completed':
        return { ...styles.statusBadge, ...styles.statusCompleted };
      default:
        return styles.statusBadge;
    }
  };
  
  // 获取状态文本
  const getStatusText = () => {
    switch (runtime.status) {
      case 'running':
        return '🔄 运行中';
      case 'idle':
        return '✅ 就绪';
      case 'error':
        return '❌ 错误';
      case 'completed':
        return '✨ 完成';
      default:
        return '⚪ 未知';
    }
  };
  
  // 是否可以执行
  const canExecute = input.trim().length > 0 && runtime.status !== 'running';
  
  // 是否可以停止
  const canStop = runtime.status === 'running';
  
  return (
    <div style={styles.container}>
      {/* 状态显示 */}
      <div style={styles.section}>
        <div style={getStatusStyle()}>
          {getStatusText()}
        </div>
        
        {/* 工作目录 */}
        <div style={styles.workingDirectory}>
          <span style={styles.directoryText}>
            📁 {workingDirectory || '未设置'}
          </span>
          <button
            style={styles.changeButton}
            onClick={onWorkingDirectoryChange}
            title="更改工作目录"
          >
            更改
          </button>
        </div>
      </div>
      
      {/* 输入区域 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          📝 输入任务
        </div>
        
        <div style={styles.inputContainer}>
          <textarea
            ref={textareaRef}
            style={styles.textarea}
            value={input}
            onChange={handleInputChange}
            placeholder="输入您的任务描述..."
            disabled={runtime.status === 'running'}
          />
          
          <div style={styles.buttonGroup}>
            <button
              style={{
                ...styles.button,
                ...(canExecute ? styles.primaryButton : styles.disabledButton)
              }}
              onClick={handleExecute}
              disabled={!canExecute}
            >
              {runtime.status === 'running' ? '执行中...' : '▶️ 执行'}
            </button>
            
            <button
              style={{
                ...styles.button,
                ...(canStop ? {} : styles.disabledButton)
              }}
              onClick={handleStop}
              disabled={!canStop}
            >
              ⏹️ 停止
            </button>
          </div>
        </div>
      </div>
      
      {/* 执行选项 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          ⚙️ 执行选项
        </div>
        
        <div style={styles.optionsContainer}>
          <div style={styles.optionRow}>
            <input
              type="checkbox"
              style={styles.checkbox}
              checked={options.debug}
              onChange={(e) => handleOptionChange('debug', e.target.checked)}
            />
            <label style={styles.label}>
              调试模式
            </label>
          </div>
          
          <div style={styles.optionRow}>
            <input
              type="checkbox"
              style={styles.checkbox}
              checked={options.autoSave}
              onChange={(e) => handleOptionChange('autoSave', e.target.checked)}
            />
            <label style={styles.label}>
              自动保存结果
            </label>
          </div>
          
          <div style={styles.optionRow}>
            <label style={{ ...styles.label, width: '100px' }}>
              最大迭代:
            </label>
            <input
              type="number"
              style={{
                width: '60px',
                padding: '4px',
                borderRadius: '4px',
                border: '1px solid #0f3460',
                backgroundColor: '#1a1a2e',
                color: '#eaeaea'
              }}
              value={options.maxIterations}
              onChange={(e) => handleOptionChange('maxIterations', parseInt(e.target.value))}
            />
          </div>
        </div>
      </div>
      
      {/* 历史记录 */}
      {history.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            📜 历史记录
          </div>
          
          <div style={styles.historyList}>
            {history.map((item, index) => (
              <div
                key={index}
                style={styles.historyItem}
                onClick={() => handleHistoryClick(item)}
                title={item.input}
              >
                <div style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {item.input}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: '#888888',
                  marginTop: '4px'
                }}>
                  {new Date(item.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AgentControl;