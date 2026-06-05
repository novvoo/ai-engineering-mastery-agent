/**
 * AI Agent Desktop - 主应用组件
 * React 主应用入口，整合所有 UI 组件
 */

import React, { useState, useEffect, useCallback } from 'react';
import AgentControl from './components/AgentControl.jsx';
import ToolPanel from './components/ToolPanel.jsx';
import MessageLog from './components/MessageLog.jsx';
import StatusBar from './components/StatusBar.jsx';
import Toolbar from './components/Toolbar.jsx';
import { useRuntime } from './hooks/useRuntime.js';
import { useIPC } from './hooks/useIPC.js';
import './index.css';

// 样式定义
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#1a1a2e',
    color: '#eaeaea',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
    overflow: 'hidden'
  },
  
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    backgroundColor: '#16213e',
    borderBottom: '1px solid #0f3460',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
  },
  
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#e94560',
    letterSpacing: '0.5px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  
  headerButtons: {
    display: 'flex',
    gap: '8px'
  },
  
  headerButton: {
    padding: '6px 12px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#0f3460',
    color: '#eaeaea',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden'
  },
  
  sidebar: {
    width: '280px',
    backgroundColor: '#16213e',
    borderRight: '1px solid #0f3460',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: '16px'
  },
  
  footer: {
    padding: '8px 20px',
    backgroundColor: '#16213e',
    borderTop: '1px solid #0f3460'
  },
  
  logoIcon: {
    fontSize: '20px'
  }
};

/**
 * 主应用组件
 */
