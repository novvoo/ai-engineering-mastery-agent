/**
 * Agent 控制面板组件（增强版）
 * 提供 Agent 的输入、执行控制等功能
 * 
 * 新增功能：
 * - 智能输入提示（自动补全）
 * - 快捷命令面板
 * - 输入历史搜索
 * - 输入模板
 * - 多行输入支持
 * - 字符计数
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';

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
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  
  // 状态区域
  statusContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px'
  },
  
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500',
    gap: '4px'
  },
  
  statusRunning: {
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    color: '#ffc107',
    border: '1px solid #ffc107'
  },
  
  statusIdle: {
    backgroundColor: 'rgba(40, 167, 69, 0.2)',
    color: '#28a745',
    border: '1px solid #28a745'
  },
  
  statusError: {
    backgroundColor: 'rgba(220, 53, 69, 0.2)',
    color: '#dc3545',
    border: '1px solid #dc3545'
  },
  
  statusCompleted: {
    backgroundColor: 'rgba(23, 162, 184, 0.2)',
    color: '#17a2b8',
    border: '1px solid #17a2b8'
  },
  
  // 工作目录
  workingDirectory: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    borderRadius: '6px',
    backgroundColor: '#1a1a2e',
    border: '1px solid #0f3460'
  },
  
  directoryIcon: {
    fontSize: '16px',
    color: '#888888'
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
    fontSize: '11px',
    transition: 'all 0.2s'
  },
  
  // 输入区域
  inputContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  
  textareaWrapper: {
    position: 'relative',
    borderRadius: '8px',
    border: '1px solid #0f3460',
    backgroundColor: '#1a1a2e',
    transition: 'border-color 0.2s'
  },
  
  textareaWrapperFocused: {
    borderColor: '#e94560'
  },
  
  textarea: {
    width: '100%',
    minHeight: '100px',
    maxHeight: '300px',
    padding: '12px',
    paddingRight: '80px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#eaeaea',
    fontSize: '14px',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: '1.5',
    outline: 'none'
  },
  
  textareaControls: {
    position: 'absolute',
    right: '8px',
    bottom: '8px',
    display: 'flex',
    gap: '4px',
    alignItems: 'center'
  },
  
  charCount: {
    fontSize: '11px',
    color: '#888888',
    padding: '2px 4px'
  },
  
  charCountWarning: {
    color: '#ffc107'
  },
  
  clearButton: {
    padding: '2px 6px',
    borderRadius: '3px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#888888',
    cursor: 'pointer',
    fontSize: '11px',
    transition: 'all 0.15s'
  },
  
  // 智能提示
  suggestionsContainer: {
    position: 'absolute',
    bottom: '100%',
    left: '0',
    right: '0',
    backgroundColor: '#16213e',
    border: '1px solid #0f3460',
    borderRadius: '6px',
    maxHeight: '150px',
    overflowY: 'auto',
    boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.2)',
    zIndex: 10
  },
  
  suggestionItem: {
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#eaeaea',
    transition: 'background-color 0.15s',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  
  suggestionItemActive: {
    backgroundColor: '#0f3460'
  },
  
  suggestionIcon: {
    fontSize: '12px',
    color: '#888888'
  },
  
  suggestionText: {
    flex: 1
  },
  
  suggestionType: {
    fontSize: '11px',
    color: '#666666',
    padding: '2px 6px',
    borderRadius: '3px',
    backgroundColor: '#1a1a2e'
  },
  
  // 按钮组
  buttonGroup: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
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
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    minWidth: '80px'
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
  
  // 快捷命令面板
  quickCommandsPanel: {
    backgroundColor: '#16213e',
    borderRadius: '6px',
    padding: '8px',
    marginBottom: '8px'
  },
  
  quickCommandsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  
  quickCommandsTitle: {
    fontSize: '12px',
    color: '#888888',
    fontWeight: '500'
  },
  
  quickCommandsList: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap'
  },
  
  quickCommandButton: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#1a1a2e',
    color: '#888888',
    cursor: 'pointer',
    fontSize: '11px',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  
  // 历史记录
  historySection: {
    maxHeight: '200px',
    overflowY: 'auto'
  },
  
  historySearch: {
    width: '100%',
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid #0f3460',
    backgroundColor: '#1a1a2e',
    color: '#eaeaea',
    fontSize: '12px',
    marginBottom: '8px'
  },
  
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  
  historyItem: {
    padding: '8px',
    borderRadius: '4px',
    backgroundColor: '#1a1a2e',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#eaeaea',
    transition: 'background-color 0.2s',
    border: '1px solid transparent',
    position: 'relative'
  },
  
  historyItemHover: {
    backgroundColor: '#16213e',
    border: '1px solid #0f3460'
  },
  
  historyItemContent: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '90%'
  },
  
  historyItemTime: {
    fontSize: '11px',
    color: '#888888',
    marginTop: '4px'
  },
  
  historyItemDelete: {
    position: 'absolute',
    right: '8px',
    top: '50%',
    transform: 'translateY(-50%)',
    padding: '2px 4px',
    borderRadius: '3px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#888888',
    cursor: 'pointer',
    fontSize: '11px',
    opacity: '0',
    transition: 'opacity 0.15s'
  },
  
  historyItemDeleteVisible: {
    opacity: '1'
  },
  
  // 模板面板
  templatesPanel: {
    backgroundColor: '#16213e',
    borderRadius: '6px',
    padding: '8px',
    marginTop: '8px'
  },
  
  templatesHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  
  templatesTitle: {
    fontSize: '12px',
    color: '#888888',
    fontWeight: '500'
  },
  
  templatesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  
  templateItem: {
    padding: '8px',
    borderRadius: '4px',
    backgroundColor: '#1a1a2e',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#eaeaea',
    transition: 'background-color 0.15s',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  
  templateIcon: {
    fontSize: '14px'
  },
  
  templateName: {
    fontWeight: '500'
  },
  
  templateDesc: {
    fontSize: '11px',
    color: '#888888',
    marginLeft: '4px'
  },
  
  // 执行选项
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
    cursor: 'pointer',
    accentColor: '#e94560'
  },
  
  label: {
    fontSize: '13px',
    color: '#eaeaea',
    cursor: 'pointer'
  },
  
  numberInput: {
    width: '60px',
    padding: '4px',
    borderRadius: '4px',
    border: '1px solid #0f3460',
    backgroundColor: '#1a1a2e',
    color: '#eaeaea',
    fontSize: '12px'
  },
  
  // 空状态
  emptyHistory: {
    textAlign: 'center',
    padding: '16px',
    color: '#888888',
    fontSize: '12px'
  }
};

// 快捷命令定义
const QUICK_COMMANDS = [
  { icon: '📁', label: '读取文件', template: '读取文件 {path}' },
  { icon: '📝', label: '写入文件', template: '写入文件 {path} 内容: {content}' },
  { icon: '🔍', label: '搜索代码', template: '在代码中搜索 {pattern}' },
  { icon: '🔧', label: '修复bug', template: '修复bug: {description}' },
  { icon: '🚀', label: '优化代码', template: '优化代码: {description}' },
  { icon: '📊', label: '分析项目', template: '分析项目结构和依赖' },
  { icon: '🧪', label: '运行测试', template: '运行测试并分析结果' },
  { icon: '📖', label: '生成文档', template: '为代码生成文档' }
];

// 输入模板定义
const INPUT_TEMPLATES = [
  { 
    icon: '🐛', 
    name: 'Bug修复', 
    desc: '描述并修复bug',
    template: '发现一个bug:\n位置: {file}\n描述: {description}\n预期行为: {expected}\n请帮我修复这个问题'
  },
  { 
    icon: '✨', 
    name: '功能开发', 
    desc: '开发新功能',
    template: '开发新功能:\n功能名称: {name}\n需求: {requirements}\n请帮我实现这个功能'
  },
  { 
    icon: '🔄', 
    name: '代码重构', 
    desc: '重构现有代码',
    template: '重构代码:\n目标文件: {file}\n重构目标: {goal}\n请帮我重构这段代码'
  },
  { 
    icon: '📝', 
    name: '代码审查', 
    desc: '审查代码质量',
    template: '审查代码:\n文件: {file}\n请检查代码质量、潜在问题和改进建议'
  },
  { 
    icon: '🧪', 
    name: '测试编写', 
    desc: '编写单元测试',
    template: '编写测试:\n目标: {target}\n请为这个功能编写单元测试'
  }
];

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
  const [historySearch, setHistorySearch] = useState('');
  const [options, setOptions] = useState({
    debug: false,
    maxIterations: 180,
    autoSave: true
  });
  const [showTemplates, setShowTemplates] = useState(false);
  const [showQuickCommands, setShowQuickCommands] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const [hoveredHistoryItem, setHoveredHistoryItem] = useState(null);
  
  // 引用
  const textareaRef = useRef(null);
  const suggestionsRef = useRef(null);
  
  // 加载历史记录
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('agentHistory');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.error('[AgentControl] 加载历史记录失败:', error);
    }
  }, []);
  
  // 智能提示
  const generateSuggestions = useCallback((text) => {
    if (!text || text.length < 2) {
      setSuggestions([]);
      return;
    }
    
    const newSuggestions = [];
    
    // 基于历史记录的提示
    const historyMatches = history
      .filter(item => item.input.toLowerCase().includes(text.toLowerCase()))
      .slice(0, 3)
      .map(item => ({
        type: 'history',
        icon: '📜',
        text: item.input.slice(0, 50) + (item.input.length > 50 ? '...' : ''),
        fullText: item.input
      }));
    
    newSuggestions.push(...historyMatches);
    
    // 基于快捷命令的提示
    const commandMatches = QUICK_COMMANDS
      .filter(cmd => cmd.label.toLowerCase().includes(text.toLowerCase()) || 
                     cmd.template.toLowerCase().includes(text.toLowerCase()))
      .slice(0, 2)
      .map(cmd => ({
        type: 'command',
        icon: cmd.icon,
        text: cmd.label,
        fullText: cmd.template
      }));
    
    newSuggestions.push(...commandMatches);
    
    setSuggestions(newSuggestions);
    setActiveSuggestion(-1);
  }, [history]);
  
  // 处理输入变更
  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    setInput(value);
    generateSuggestions(value);
  }, [generateSuggestions]);
  
  // 处理键盘事件
  const handleKeyDown = useCallback((e) => {
    // 处理智能提示导航
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestion(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestion(prev => prev > 0 ? prev - 1 : prev);
      } else if (e.key === 'Tab' || (e.key === 'Enter' && activeSuggestion >= 0)) {
        e.preventDefault();
        if (activeSuggestion >= 0) {
          setInput(suggestions[activeSuggestion].fullText);
          setSuggestions([]);
        }
      } else if (e.key === 'Escape') {
        setSuggestions([]);
      }
    }
    
    // Ctrl+Enter 执行
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleExecute();
    }
  }, [suggestions, activeSuggestion]);
  
  // 处理焦点
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);
  
  const handleBlur = useCallback(() => {
    // 延迟关闭提示，允许点击提示项
    setTimeout(() => {
      setIsFocused(false);
      setSuggestions([]);
    }, 200);
  }, []);
  
  // 处理建议选择
  const handleSuggestionClick = useCallback((suggestion) => {
    setInput(suggestion.fullText);
    setSuggestions([]);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);
  
  // 处理执行
  const handleExecute = useCallback(async () => {
    if (!input.trim()) {
      return;
    }
    
    // 保存到历史记录
    const newHistory = [
      { input: input.trim(), timestamp: Date.now() },
      ...history.slice(0, 19) // 最多保存 20 条
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
  
  // 处理历史记录删除
  const handleHistoryDelete = useCallback((index) => {
    const newHistory = history.filter((_, i) => i !== index);
    setHistory(newHistory);
    localStorage.setItem('agentHistory', JSON.stringify(newHistory));
  }, [history]);
  
  // 处理快捷命令点击
  const handleQuickCommandClick = useCallback((cmd) => {
    setInput(cmd.template);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);
  
  // 处理模板点击
  const handleTemplateClick = useCallback((template) => {
    setInput(template.template);
    setShowTemplates(false);
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
  
  // 清空输入
  const handleClearInput = useCallback(() => {
    setInput('');
    setSuggestions([]);
  }, []);
  
  // 过滤历史记录
  const filteredHistory = useMemo(() => {
    if (!historySearch) return history;
    return history.filter(item => 
      item.input.toLowerCase().includes(historySearch.toLowerCase())
    );
  }, [history, historySearch]);
  
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
  
  // 字符计数
  const charCount = input.length;
  const charCountStyle = charCount > 500 ? styles.charCountWarning : {};
  
  return (
    <div style={styles.container}>
      {/* 状态显示 */}
      <div style={styles.section}>
        <div style={styles.statusContainer}>
          <div style={getStatusStyle()}>
            {getStatusText()}
          </div>
          
          {/* 运行时间 */}
          {runtime.status === 'running' && runtime.stats?.startTime && (
            <div style={{
              fontSize: '11px',
              color: '#888888'
            }}>
              已运行: {Math.floor((Date.now() - runtime.stats.startTime) / 1000)}秒
            </div>
          )}
        </div>
        
        {/* 工作目录 */}
        <div style={styles.workingDirectory}>
          <span style={styles.directoryIcon}>📁</span>
          <span style={styles.directoryText}>
            {workingDirectory || '未设置'}
          </span>
          <button
            style={styles.changeButton}
            onClick={onWorkingDirectoryChange}
            title="更改工作目录"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e94560'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0f3460'}
          >
            更改
          </button>
        </div>
      </div>
      
      {/* 快捷命令 */}
      {showQuickCommands && (
        <div style={styles.section}>
          <div style={styles.quickCommandsPanel}>
            <div style={styles.quickCommandsHeader}>
              <span style={styles.quickCommandsTitle}>
                ⚡ 快捷命令
              </span>
              <button
                style={styles.clearButton}
                onClick={() => setShowQuickCommands(false)}
                title="隐藏快捷命令"
              >
                ✖️
              </button>
            </div>
            <div style={styles.quickCommandsList}>
              {QUICK_COMMANDS.map((cmd, index) => (
                <button
                  key={index}
                  style={styles.quickCommandButton}
                  onClick={() => handleQuickCommandClick(cmd)}
                  title={cmd.template}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#0f3460';
                    e.currentTarget.style.color = '#eaeaea';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#1a1a2e';
                    e.currentTarget.style.color = '#888888';
                  }}
                >
                  <span>{cmd.icon}</span>
                  <span>{cmd.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* 输入区域 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <span>📝</span>
          <span>输入任务</span>
          <button
            style={styles.clearButton}
            onClick={() => setShowTemplates(!showTemplates)}
            title="显示输入模板"
          >
            {showTemplates ? '📖 隐藏模板' : '📖 模板'}
          </button>
        </div>
        
        {/* 模板面板 */}
        {showTemplates && (
          <div style={styles.templatesPanel}>
            <div style={styles.templatesHeader}>
              <span style={styles.templatesTitle}>
                📋 输入模板
              </span>
            </div>
            <div style={styles.templatesList}>
              {INPUT_TEMPLATES.map((template, index) => (
                <div
                  key={index}
                  style={styles.templateItem}
                  onClick={() => handleTemplateClick(template)}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0f3460'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a1a2e'}
                >
                  <span style={styles.templateIcon}>{template.icon}</span>
                  <span style={styles.templateName}>{template.name}</span>
                  <span style={styles.templateDesc}>{template.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div style={styles.inputContainer}>
          {/* 文本输入 */}
          <div style={{
            ...styles.textareaWrapper,
            ...(isFocused ? styles.textareaWrapperFocused : {})
          }}>
            {/* 智能提示 */}
            {suggestions.length > 0 && (
              <div style={styles.suggestionsContainer} ref={suggestionsRef}>
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    style={{
                      ...styles.suggestionItem,
                      ...(index === activeSuggestion ? styles.suggestionItemActive : {})
                    }}
                    onClick={() => handleSuggestionClick(suggestion)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#0f3460';
                      setActiveSuggestion(index);
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = index === activeSuggestion ? '#0f3460' : 'transparent';
                    }}
                  >
                    <span style={styles.suggestionIcon}>{suggestion.icon}</span>
                    <span style={styles.suggestionText}>{suggestion.text}</span>
                    <span style={styles.suggestionType}>{suggestion.type}</span>
                  </div>
                ))}
              </div>
            )}
            
            <textarea
              ref={textareaRef}
              style={styles.textarea}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder="输入您的任务描述... (Ctrl+Enter 执行)"
              disabled={runtime.status === 'running'}
            />
            
            {/* 控制按钮 */}
            <div style={styles.textareaControls}>
              <span style={{ ...styles.charCount, ...charCountStyle }}>
                {charCount}
              </span>
              {input && (
                <button
                  style={styles.clearButton}
                  onClick={handleClearInput}
                  title="清空输入"
                  onMouseEnter={(e) => e.currentTarget.style.color = '#e94560'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#888888'}
                >
                  ✖️
                </button>
              )}
            </div>
          </div>
          
          {/* 执行按钮 */}
          <div style={styles.buttonGroup}>
            <button
              style={{
                ...styles.button,
                ...(canExecute ? styles.primaryButton : styles.disabledButton)
              }}
              onClick={handleExecute}
              disabled={!canExecute}
              onMouseEnter={(e) => {
                if (canExecute) e.currentTarget.style.backgroundColor = '#c73e54';
              }}
              onMouseLeave={(e) => {
                if (canExecute) e.currentTarget.style.backgroundColor = '#e94560';
              }}
            >
              {runtime.status === 'running' ? '⏳ 执行中...' : '▶️ 执行'}
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
            
            {!showQuickCommands && (
              <button
                style={styles.button}
                onClick={() => setShowQuickCommands(true)}
                title="显示快捷命令"
              >
                ⚡ 命令
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* 执行选项 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <span>⚙️</span>
          <span>执行选项</span>
        </div>
        
        <div style={styles.optionsContainer}>
          <div style={styles.optionRow}>
            <input
              type="checkbox"
              style={styles.checkbox}
              checked={options.debug}
              onChange={(e) => handleOptionChange('debug', e.target.checked)}
            />
            <label 
              style={styles.label}
              onClick={() => handleOptionChange('debug', !options.debug)}
            >
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
            <label 
              style={styles.label}
              onClick={() => handleOptionChange('autoSave', !options.autoSave)}
            >
              自动保存结果
            </label>
          </div>
          
          <div style={styles.optionRow}>
            <label style={{ ...styles.label, width: '100px' }}>
              最大迭代:
            </label>
            <input
              type="number"
              style={styles.numberInput}
              value={options.maxIterations}
              onChange={(e) => handleOptionChange('maxIterations', parseInt(e.target.value) || 180)}
              min={1}
              max={500}
            />
          </div>
        </div>
      </div>
      
      {/* 历史记录 */}
      {history.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <span>📜</span>
            <span>历史记录</span>
            <span style={{
              fontSize: '12px',
              color: '#888888',
              marginLeft: '4px'
            }}>
              ({filteredHistory.length}/{history.length})
            </span>
          </div>
          
          {/* 搜索 */}
          <input
            style={styles.historySearch}
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            placeholder="🔍 搜索历史记录..."
          />
          
          {/* 列表 */}
          <div style={styles.historySection}>
            <div style={styles.historyList}>
              {filteredHistory.map((item, index) => (
                <div
                  key={index}
                  style={{
                    ...styles.historyItem,
                    ...(hoveredHistoryItem === index ? styles.historyItemHover : {})
                  }}
                  onClick={() => handleHistoryClick(item)}
                  onMouseEnter={() => setHoveredHistoryItem(index)}
                  onMouseLeave={() => setHoveredHistoryItem(null)}
                  title={item.input}
                >
                  <div style={styles.historyItemContent}>
                    {item.input}
                  </div>
                  <div style={styles.historyItemTime}>
                    {new Date(item.timestamp).toLocaleString()}
                  </div>
                  <button
                    style={{
                      ...styles.historyItemDelete,
                      ...(hoveredHistoryItem === index ? styles.historyItemDeleteVisible : {})
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleHistoryDelete(index);
                    }}
                    title="删除此记录"
                    onMouseEnter={(e) => e.currentTarget.style.color = '#dc3545'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#888888'}
                  >
                    ✖️
                  </button>
                </div>
              ))}
              
              {filteredHistory.length === 0 && history.length > 0 && (
                <div style={styles.emptyHistory}>
                  没有找到匹配的历史记录
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AgentControl;