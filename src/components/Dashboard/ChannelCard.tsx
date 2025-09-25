import React, { useState } from 'react';
import { Channel, ChannelStatus, ChannelCardProps } from '../../types/channel';
import { StatusIndicator } from './StatusIndicator';
import styles from './styles/ChannelCard.module.css';

export const ChannelCard: React.FC<ChannelCardProps> = ({ channel, onReset }) => {
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (!onReset || isResetting) return;
    
    setIsResetting(true);
    try {
      await onReset(channel.id);
    } finally {
      setIsResetting(false);
    }
  };

  const getProgressPercentage = (): number => {
    if (channel.requestCount === 0) return 0;
    return Math.round((channel.completedCount / channel.requestCount) * 100);
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const isError = channel.hasError || channel.status === ChannelStatus.ERROR;
  const isTimeout = channel.status === ChannelStatus.TIMEOUT;

  return (
    <div className={`${styles.channelCard} ${isError ? styles.error : ''} ${isTimeout ? styles.timeout : ''}`}>
      <div className={styles.header}>
        <div className={styles.channelInfo}>
          <h3 className={styles.channelName}>{channel.name}</h3>
          <StatusIndicator status={channel.status} />
        </div>
        
        {channel.status !== ChannelStatus.IDLE && (
          <button
            className={styles.resetButton}
            onClick={handleReset}
            disabled={isResetting}
            title="채널 초기화"
          >
            {isResetting ? '⏳' : '🔄'}
          </button>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.progressSection}>
          <div className={styles.counts}>
            <div className={styles.countItem}>
              <span className={styles.countLabel}>요청</span>
              <span className={styles.countValue}>{channel.requestCount}</span>
            </div>
            <div className={styles.countItem}>
              <span className={styles.countLabel}>완료</span>
              <span className={styles.countValue}>{channel.completedCount}</span>
            </div>
            {channel.errorCount > 0 && (
              <div className={styles.countItem}>
                <span className={styles.countLabel}>에러</span>
                <span className={`${styles.countValue} ${styles.errorCount}`}>
                  {channel.errorCount}
                </span>
              </div>
            )}
          </div>

          {channel.requestCount > 0 && (
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill}
                style={{ 
                  width: `${getProgressPercentage()}%`,
                  backgroundColor: isError ? '#ef4444' : '#10b981'
                }}
              />
              <span className={styles.progressText}>{getProgressPercentage()}%</span>
            </div>
          )}
        </div>

        {channel.startTime && (
          <div className={styles.timeSection}>
            <div className={styles.timeInfo}>
              <span className={styles.timeLabel}>시작:</span>
              <span className={styles.timeValue}>
                {formatTime(channel.startTime)}
              </span>
            </div>
            {channel.endTime && (
              <div className={styles.timeInfo}>
                <span className={styles.timeLabel}>완료:</span>
                <span className={styles.timeValue}>
                  {formatTime(channel.endTime)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <div className={styles.lastUpdated}>
          마지막 업데이트: {formatTime(channel.lastUpdated)}
        </div>
        
        {isTimeout && (
          <div className={styles.statusMessage}>
            ⚠️ 10분을 초과하여 타임아웃되었습니다.
          </div>
        )}
        
        {isError && !isTimeout && (
          <div className={styles.statusMessage}>
            ❌ 처리 중 오류가 발생했습니다.
          </div>
        )}
        
        {channel.status === ChannelStatus.COMPLETED && !isError && (
          <div className={styles.statusMessage}>
            ✅ 모든 작업이 성공적으로 완료되었습니다.
          </div>
        )}
      </div>
    </div>
  );
};