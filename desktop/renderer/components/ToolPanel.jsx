/**
 * 工具面板组件（增强版）
 * 显示可用工具列表及其信息
 * 
 * 新增功能：
 * - 工具收藏/收藏夹
 * - 快速调用工具
 * - 工具使用统计
 * - 工具详情展开/折叠
 * - 工具状态指示
 * - 工具分组视图
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';

// 样式定义
const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  
  header: {
    padding: '12px',
    borderBottom: '1px solid #0f3460'
  },
  
  searchContainer: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  
  searchInput: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #0f3460',
    backgroundColor: '#1a1a2e',
    color: '#eaeaea',
    fontSize: '13px',
    transition: 'border-color 0.2s'
  },
  
  searchInputFocused: {
    borderColor: '#e94560'
  },
  
  viewToggle: {
    display: 'flex',
    gap: '2px',
    padding: '2px',
    borderRadius: '4px',
    backgroundColor: '#1a1a2e'
  },
  
  viewButton: {
    padding: '4px 8px',
    borderRadius: '3px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#888888',
    cursor: 'pointer',
    fontSize: '11px',
    transition: 'all 0.15s'
  },
  
  viewButtonActive: {
    backgroundColor: '#e94560',
    color: '#ffffff'
  },
  
  // 收藏栏
  favoritesBar: {
    padding: '8px 12px',
    backgroundColor: '#16213e',
    borderBottom: '1px solid #0f3460',
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  
  favoritesTitle: {
    fontSize: '12px',
    color: '#888888',
    marginRight: '8px'
  },
  
  favoriteButton: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#e94560',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '11px',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  
  favoriteButtonEmpty: {
    backgroundColor: '#1a1a2e',
    color: '#888888',
    border: '1px solid #0f3460'
  },
  
  // 分类过滤
  categoryFilter: {
    display: 'flex',
    gap: '4px',
    marginTop: '8px',
    flexWrap: 'wrap',
    padding: '0 12px 12px'
  },
  
  categoryButton: {
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
  
  categoryButtonActive: {
    backgroundColor: '#e94560',
    color: '#ffffff'
  },
  
  categoryCount: {
    fontSize: '10px',
    opacity: '0.7'
  },
  
  // 统计信息
  statsContainer: {
    padding: '8px 12px',
    backgroundColor: '#16213e',
    borderRadius: '6px',
    marginBottom: '8px'
  },
  
  statsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#888888'
  },
  
  statsValue: {
    color: '#eaeaea',
    fontWeight: '500'
  },
  
  // 工具列表
  toolList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px'
  },
  
  toolItem: {
    padding: '12px',
    borderRadius: '8px',
    backgroundColor: '#16213e',
    marginBottom: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: '1px solid transparent',
    position: 'relative'
  },
  
  toolItemHover: {
    border: '1px solid #e94560',
    transform: 'translateX(2px)'
  },
  
  toolItemSelected: {
    border: '1px solid #e94560',
    backgroundColor: '#1a1a2e'
  },
  
  toolHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  
  toolName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#e94560',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  
  toolFavoriteIcon: {
    fontSize: '12px',
    color: '#ffc107',
    cursor: 'pointer',
    transition: 'transform 0.2s'
  },
  
  toolCategory: {
    fontSize: '11px',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: '#0f3460',
    color: '#eaeaea',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  
  toolDescription: {
    fontSize: '12px',
    color: '#888888',
    marginBottom: '8px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  
  toolMeta: {
    display: 'flex',
    gap: '8px',
    fontSize: '11px',
    color: '#666666'
  },
  
  toolStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  
  statusEnabled: {
    color: '#28a745'
  },
  
  statusDisabled: {
    color: '#dc3545'
  },
  
  toolActions: {
    display: 'flex',
    gap: '4px',
    marginTop: '8px',
    opacity: '0',
    transition: 'opacity 0.2s'
  },
  
  toolActionsVisible: {
    opacity: '1'
  },
  
  actionButton: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#0f3460',
    color: '#888888',
    cursor: 'pointer',
    fontSize: '11px',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  
  actionButtonPrimary: {
    backgroundColor: '#e94560',
    color: '#ffffff'
  },
  
  // 工具详情
  toolDetail: {
    padding: '12px',
    backgroundColor: '#1a1a2e',
    borderRadius: '6px',
    marginTop: '8px',
    border: '1px solid #0f3460'
  },
  
  toolDetailTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#e94560',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  
  toolDetailSection: {
    marginBottom: '12px'
  },
  
  toolDetailLabel: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#888888',
    marginBottom: '4px'
  },
  
  toolDetailContent: {
    fontSize: '12px',
    color: '#eaeaea',
    padding: '8px',
    borderRadius: '4px',
    backgroundColor: '#16213e',
    maxHeight: '150px',
    overflowY: 'auto'
  },
  
  parameterList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  
  parameterItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: '#16213e'
  },
  
  parameterName: {
    color: '#e94560',
    fontWeight: '500',
    minWidth: '80px'
  },
  
  parameterType: {
    color: '#888888',
    fontSize: '11px',
    padding: '2px 4px',
    borderRadius: '3px',
    backgroundColor: '#1a1a2e'
  },
  
  parameterRequired: {
    color: '#ffc107',
    fontSize: '11px',
    padding: '2px 4px',
    borderRadius: '3px',
    backgroundColor: 'rgba(255, 193, 7, 0.2)'
  },
  
  parameterOptional: {
    color: '#888888',
    fontSize: '11px'
  },
  
  parameterDesc: {
    color: '#888888',
    fontSize: '11px',
    marginLeft: 'auto'
  },
  
  // 使用统计
  usageStats: {
    display: 'flex',
    gap: '12px',
    marginTop: '8px',
    padding: '8px',
    borderRadius: '4px',
    backgroundColor: '#16213e'
  },
  
  usageStat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px'
  },
  
  usageStatValue: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#eaeaea'
  },
  
  usageStatLabel: {
    fontSize: '10px',
    color: '#888888'
  },
  
  // 分组视图
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: '#0f3460',
    borderRadius: '4px',
    marginBottom: '8px',
    marginTop: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.15s'
  },
  
  groupIcon: {
    fontSize: '12px',
    color: '#888888'
  },
  
  groupTitle: {
    fontSize: '12px',
    color: '#eaeaea',
    fontWeight: '500'
  },
  
  groupCount: {
    fontSize: '11px',
    color: '#888888',
    marginLeft: 'auto'
  },
  
  groupExpandIcon: {
    fontSize: '10px',
    color: '#888888'
  },
  
  // 空状态
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: '#888888',
    gap: '12px'
  },
  
  loadingSpinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #0f3460',
    borderTopColor: '#e94560',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  
  loadingText: {
    fontSize: '14px'
  },
  
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: '#888888',
    textAlign: 'center',
    padding: '32px'
  },
  
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: '0.5'
  },
  
  emptyText: {
    fontSize: '14px',
    marginBottom: '8px'
  },
  
  emptyHint: {
    fontSize: '12px',
    color: '#666666'
  },
  
  // 快速调用面板
  quickInvokePanel: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: '#16213e',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    zIndex: 1000,
    minWidth: '400px',
    maxWidth: '600px',
    border: '1px solid #0f3460'
  },
  
  quickInvokeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  
  quickInvokeTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#e94560',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  
  quickInvokeClose: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#888888',
    cursor: 'pointer',
    fontSize: '14px'
  },
  
  quickInvokeForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  
  quickInvokeInput: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #0f3460',
    backgroundColor: '#1a1a2e',
    color: '#eaeaea',
    fontSize: '13px'
  },
  
  quickInvokeTextarea: {
    width: '100%',
    minHeight: '80px',
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #0f3460',
    backgroundColor: '#1a1a2e',
    color: '#eaeaea',
    fontSize: '13px',
    resize: 'vertical',
    fontFamily: 'inherit'
  },
  
  quickInvokeButtons: {
    display: 'flex',
    gap: '8px',
    marginTop: '16px'
  }
};

/**
 * 工具面板组件
 * @param {Object} props - 组件属性
 * @param {Array} props.tools - 工具列表
 * @param {boolean} props.loading - 是否正在加载
 * @param {Function} props.onQuickInvoke - 快速调用回调
 */
