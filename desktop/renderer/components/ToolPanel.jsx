/**
 * 工具面板组件
 * 显示可用工具列表及其信息
 */

import React, { useState, useCallback } from 'react';

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
  
  searchInput: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #0f3460',
    backgroundColor: '#1a1a2e',
    color: '#eaeaea',
    fontSize: '13px'
  },
  
  categoryFilter: {
    display: 'flex',
    gap: '4px',
    marginTop: '8px',
    flexWrap: 'wrap'
  },
  
  categoryButton: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#0f3460',
    color: '#eaeaea',
    cursor: 'pointer',
    fontSize: '11px'
  },
  
  activeCategoryButton: {
    backgroundColor: '#e94560',
    color: '#ffffff'
  },
  
  toolList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px'
  },
  
  toolItem: {
    padding: '12px',
    borderRadius: '6px',
    backgroundColor: '#1a1a2e',
    marginBottom: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: '1px solid transparent'
  },
  
  toolItemHover: {
    border: '1px solid #e94560'
  },
  
  toolHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px'
  },
  
  toolName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#e94560'
  },
  
  toolCategory: {
    fontSize: '11px',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: '#0f3460',
    color: '#eaeaea'
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
  
  toolDetail: {
    padding: '16px',
    backgroundColor: '#16213e',
    borderRadius: '8px',
    marginTop: '8px'
  },
  
  toolDetailTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#e94560',
    marginBottom: '12px'
  },
  
  toolDetailSection: {
    marginBottom: '12px'
  },
  
  toolDetailLabel: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#eaeaea',
    marginBottom: '4px'
  },
  
  toolDetailContent: {
    fontSize: '12px',
    color: '#888888',
    padding: '8px',
    borderRadius: '4px',
    backgroundColor: '#1a1a2e'
  },
  
  parameterList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  
  parameterItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px'
  },
  
  parameterName: {
    color: '#e94560',
    fontWeight: '500'
  },
  
  parameterType: {
    color: '#888888',
    fontSize: '11px'
  },
  
  parameterRequired: {
    color: '#ffc107',
    fontSize: '11px'
  },
  
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: '#888888'
  },
  
  emptyContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: '#888888',
    fontSize: '14px'
  },
  
  statsContainer: {
    padding: '12px',
    backgroundColor: '#16213e',
    borderRadius: '6px',
    marginBottom: '8px'
  },
  
  statsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#888888'
  }
};

/**
 * 工具面板组件
 * @param {Object} props - 组件属性
 * @param {Array} props.tools - 工具列表
 * @param {boolean} props.loading - 是否正在加载
 */
function ToolPanel({ tools, loading }) {
  // 状态
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTool, setSelectedTool] = useState(null);
  
  // 获取所有分类
  const categories = React.useMemo(() => {
    const cats = new Set();
    tools.forEach(tool => {
      if (tool.category) {
        cats.add(tool.category);
      }
    });
    return ['all', ...Array.from(cats)];
  }, [tools]);
  
  // 过滤工具
  const filteredTools = React.useMemo(() => {
    return tools.filter(tool => {
      // 分类过滤
      if (selectedCategory !== 'all' && tool.category !== selectedCategory) {
        return false;
      }
      
      // 搜索过滤
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          tool.name.toLowerCase().includes(query) ||
          tool.description?.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [tools, selectedCategory, searchQuery]);
  
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
  
  // 渲染工具详情
  const renderToolDetail = (tool) => {
    if (!tool) return null;
    
    return (
      <div style={styles.toolDetail}>
        <div style={styles.toolDetailTitle}>
          {tool.name}
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
            <div style={styles.toolDetailContent}>
              <div style={styles.parameterList}>
                {Object.entries(tool.parameters).map(([name, param]) => (
                  <div key={name} style={styles.parameterItem}>
                    <span style={styles.parameterName}>{name}</span>
                    <span style={styles.parameterType}>
                      {param.type || 'any'}
                    </span>
                    {tool.required?.includes(name) && (
                      <span style={styles.parameterRequired}>
                        必需
                      </span>
                    )}
                    {param.description && (
                      <span style={{ color: '#666666', marginLeft: '8px' }}>
                        - {param.description}
                      </span>
                    )}
                  </div>
                ))}
              </div>
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
      </div>
    );
  };
  
  // 渲染加载状态
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div>🔄 加载工具列表...</div>
        </div>
      </div>
    );
  }
  
  // 渲染空状态
  if (tools.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyContainer}>
          <div>暂无可用工具</div>
        </div>
      </div>
    );
  }
  
  return (
    <div style={styles.container}>
      {/* 搜索和过滤 */}
      <div style={styles.header}>
        <input
          type="text"
          style={styles.searchInput}
          value={searchQuery}
          onChange={handleSearch}
          placeholder="🔍 搜索工具..."
        />
        
        <div style={styles.categoryFilter}>
          {categories.map(category => (
            <button
              key={category}
              style={{
                ...styles.categoryButton,
                ...(selectedCategory === category ? styles.activeCategoryButton : {})
              }}
              onClick={() => handleCategorySelect(category)}
            >
              {category === 'all' ? '全部' : category}
            </button>
          ))}
        </div>
      </div>
      
      {/* 统计信息 */}
      <div style={{ padding: '8px' }}>
        <div style={styles.statsContainer}>
          <div style={styles.statsRow}>
            <span>总工具数: {tools.length}</span>
            <span>当前显示: {filteredTools.length}</span>
          </div>
        </div>
      </div>
      
      {/* 工具列表 */}
      <div style={styles.toolList}>
        {filteredTools.map(tool => (
          <div
            key={tool.name}
            style={{
              ...styles.toolItem,
              ...(selectedTool?.name === tool.name ? styles.toolItemHover : {})
            }}
            onClick={() => handleToolSelect(tool)}
          >
            <div style={styles.toolHeader}>
              <span style={styles.toolName}>
                {tool.name}
              </span>
              <span style={styles.toolCategory}>
                {tool.category || 'general'}
              </span>
            </div>
            
            <div style={styles.toolDescription}>
              {tool.description || '无描述'}
            </div>
            
            <div style={styles.toolMeta}>
              <span>
                参数: {tool.parameters ? Object.keys(tool.parameters).length : 0}
              </span>
              <span>
                必需: {tool.required?.length || 0}
              </span>
            </div>
            
            {/* 工具详情 */}
            {selectedTool?.name === tool.name && renderToolDetail(tool)}
          </div>
        ))}
        
        {filteredTools.length === 0 && (
          <div style={styles.emptyContainer}>
            <div>没有找到匹配的工具</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ToolPanel;