function App() {
  // 状态管理
  const [activeTab, setActiveTab] = useState('agent');
  const [workingDirectory, setWorkingDirectory] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  
  // 使用自定义 Hooks
  const runtime = useRuntime();
  const ipc = useIPC();
  
  // 初始化
  useEffect(() => {
    // 连接到主进程
    ipc.connect().then(() => {
      console.log('[App] 已连接到主进程');
      
      // 获取应用信息
      ipc.getAppInfo().then(info => {
        console.log('[App] 应用信息:', info);
        setWorkingDirectory(info.workingDirectory);
      });
      
      // 获取工具列表
      runtime.loadTools();
      
      // 获取初始状态
      runtime.refreshState();
    }).catch(error => {
      console.error('[App] 连接失败:', error);
    });
    
    // 清理
    return () => {
      ipc.disconnect();
    };
  }, []);
  
  // 处理工作目录变更
  const handleWorkingDirectoryChange = useCallback(async () => {
    const result = await ipc.openDirectoryDialog({
      title: '选择工作目录'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const newDir = result.filePaths[0];
      await ipc.setWorkingDirectory(newDir);
      setWorkingDirectory(newDir);
      
      // 重新加载工具
      runtime.loadTools();
    }
  }, [ipc, runtime]);
  
  // 处理新建任务
  const handleNewTask = useCallback(() => {
    runtime.clearMessages();
    setActiveTab('agent');
  }, [runtime]);
  
  // 处理窗口控制
  const handleMinimize = useCallback(() => {
    ipc.minimizeWindow();
  }, [ipc]);
  
  const handleMaximize = useCallback(() => {
    ipc.maximizeWindow();
  }, [ipc]);
  
  const handleClose = useCallback(() => {
    ipc.closeWindow();
  }, [ipc]);
  
  // 处理加载任务
  const handleLoadTask = useCallback(() => {
    console.log('[App] 加载任务');
    // TODO: 实现加载任务功能
  }, []);
  
  // 处理保存任务
  const handleSaveTask = useCallback(() => {
    console.log('[App] 保存任务');
    // TODO: 实现保存任务功能
  }, []);
  
  // 处理导出
  const handleExport = useCallback(() => {
    console.log('[App] 导出');
    // TODO: 实现导出功能
  }, []);
  
  // 处理帮助
  const handleHelp = useCallback(() => {
    console.log('[App] 帮助');
    // TODO: 实现帮助功能
  }, []);
  
  // 渲染侧边栏内容
  const renderSidebarContent = () => {
    switch (activeTab) {
      case 'agent':
        return (
          <AgentControl
            runtime={runtime}
            workingDirectory={workingDirectory}
            onWorkingDirectoryChange={handleWorkingDirectoryChange}
          />
        );
      
      case 'tools':
        return (
          <ToolPanel
            tools={runtime.tools}
            loading={runtime.loading}
          />
        );
      
      default:
        return null;
    }
  };
  
  return (
    <div style={styles.container}>
      {/* 头部 */}
      <header style={styles.header}>
        <div style={styles.title}>
          <span style={styles.logoIcon}>🤖</span>
          AI Agent Desktop
        </div>
        
        <div style={styles.headerButtons}>
          <button 
            style={styles.headerButton}
            onClick={handleMinimize}
            title="最小化"
          >
            ➖
          </button>
          
          <button 
            style={styles.headerButton}
            onClick={handleMaximize}
            title="最大化"
          >
            📺
          </button>
          
          <button 
            style={{ ...styles.headerButton, backgroundColor: '#e94560' }}
            onClick={handleClose}
            title="关闭"
          >
            ✖️
          </button>
        </div>
      </header>
      
      {/* 工具栏 */}
      <Toolbar
        status={runtime.status}
        taskCount={runtime.messages.length}
        onNewTask={handleNewTask}
        onLoadTask={handleLoadTask}
        onSaveTask={handleSaveTask}
        onExport={handleExport}
        onSettings={() => setShowSettings(true)}
        onHelp={handleHelp}
      />
      
      {/* 主体内容 */}
      <main style={styles.main}>
        {/* 侧边栏 */}
        <aside style={styles.sidebar}>
          {/* 标签导航 */}
          <div style={{
            display: 'flex',
            padding: '8px',
            borderBottom: '1px solid #0f3460'
          }}>
            <button
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: activeTab === 'agent' ? '#e94560' : '#0f3460',
                color: '#eaeaea',
                cursor: 'pointer',
                marginRight: '4px'
              }}
              onClick={() => setActiveTab('agent')}
            >
              🤖 Agent
            </button>
            
            <button
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: activeTab === 'tools' ? '#e94560' : '#0f3460',
                color: '#eaeaea',
                cursor: 'pointer'
              }}
              onClick={() => setActiveTab('tools')}
            >
              🔧 工具
            </button>
          </div>
          
          {/* 侧边栏内容 */}
          {renderSidebarContent()}
        </aside>
        
        {/* 主内容区 */}
        <div style={styles.content}>
          <MessageLog
            messages={runtime.messages}
            status={runtime.status}
            onClear={runtime.clearMessages}
          />
        </div>
      </main>
      
      {/* 底部状态栏 */}
      <footer style={styles.footer}>
        <StatusBar
          status={runtime.status}
          workingDirectory={workingDirectory}
          toolCount={runtime.tools.length}
          isConnected={ipc.isConnected}
          stats={runtime.stats}
        />
      </footer>
      
      {/* 设置面板（可选） */}
      {showSettings && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#16213e',
          padding: '24px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          zIndex: 1000,
          minWidth: '400px'
        }}>
          <h3 style={{ color: '#e94560', marginBottom: '16px' }}>⚙️ 设置</h3>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#eaeaea' }}>
              工作目录:
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={workingDirectory}
                readOnly
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #0f3460',
                  backgroundColor: '#1a1a2e',
                  color: '#eaeaea'
                }}
              />
              <button
                style={styles.headerButton}
                onClick={handleWorkingDirectoryChange}
              >
                选择
              </button>
            </div>
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#eaeaea' }}>
              最大迭代次数:
            </label>
            <input
              type="number"
              defaultValue={180}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #0f3460',
                backgroundColor: '#1a1a2e',
                color: '#eaeaea'
              }}
            />
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              style={styles.headerButton}
              onClick={() => setShowSettings(false)}
            >
              关闭
            </button>
            <button
              style={{ ...styles.headerButton, backgroundColor: '#e94560' }}
              onClick={() => setShowSettings(false)}
            >
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;