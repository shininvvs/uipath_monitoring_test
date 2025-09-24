import React from "react";
import { Channel, SlackMessage } from "../types/monitoring";
import { useDashboard } from "../hooks/useDashboard";
import ChannelCard from "./ChannelCard";
import "../css/DashboardPanel.css";

interface DashboardPanelProps {
  allChannels: Channel[];
  errorMessagesByChannel: Record<string, SlackMessage[]>;
  readMessages: Set<string>;
  delayedErrors: Record<string, SlackMessage[]>;
  onChannelCardClick?: (code: string, ts?: string) => void;
  onMarkAsRead?: (channelCode: string, messageTs: string) => void;
}

export default function DashboardPanel({
  allChannels,
  errorMessagesByChannel,
  readMessages,
  delayedErrors,
  onChannelCardClick,
  onMarkAsRead,
}: DashboardPanelProps) {
  const {
    search,
    setSearch,
    filteredChannels,
    handleChannelClick,
    handleMarkAllAsRead,
    totalUnreadCount,
    getChannelStats
  } = useDashboard({
    allChannels,
    errorMessagesByChannel,
    readMessages,
    delayedErrors,
    onChannelCardClick,
    onMarkAsRead,
  });

  // 전체 통계 계산
  const dashboardStats = React.useMemo(() => {
    let totalActiveWorks = 0;
    let totalCompletedWorks = 0;
    let totalErrors = 0;
    let channelsWithWork = 0;

    filteredChannels.forEach(channel => {
      const stats = getChannelStats(channel.code);
      if (stats.hasActiveWork) {
        channelsWithWork++;
        if (stats.isInProgress) totalActiveWorks++;
        if (!stats.isInProgress && stats.completedCount > 0) totalCompletedWorks++;
        totalErrors += stats.errorCount;
      }
    });

    return {
      totalActiveWorks,
      totalCompletedWorks,
      totalErrors,
      channelsWithWork,
      totalChannels: allChannels.length,
      totalIssueChannels: filteredChannels.length
    };
  }, [filteredChannels, allChannels.length, getChannelStats]);

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1 className="dashboard-title">UiPath Monitoring Service</h1>
          <div className="header-stats">
            <div className="stat-item">
              <span className="stat-label">Total Channels</span>
              <span className="stat-value">{dashboardStats.totalChannels}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Active Issues</span>
              <span className="stat-value error">{dashboardStats.totalIssueChannels}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Active Works</span>
              <span className="stat-value progress">{dashboardStats.totalActiveWorks}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total Errors</span>
              <span className="stat-value error">{dashboardStats.totalErrors}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="dashboard-controls">
        <div className="controls-left">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search channels..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="clear-search-button"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="quick-filters">
            <span className="filter-label">Quick:</span>
            <button
              onClick={() => setSearch("")}
              className={`filter-button ${search === "" ? "active" : ""}`}
            >
              All
            </button>
            <button
              onClick={() => setSearch("진행")}
              className={`filter-button ${search === "진행" ? "active" : ""}`}
            >
              In Progress
            </button>
            <button
              onClick={() => setSearch("에러")}
              className={`filter-button ${search === "에러" ? "active" : ""}`}
            >
              Errors
            </button>
          </div>
        </div>

        <button
          onClick={handleMarkAllAsRead}
          className="mark-all-button"
          disabled={totalUnreadCount === 0}
          title={`Mark all ${totalUnreadCount} unread messages as read`}
        >
          <span className="button-icon">✓</span>
          <span>Mark All Read ({totalUnreadCount})</span>
        </button>
      </div>

      {/* Summary Banner */}
      {dashboardStats.channelsWithWork > 0 && (
        <div className="summary-banner">
          <div className="summary-content">
            <div className="summary-icon">⚡</div>
            <div className="summary-text">
              <div className="summary-main">
                {dashboardStats.channelsWithWork}개 채널에서 작업 진행 중
              </div>
              <div className="summary-details">
                활성 작업: {dashboardStats.totalActiveWorks}개 • 
                완료 작업: {dashboardStats.totalCompletedWorks}개 • 
                총 에러: {dashboardStats.totalErrors}개
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Channel Cards */}
      <div className="cards-container">
        {filteredChannels.length === 0 && allChannels.length > 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎉</div>
            <h3>All Clear!</h3>
            <p>No unread error messages found. Great job keeping things under control!</p>
            {search && (
              <div className="empty-search-help">
                <p>검색어 <span>&quot;{search}&quot;</span>에 해당하는 채널이 없습니다.</p>
                <button
                  onClick={() => setSearch("")}
                  className="clear-search-button-large"
                >
                  모든 채널 보기
                </button>
              </div>
            )}
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No channels available</h3>
            <p>Please configure your Slack integration to start monitoring channels.</p>
          </div>
        ) : (
          <div className="cards-grid">
            {filteredChannels.map((channel) => (
              <ChannelCard
                key={channel.code}
                channel={channel}
                errorMessages={errorMessagesByChannel[channel.code] || []}
                delayedMessages={delayedErrors[channel.code] || []}
                readMessages={readMessages}
                onClick={handleChannelClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Results Summary */}
      {filteredChannels.length > 0 && (
        <div className="results-summary">
          <div className="results-text">
            Showing {filteredChannels.length} of {allChannels.length} channels
            {search && <span> for &quot;{search}&quot;</span>}
          </div>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="show-all-button"
            >
              Show All Channels
            </button>
          )}
        </div>
      )}
    </div>
  );
}