function ToolPanel({ tools, loading, onQuickInvoke }) {
  // 状态
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTool, setSelectedTool] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grouped'
  const [favorites, setFavorites] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [hoveredTool, setHoveredTool] = useState(null);
  const [quickInvokeTool, setQuickInvokeTool] = useState(null);
  const [quickInvokeParams, setQuickInvokeParams] = useState({});
  const [toolUsageStats, setToolUsageStats] = useState({});
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  // 加载收藏和统计
  useEffect(() => {
    try {
      const savedFavorites = localStorage.getItem('toolFavorites');
      if (savedFavorites) {
        setFavorites(JSON.parse(savedFavorites));
      }
      
      const savedStats = localStorage.getItem('toolUsageStats');
      if (savedStats) {
        setToolUsageStats(JSON.parse(savedStats));
      }
    } catch (error) {
      console.error('[ToolPanel] 加载收藏失败:', error);
    }
  }, []);
  
  // 获取所有分类
  const categories = useMemo(() => {
    const cats = new Map();
    cats.set('all', { name: '全部', icon: '📋', count: tools.length });
    
    tools.forEach(tool => {
      const cat = tool.category || 'general';
      if (!cats.has(cat)) {
        cats.set(cat, { 
          name: cat, 
          icon: getCategoryIcon(cat), 
          count: 0 
        });
      }
      cats.get(cat).count++;
    });
    
    return Array.from(cats.entries());
  }, [tools]);
  
  // 过滤工具
  const filteredTools = useMemo(() => {
    return tools.filter(tool => {
      // 分类过滤
      if (selectedCategory !== 'all' && (tool.category || 'general') !== selectedCategory) {
        return false;
      }
      
      // 搜索过滤
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          tool.name.toLowerCase().includes(query) ||
          tool.description?.toLowerCase().includes(query) ||
          (tool.category || '').toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [tools, selectedCategory, searchQuery]);
  
  // 分组工具
  const groupedTools = useMemo(() => {
    if (viewMode !== 'grouped') return null;
    
    const groups = {};
    filteredTools.forEach(tool => {
      const cat = tool.category || 'general';
      if (!groups[cat]) {
        groups[cat] = {
          name: cat,
          icon: getCategoryIcon(cat),
          tools: []
        };
      }
      groups[cat].tools.push(tool);
    });
    
    return groups;
  }, [filteredTools, viewMode]);
  
  // 收藏工具
  const favoriteTools = useMemo(() => {
    return favorites.map(favName => 
      tools.find(tool => tool.name === favName)
    ).filter(Boolean);
  }, [favorites, tools]);
  
  // 处理搜索
  const handleSearch = useCallback((e) => {
    setSearchQuery(e.target.value);
  }, []);
  
  // 处理分类选择
  const handleCategorySelect = useCallback((category) => {
    setSelectedCategory(category);
  }, []);
  
  // 处理工具选择
  const handleToolSelect = useCallback((tool) => {
    setSelectedTool(selectedTool?.name === tool.name ? null : tool);
  }, [selectedTool]);
  
  // 处理收藏
  const handleToggleFavorite = useCallback((toolName) => {
    setFavorites(prev => {
      const newFavorites = prev.includes(toolName)
        ? prev.filter(f => f !== toolName)
        : [...prev, toolName];
      
      localStorage.setItem('toolFavorites', JSON.stringify(newFavorites));
      return newFavorites;
    });
  }, []);
  
  // 处理分组展开/折叠
  const handleToggleGroup = useCallback((groupName) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  }, []);
  
  // 处理快速调用
  const handleQuickInvoke = useCallback((tool) => {
    setQuickInvokeTool(tool);
    setQuickInvokeParams({});
  }, []);
  
  // 处理快速调用参数变更
  const handleParamChange = useCallback((paramName, value) => {
    setQuickInvokeParams(prev => ({
      ...prev,
      [paramName]: value
    }));
  }, []);
  
  // 执行快速调用
  const executeQuickInvoke = useCallback(() => {
    if (!quickInvokeTool || !onQuickInvoke) return;
    
    // 更新使用统计
    setToolUsageStats(prev => {
      const newStats = {
        ...prev,
        [quickInvokeTool.name]: {
          count: (prev[quickInvokeTool.name]?.count || 0) + 1,
          lastUsed: Date.now()
        }
      };
      localStorage.setItem('toolUsageStats', JSON.stringify(newStats));
      return newStats;
    });
    
    onQuickInvoke(quickInvokeTool.name, quickInvokeParams);
    setQuickInvokeTool(null);
    setQuickInvokeParams({});
  }, [quickInvokeTool, quickInvokeParams, onQuickInvoke]);
  
  // 关闭快速调用面板
  const closeQuickInvoke = useCallback(() => {
    setQuickInvokeTool(null);
    setQuickInvokeParams({});
  }, []);
  
  // 获取分类图标
  const getCategoryIcon = (category) => {
    switch (category) {
      case 'filesystem':
        return '📁';
      case 'shell':
        return '💻';
      case 'git':
        return '🔀';
      case 'skills':
        return '🎯';
      case 'analysis':
        return '📊';
      case 'network':
        return '🌐';
      case 'general':
        return '🔧';
      default:
        return '📦';
    }
  };
  
  // 渲染工具详情
  const renderToolDetail = (tool) => {
    if (!tool) return null;
    
    const stats = toolUsageStats[tool.name] || { count: 0, lastUsed: null };
    
    return (
      <div style={styles.toolDetail}>
        <div style={styles.toolDetailTitle}>
          <span>{tool.name}</span>
          {favorites.includes(tool.name) && (
            <span style={styles.toolFavoriteIcon}>⭐</span>
          )}
        </div>
        
        <div style={styles.toolDetailSection}>
          <div style={styles.toolDetailLabel}>描述</div>
          <div style={styles.toolDetailContent}>
            {tool.description || '无描述'}
          </div>
        </div>
        
        {tool.parameters && Object.keys(tool.parameters).length > 0 && (
          <div style={styles.toolDetailSection}>
            <div style={styles.toolDetailLabel}>参数</div>
            <div style={styles.parameterList}>
              {Object.entries(tool.parameters).map(([name, param]) => (
                <div key={name} style={styles.parameterItem}>
                  <span style={styles.parameterName}>{name}</span>
                  <span style={styles.parameterType}>
                    {param.type || 'any'}
                  </span>
                  {tool.required?.includes(name) ? (
                    <span style={styles.parameterRequired}>必需</span>
                  ) : (
                    <span style={styles.parameterOptional}>可选</span>
                  )}
                  {param.description && (
                    <span style={styles.parameterDesc}>
                      {param.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div style={styles.toolDetailSection}>
          <div style={styles.toolDetailLabel}>元数据</div>
          <div style={styles.toolDetailContent}>
            <div style={styles.toolMeta}>
              <span>分类: {tool.category || 'general'}</span>
              <span>优先级: {tool.priority || 50}</span>
              <span>启用: {tool.enabled ? '✅' : '❌'}</span>
            </div>
          </div>
        </div>
        
        {/* 使用统计 */}
        <div style={styles.usageStats}>
          <div style={styles.usageStat}>
            <span style={styles.usageStatValue}>{stats.count}</span>
            <span style={styles.usageStatLabel}>调用次数</span>
          </div>
          <div style={styles.usageStat}>
            <span style={styles.usageStatValue}>
              {stats.lastUsed ? formatTime(stats.lastUsed) : '未使用'}
            </span>
            <span style={styles.usageStatLabel}>最后调用</span>
          </div>
        </div>
      </div>
    );
  };
  
  // 格式化时间
  const formatTime = (timestamp) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return `${Math.floor(diff / 86400000)}天前`;
  };
  
  // 渲染工具项
  const renderToolItem = (tool, isGrouped = false) => {
    const isSelected = selectedTool?.name === tool.name;
    const isHovered = hoveredTool === tool.name;
    const isFavorite = favorites.includes(tool.name);
    const stats = toolUsageStats[tool.name] || { count: 0 };
    
    return (
      <div
        key={tool.name}
        style={{
          ...styles.toolItem,
          ...(isSelected ? styles.toolItemSelected : {}),
          ...(isHovered && !isSelected ? styles.toolItemHover : {})
        }}
        onClick={() => handleToolSelect(tool)}
        onMouseEnter={() => setHoveredTool(tool.name)}
        onMouseLeave={() => setHoveredTool(null)}
      >
        <div style={styles.toolHeader}>
          <span style={styles.toolName}>
            <span 
              style={{
                ...styles.toolFavoriteIcon,
                color: isFavorite ? '#ffc107' : '#888888',
                cursor: 'pointer'
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleFavorite(tool.name);
              }}
              title={isFavorite ? '取消收藏' : '添加收藏'}
            >
              {isFavorite ? '⭐' : '☆'}
            </span>
            {tool.name}
          </span>
          
          <span style={styles.toolCategory}>
            <span>{getCategoryIcon(tool.category || 'general')}</span>
            <span>{tool.category || 'general'}</span>
          </span>
        </div>
        
        <div style={styles.toolDescription}>
          {tool.description || '无描述'}
        </div>
        
        <div style={styles.toolMeta}>
          <div style={styles.toolStatus}>
            <span style={tool.enabled ? styles.statusEnabled : styles.statusDisabled}>
              {tool.enabled ? '✅' : '❌'}
            </span>
            <span>{tool.enabled ? '已启用' : '已禁用'}</span>
          </div>
          
          <span>
            参数: {tool.parameters ? Object.keys(tool.parameters).length : 0}
          </span>
          
          {stats.count > 0 && (
            <span>
              调用: {stats.count}次
            </span>
          )}
        </div>
        
        {/* 操作按钮 */}
        <div style={{
          ...styles.toolActions,
          ...(isHovered ? styles.toolActionsVisible : {})
        }}>
          <button
            style={styles.actionButton}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleFavorite(tool.name);
            }}
            title={isFavorite ? '取消收藏' : '添加收藏'}
          >
            {isFavorite ? '⭐ 取消收藏' : '☆ 收藏'}
          </button>
          
          <button
            style={{ ...styles.actionButton, ...styles.actionButtonPrimary }}
            onClick={(e) => {
              e.stopPropagation();
              handleQuickInvoke(tool);
            }}
            title="快速调用此工具"
          >
            ⚡ 快速调用
          </button>
          
          <button
            style={styles.actionButton}
            onClick={(e) => {
              e.stopPropagation();
              handleToolSelect(tool);
            }}
            title="查看详情"
          >
            {isSelected ? '📖 隐藏详情' : '📖 详情'}
          </button>
        </div>
        
        {/* 工具详情 */}
        {isSelected && renderToolDetail(tool)}
      </div>
    );
  };
  
  // 渲染分组标题
  const renderGroupHeader = (groupName, group) => (
    <div
      key={`group-${groupName}`}
      style={styles.groupHeader}
      onClick={() => handleToggleGroup(groupName)}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#16213e'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0f3460'}
    >
      <span style={styles.groupIcon}>{group.icon}</span>
      <span style={styles.groupTitle}>{group.name}</span>
      <span style={styles.groupCount}>{group.tools.length} 个工具</span>
      <span style={styles.groupExpandIcon}>
        {expandedGroups.has(groupName) ? '▼' : '▶'}
      </span>
    </div>
  );
  
  // 渲染加载状态
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner}></div>
          <div style={styles.loadingText}>加载工具列表...</div>
        </div>
      </div>
    );
  }
  
  // 渲染空状态
  if (tools.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyContainer}>
          <div style={styles.emptyIcon}>🔧</div>
          <div style={styles.emptyText}>暂无可用工具</div>
          <div style={styles.emptyHint}>
            工具将在 Runtime 初始化后加载
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div style={styles.container}>
      {/* 搜索和视图切换 */}
      <div style={styles.header}>
        <div style={styles.searchContainer}>
          <input
            type="text"
            style={{
              ...styles.searchInput,
              ...(isSearchFocused ? styles.searchInputFocused : {})
            }}
            value={searchQuery}
            onChange={handleSearch}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="🔍 搜索工具..."
          />
          
          <div style={styles.viewToggle}>
            <button
              style={{
                ...styles.viewButton,
                ...(viewMode === 'list' ? styles.viewButtonActive : {})
              }}
              onClick={() => setViewMode('list')}
              title="列表视图"
            >
              📋
            </button>
            <button
              style={{
                ...styles.viewButton,
                ...(viewMode === 'grouped' ? styles.viewButtonActive : {})
              }}
              onClick={() => setViewMode('grouped')}
              title="分组视图"
            >
              📁
            </button>
          </div>
        </div>
      </div>
      
      {/* 收藏栏 */}
      {favorites.length > 0 && (
        <div style={styles.favoritesBar}>
          <span style={styles.favoritesTitle}>⭐ 收藏夹:</span>
          {favoriteTools.map(tool => (
            <button
              key={tool.name}
              style={styles.favoriteButton}
              onClick={() => handleQuickInvoke(tool)}
              title={`快速调用 ${tool.name}`}
            >
              <span>{getCategoryIcon(tool.category || 'general')}</span>
              <span>{tool.name}</span>
            </button>
          ))}
        </div>
      )}
      
      {/* 分类过滤 */}
      <div style={styles.categoryFilter}>
        {categories.map(([catKey, catInfo]) => (
          <button
            key={catKey}
            style={{
              ...styles.categoryButton,
              ...(selectedCategory === catKey ? styles.categoryButtonActive : {})
            }}
            onClick={() => handleCategorySelect(catKey)}
          >
            <span>{catInfo.icon}</span>
            <span>{catInfo.name}</span>
            <span style={styles.categoryCount}>{catInfo.count}</span>
          </button>
        ))}
      </div>
      
      {/* 统计信息 */}
      <div style={{ padding: '8px' }}>
        <div style={styles.statsContainer}>
          <div style={styles.statsRow}>
            <span>总工具数:</span>
            <span style={styles.statsValue}>{tools.length}</span>
          </div>
          <div style={styles.statsRow}>
            <span>当前显示:</span>
            <span style={styles.statsValue}>{filteredTools.length}</span>
          </div>
          <div style={styles.statsRow}>
            <span>收藏数量:</span>
            <span style={styles.statsValue}>{favorites.length}</span>
          </div>
        </div>
      </div>
      
      {/* 工具列表 */}
      <div style={styles.toolList}>
        {/* 分组视图 */}
        {viewMode === 'grouped' && groupedTools && (
          Object.entries(groupedTools).map(([groupName, group]) => (
            <React.Fragment key={groupName}>
              {renderGroupHeader(groupName, group)}
              {expandedGroups.has(groupName) && (
                group.tools.map(tool => renderToolItem(tool, true))
              )}
            </React.Fragment>
          ))
        )}
        
        {/* 列表视图 */}
        {viewMode === 'list' && (
          filteredTools.map(tool => renderToolItem(tool))
        )}
        
        {/* 无匹配工具 */}
        {filteredTools.length === 0 && tools.length > 0 && (
          <div style={styles.emptyContainer}>
            <div style={styles.emptyIcon}>🔍</div>
            <div style={styles.emptyText}>没有找到匹配的工具</div>
            <div style={styles.emptyHint}>
              尝试更改搜索条件或分类
            </div>
          </div>
        )}
      </div>
      
      {/* 快速调用面板 */}
      {quickInvokeTool && (
        <div style={styles.quickInvokePanel}>
          <div style={styles.quickInvokeHeader}>
            <div style={styles.quickInvokeTitle}>
              <span>⚡</span>
              <span>快速调用: {quickInvokeTool.name}</span>
            </div>
            <button
              style={styles.quickInvokeClose}
              onClick={closeQuickInvoke}
            >
              ✖️
            </button>
          </div>
          
          <div style={styles.quickInvokeForm}>
            <div style={styles.toolDetailLabel}>描述</div>
            <div style={{
              fontSize: '12px',
              color: '#888888',
              marginBottom: '12px'
            }}>
              {quickInvokeTool.description || '无描述'}
            </div>
            
            {quickInvokeTool.parameters && Object.keys(quickInvokeTool.parameters).length > 0 && (
              <>
                <div style={styles.toolDetailLabel}>参数</div>
                {Object.entries(quickInvokeTool.parameters).map(([name, param]) => (
                  <div key={name} style={{ marginBottom: '8px' }}>
                    <div style={{
                      fontSize: '12px',
                      color: '#888888',
                      marginBottom: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{ color: '#e94560' }}>{name}</span>
                      <span>({param.type || 'any'})</span>
                      {quickInvokeTool.required?.includes(name) && (
                        <span style={styles.parameterRequired}>必需</span>
                      )}
                    </div>
                    {param.type === 'string' && param.description?.includes('\n') ? (
                      <textarea
                        style={styles.quickInvokeTextarea}
                        value={quickInvokeParams[name] || ''}
                        onChange={(e) => handleParamChange(name, e.target.value)}
                        placeholder={param.description || `输入 ${name}`}
                      />
                    ) : (
                      <input
                        style={styles.quickInvokeInput}
                        value={quickInvokeParams[name] || ''}
                        onChange={(e) => handleParamChange(name, e.target.value)}
                        placeholder={param.description || `输入 ${name}`}
                      />
                    )}
                  </div>
                ))}
              </>
            )}
            
            <div style={styles.quickInvokeButtons}>
              <button
                style={{ ...styles.actionButton, flex: 1 }}
                onClick={closeQuickInvoke}
              >
                取消
              </button>
              <button
                style={{ ...styles.actionButton, ...styles.actionButtonPrimary, flex: 2 }}
                onClick={executeQuickInvoke}
              >
                ⚡ 执行
              </button>
            </div>
          </div>
        </div>
      )}
      
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

export default ToolPanel;