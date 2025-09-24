import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { SlackMessage } from "../types/monitoring";
import "../css/ErrorTable.css";

interface ErrorTableProps {
  messages: SlackMessage[];
  scrollToTs?: string;
  readMessages?: Set<string>;
  onMarkAsRead?: (channelCode: string, messageTs: string) => void;
  channelCode?: string;
  showStats?: boolean;
  maxDisplayItems?: number;
}

interface MessageStats {
  totalMessages: number;
  errorMessages: number;
  delayedMessages: number;
  criticalMessages: number;
  unreadMessages: number;
  severityDistribution: Record<string, number>;
}

// 메시지 심각도 분류
function getMessageSeverity(text: string): 'low' | 'medium' | 'high' | 'critical' {
  if (!text) return 'low';
  
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('critical') || lowerText.includes('fatal') || lowerText.includes('panic')) {
    return 'critical';
  } else if (lowerText.includes('error') || lowerText.includes('exception') || lowerText.includes('failed')) {
    return 'high';
  } else if (lowerText.includes('warning') || lowerText.includes('warn')) {
    return 'medium';
  }
  
  return 'low';
}

// 메시지 타입 분류
function getMessageType(text: string): 'error' | 'delayed' | 'warning' | 'info' {
  if (!text) return 'info';
  
  if (text.includes('[DELAYED]')) return 'delayed';
  
  const lowerText = text.toLowerCase();
  if (lowerText.includes('error') || lowerText.includes('exception') || 
      lowerText.includes('failed') || lowerText.includes('critical') || 
      lowerText.includes('fatal')) {
    return 'error';
  } else if (lowerText.includes('warning') || lowerText.includes('warn')) {
    return 'warning';
  }
  
  return 'info';
}

// 메시지 요약 생성
function summarizeMessage(text: string, maxLength: number = 100): { summary: string; isTruncated: boolean } {
  if (!text || text.length <= maxLength) {
    return { summary: text || '', isTruncated: false };
  }
  
  const truncated = text.slice(0, maxLength).trim();
  const lastSpace = truncated.lastIndexOf(' ');
  const summary = lastSpace > maxLength * 0.7 ? truncated.slice(0, lastSpace) : truncated;
  
  return { summary: summary + '...', isTruncated: true };
}

