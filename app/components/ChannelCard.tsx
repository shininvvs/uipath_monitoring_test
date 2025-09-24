import React from "react";
import { Channel, SlackMessage } from "../types/monitoring";
import { useChannelCard } from "../hooks/useChannelCard";
import "../css/ChannelCard.css";

interface ChannelCardProps {
  channel: Channel;
  errorMessages: SlackMessage[];
  delayedMessages: SlackMessage[];
  readMessages: Set<string>;
  onClick: (channelCode: string, messageTs?: string) => void;
}

export default function ChannelCard({
  channel,
  errorMessages,
  delayedMessages,
  readMessages,
  onClick,
}: ChannelCardProps) {
  const {
    progressRate,
    progressStatus,
    errorCount,
    progressCount,
    unreadMessages,
    latestMessage,
    cardStatus,
    formatTime,
    workProgress,
  } = useChannelCard({
    channel,
    errorMessages,
    delayedMessages,
    readMessages,
  });

  const handleCardClick = () => {
    onClick(channel.code, latestMessage?.ts);
  };

  // 카드 상태에 따른 추가 클래스
  const getCardStateClass = () => {
    if (workProgress?.isInProgress) return 'in-progress';
    if (workProgress?.errorCount > 0) return 'has-errors';
    if (workProgress?.endMessage) return 'completed';
    return cardStatus;
  };

  // 진행률 바 색상 결정
  const getProgressBarColor = () => {
    if (workProgress?.errorCount > 0) return 'error-progress';
    if (workProgress?.isInProgress) return 'active-progress';
    if (workProgress?.endMessage) return 'completed-progress';
    return 'normal-progress';
  };

  return (
    <div 
      className={`channel-card ${cardStatus} ${getCardStateClass()}`}
      onClick={handleCardClick}
    >
      {/* Card Header */}
      <div className="card-header">
        <div className="channel-info">
          <h3 className="channel-name">{channel.name}</h3>
          <span className="channel-code">{channel.code}</span>
          {/* 작업 중인 클라이언트 표시 */}
          {workProgress?.client && (
            <span className="client-badge">{workProgress.client}</span>
          )}
        </div>
        <div className="status-indicator">
          {cardStatus === 'delayed' && <span className="status-icon delayed">⏰</span>}
          {cardStatus === 'error' && <span className="status-icon error">🚨</span>}
          {cardStatus === 'normal' && workProgress?.isInProgress && <span className="status-icon progress">⚡</span>}
          {cardStatus === 'normal' && workProgress?.endMessage && <span className="status-icon success">✅</span>}
          {cardStatus === 'normal' && !workProgress?.startMessage && <span className="status-icon idle">⏸️</span>}
        </div>
      </div>

      {/* Progress Section */}
      <div className="progress-section">
        <div className="progress-header">
          <span className="progress-label">Status</span>
          <span className={`progress-status ${workProgress?.isInProgress ? 'active' : ''}`}>
            {progressStatus}
          </span>
        </div>
        <div className="progress-bar">
          <div 
            className={`progress-fill ${getProgressBarColor()}`}
            style={{ width: `${Math.min(progressRate, 100)}%` }}
          />
        </div>
        {/* 작업 세부 정보 */}
        {workProgress?.startMessage && (
          <div className="progress-details">
            {workProgress.requestCount > 0 && (
              <span className="detail-item">
                목표: {workProgress.requestCount}건
              </span>
            )}
            {workProgress.isInProgress && (
              <span className="detail-item active">
                진행 중
              </span>
            )}
          </div>
        )}
      </div>

      {/* Stats Section */}
      <div className="stats-section">
        <div className="stat-item">
          <div className={`stat-value error-count ${errorCount > 0 ? 'has-value' : ''}`}>
            {errorCount}
          </div>
          <div className="stat-label">Errors</div>
        </div>
        <div className="stat-item">
          <div className={`stat-value progress-count ${progressCount > 0 ? 'has-value' : ''}`}>
            {progressCount}
          </div>
          <div className="stat-label">Completed</div>
        </div>
        <div className="stat-item">
          <div className={`stat-value unread-count ${unreadMessages.length > 0 ? 'has-value' : ''}`}>
            {unreadMessages.length}
          </div>
          <div className="stat-label">Unread</div>
        </div>
      </div>

      {/* Work Session Summary (작업이 있을 때만) */}
      {workProgress?.startMessage && (
        <div className="work-session-summary">
          <div className="session-header">
            <span>작업 세션</span>
            {workProgress.startMessage.ts && (
              <span className="session-time">
                {formatTime(workProgress.startMessage.ts)}
              </span>
            )}
          </div>
          <div className="session-stats">
            {workProgress.isInProgress && (
              <span className="session-stat in-progress">
                진행 중 • {workProgress.requestCount - workProgress.errorCount}건 예상 완료
              </span>
            )}
            {workProgress.endMessage && (
              <span className="session-stat completed">
                완료 • {workProgress.completedCount}/{workProgress.requestCount}건 처리
              </span>
            )}
            {workProgress.errorCount > 0 && (
              <span className="session-stat errors">
                {workProgress.errorCount}건 에러 발생
              </span>
            )}
          </div>
        </div>
      )}

      {/* Latest Message Preview */}
      {latestMessage && (
        <div className="message-preview">
          <div className="message-text">
            {latestMessage.text?.slice(0, 80) || "No message content"}
            {latestMessage.text && latestMessage.text.length > 80 && "..."}
          </div>
          <div className="message-time">
            {formatTime(latestMessage.ts)}
          </div>
        </div>
      )}

      {/* Badges for delayed messages */}
      {delayedMessages.length > 0 && (
        <div className="card-badges">
          <span className="delayed-badge">
            {delayedMessages.length} Delayed
          </span>
        </div>
      )}

      {/* Work Progress Badge */}
      {workProgress?.isInProgress && (
        <div className="card-badges">
          <span className="progress-badge">
            진행 중
          </span>
        </div>
      )}
    </div>
  );
}