export default function ErrorTable({ 
  messages, 
  scrollToTs,
  readMessages = new Set(),
  onMarkAsRead,
  channelCode,
  showStats = true,
  maxDisplayItems = 1000
}: ErrorTableProps) {
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'severity'>('newest');
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [filterType, setFilterType] = useState<'all' | 'error' | 'delayed' | 'warning' | 'info'>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  
  const rowRefs = useRef<{ [ts: string]: HTMLTableRowElement | null }>({});
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  const pageSize = 50;

  useEffect(() => {
    if (scrollToTs && rowRefs.current[scrollToTs]) {
      const element = rowRefs.current[scrollToTs];
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ 
            behavior: "smooth", 
            block: "center",
            inline: "nearest"
          });
          
          element.classList.add('highlighted');
          setTimeout(() => element.classList.remove('highlighted'), 2000);
          
          if (onMarkAsRead && channelCode && scrollToTs) {
            setTimeout(() => {
              onMarkAsRead(channelCode, scrollToTs);
            }, 500);
          }
        }, 100);
      }
    }
  }, [scrollToTs, onMarkAsRead, channelCode]);

  const handleRowClick = useCallback((messageTs: string, event: React.MouseEvent) => {
    if (!(event.target as HTMLElement).closest('.expand-button')) {
      if (onMarkAsRead && channelCode && !readMessages.has(messageTs)) {
        onMarkAsRead(channelCode, messageTs);
      }
    }
  }, [onMarkAsRead, channelCode, readMessages]);

  const toggleMessageExpansion = useCallback((messageTs: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageTs)) {
        newSet.delete(messageTs);
      } else {
        newSet.add(messageTs);
      }
      return newSet;
    });
  }, []);

  const stats: MessageStats = useMemo(() => {
    const totalMessages = messages.length;
    const unreadMessages = messages.filter(msg => msg.ts && !readMessages.has(msg.ts)).length;
    
    let errorMessages = 0;
    let delayedMessages = 0;
    let criticalMessages = 0;
    const severityDistribution: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    
    messages.forEach(msg => {
      const type = getMessageType(msg.text || '');
      const severity = getMessageSeverity(msg.text || '');
      
      if (type === 'error') errorMessages++;
      if (type === 'delayed') delayedMessages++;
      if (severity === 'critical') criticalMessages++;
      
      severityDistribution[severity]++;
    });
    
    return {
      totalMessages,
      errorMessages,
      delayedMessages,
      criticalMessages,
      unreadMessages,
      severityDistribution
    };
  }, [messages, readMessages]);

  const filteredAndSortedMessages = useMemo(() => {
    let filtered = messages.filter(msg => {
      if (showUnreadOnly && msg.ts && readMessages.has(msg.ts)) {
        return false;
      }
      
      if (filterSeverity !== 'all') {
        const severity = getMessageSeverity(msg.text || '');
        if (severity !== filterSeverity) return false;
      }
      
      if (filterType !== 'all') {
        const type = getMessageType(msg.text || '');
        if (type !== filterType) return false;
      }
      
      return true;
    });

    filtered.sort((a, b) => {
      if (sortOrder === 'newest') {
        return Number(b.ts ?? 0) - Number(a.ts ?? 0);
      } else if (sortOrder === 'oldest') {
        return Number(a.ts ?? 0) - Number(b.ts ?? 0);
      } else if (sortOrder === 'severity') {
        const severityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
        const aSeverity = getMessageSeverity(a.text || '');
        const bSeverity = getMessageSeverity(b.text || '');
        const diff = severityOrder[bSeverity] - severityOrder[aSeverity];
        return diff !== 0 ? diff : Number(b.ts ?? 0) - Number(a.ts ?? 0);
      }
      return 0;
    });

    return filtered.slice(0, maxDisplayItems);
  }, [messages, readMessages, showUnreadOnly, filterSeverity, filterType, sortOrder, maxDisplayItems]);

  const totalPages = Math.ceil(filteredAndSortedMessages.length / pageSize);
  const paginatedMessages = filteredAndSortedMessages.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  useEffect(() => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTop = 0;
    }
  }, [currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterSeverity, filterType, showUnreadOnly, sortOrder]);

  if (!messages || messages.length === 0) {
    return (
      <div className="empty-container">
        <div className="empty-icon">✅</div>
        <div className="empty-title">All Clear!</div>
        <div className="empty-subtitle">No recent errors detected in this channel</div>
      </div>
    );
  }

  return (
    <div className="error-table-container">

      {/* 통계 섹션 */}
      {showStats && (
        <div className="stats-header">
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value">{stats.totalMessages}</div>
              <div className="stat-label">Total</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.unreadMessages}</div>
              <div className="stat-label">Unread</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.criticalMessages}</div>
              <div className="stat-label">Critical</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.errorMessages}</div>
              <div className="stat-label">Errors</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.delayedMessages}</div>
              <div className="stat-label">Delayed</div>
            </div>
          </div>
        </div>
      )}

      {/* 컨트롤 섹션 */}
      <div className="controls-section">
        <div className="control-group">
          <span className="control-label">Sort:</span>
          <select 
            className="control-select"
            value={sortOrder} 
            onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="severity">By Severity</option>
          </select>
        </div>

        <div className="control-group">
          <span className="control-label">Severity:</span>
          <select 
            className="control-select"
            value={filterSeverity} 
            onChange={(e) => setFilterSeverity(e.target.value as typeof filterSeverity)}
          >
            <option value="all">All Levels</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="control-group">
          <span className="control-label">Type:</span>
          <select 
            className="control-select"
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value as typeof filterType)}
          >
            <option value="all">All Types</option>
            <option value="error">Errors</option>
            <option value="delayed">Delayed</option>
            <option value="warning">Warnings</option>
            <option value="info">Info</option>
          </select>
        </div>

        <label className="control-checkbox">
          <input
            type="checkbox"
            checked={showUnreadOnly}
            onChange={(e) => setShowUnreadOnly(e.target.checked)}
          />
          <span className="control-label">Unread Only</span>
        </label>
      </div>

      {/* 테이블 */}
      <div className="table-wrapper" ref={tableContainerRef}>
        <table className="error-table">
          <thead className="table-header">
            <tr>
              <th className="header-cell" style={{ width: '140px' }}>Timestamp</th>
              <th className="header-cell">Message Details</th>
            </tr>
          </thead>
          <tbody>
            {paginatedMessages.map((msg, i) => {
              const isRead = msg.ts ? readMessages.has(msg.ts) : false;
              const isFocused = scrollToTs === msg.ts;
              const severity = getMessageSeverity(msg.text || '');
              const type = getMessageType(msg.text || '');
              const isExpanded = msg.ts ? expandedMessages.has(msg.ts) : false;
              const { summary, isTruncated } = summarizeMessage(msg.text || '', 150);

              return (
                <tr
                  key={msg.ts || i}
                  ref={el => { 
                    if (msg.ts) {
                      rowRefs.current[msg.ts] = el; 
                    }
                  }}
                  className={`table-row ${isRead ? 'read' : ''} ${isFocused ? 'highlighted' : ''} severity-${severity} type-${type}`}
                  onClick={(e) => msg.ts && handleRowClick(msg.ts, e)}
                  title="Click to mark as read"
                >
                  <td className={`table-cell timestamp-cell ${isRead ? 'read' : ''}`}>
                    {isRead && (
                      <div className="read-indicator">
                        <span>✓</span>
                        <span>Read</span>
                      </div>
                    )}
                    <div>
                      {msg.ts ? new Date(Number(msg.ts) * 1000).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      }) : "-"}
                    </div>
                  </td>
                  
                  <td className={`table-cell message-cell ${isRead ? 'read' : ''}`}>
                    <div className="message-badges">
                      <span className={`severity-badge severity-${severity}`}>
                        {severity}
                      </span>
                      <span className={`type-badge type-${type}`}>
                        {type}
                      </span>
                    </div>
                    
                    <div className="message-content">
                      {isExpanded ? (msg.text || '') : summary}
                    </div>
                    
                    {isTruncated && (
                      <button
                        className="expand-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (msg.ts) toggleMessageExpansion(msg.ts);
                        }}
                      >
                        {isExpanded ? 'Show Less' : 'Show More'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="pagination">
          <div className="pagination-info">
            Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredAndSortedMessages.length)} of {filteredAndSortedMessages.length} messages
          </div>
          <div className="pagination-controls">
            <button
              className="pagination-button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            >
              Previous
            </button>
            
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  className={`pagination-button ${pageNum === currentPage ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
            
            <button
              className="pagination-button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}