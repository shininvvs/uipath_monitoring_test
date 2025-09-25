// src/components/Dashboard/Dashboard.tsx

import React, { useCallback, useEffect, useState } from 'react';
import { ChannelCard } from './ChannelCard';
import { useChannelStatus } from '../../hooks/useChannelStatus';
import { ChannelStatus } from '../../types/channel';
import styles from './styles/Dashboard.module.css';

export const Dashboard: React.FC = () => {
  const {
    channels,
    isConnected,
    isLoading,
    error,
    lastUpdate,
    refreshChannels,
    resetChannel,
    connectionStatus
  } = useChannelStatus();

  const [showConnectionInfo, setShowConnectionInfo] = useState(false);

  const handleChannelReset = useCallback(async (channelId: string) => {
    await resetChannel(channelId);
  }, [resetChannel]);

  const getChannelStats = () => {
    const stats = {
      total: channels.length,
      idle: 0,
      inProgress: 0,
      completed: 0,
      error: 0,
      timeout: 0
    };

    channels.forEach(channel => {
      switch (channel.status) {
        case ChannelStatus.IDLE:
          stats.idle++;
          break;
        case ChannelStatus.IN_PROGRESS:
          stats.inProgress++;
          break;
        case ChannelStatus.COMPLETED:
          stats.completed++;
          break;
        case ChannelStatus.ERROR:
          stats.error++;
          break;
        case ChannelStatus.TIMEOUT:
          stats.timeout++;
          break;
      }
    });

    return stats;
  };

  const stats = getChannelStats();

  // 연결 상태에 따른 표시 텍스트 및 색상
  const getConnectionDisplay = () => {
    switch (connectionStatus) {
      case 'connecting':
        return { text: '연결 중...', color: '#f59e0b', icon: '🔄' };
      case 'connected':
        return { text: '실시간 연결됨', color: '#10b981', icon: '🟢' };
      case 'disconnected':
        return { text: '연결 끊어짐', color: '#6b7280', icon: '🔴' };
      case 'error':
        return { text: '연결 오류', color: '#ef4444', icon: '⚠️' };
      default:
        return { text: '알 수 없음', color: '#6b7280', icon: '❓' };
    }
  };

  const connectionDisplay = getConnectionDisplay();

  // 자동 에러 해제 (5초 후)
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        // 에러를 자동으로 해제하는 로직은 useChannelStatus 훅에서 처리
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (isLoading && channels.length === 0) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>실시간 대시보드를 로딩 중입니다...</p>
          <p className={styles.loadingSubtext}>WebSocket 연결 설정 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      {/* 헤더 */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1 className={styles.title}>슬랙 채널 실시간 모니터링</h1>
          
          {/* 연결 상태 표시 */}
          <div className={styles.connectionStatus}>
            <div 
              className={`${styles.connectionDot} ${connectionStatus === 'connected' ? styles.connected : styles.disconnected}`}
              style={{ backgroundColor: connectionDisplay.color }}
            />
            <span 
              className={styles.connectionText}
              style={{ color: connectionDisplay.color }}
            >
              {connectionDisplay.icon} {connectionDisplay.text}
            </span>
            
            {/* 연결 정보 토글 */}
            <button
              className={styles.connectionInfoButton}
              onClick={() => setShowConnectionInfo(!showConnectionInfo)}
              title="연결 정보 보기"
            >
              ℹ️
            </button>
          </div>

          {/* 연결 상세 정보 (토글) */}
          {showConnectionInfo && (
            <div className={styles.connectionDetails}>
              <div className={styles.connectionDetailItem}>
                <strong>상태:</strong> {connectionDisplay.text}
              </div>
              <div className={styles.connectionDetailItem}>
                <strong>연결 방식:</strong> {isConnected ? 'WebSocket 실시간' : 'HTTP Polling'}
              </div>
              {lastUpdate && (
                <div className={styles.connectionDetailItem}>
                  <strong>마지막 업데이트:</strong> {lastUpdate.toLocaleTimeString('ko-KR')}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.controls}>
          <button
            className={styles.refreshButton}
            onClick={refreshChannels}
            disabled={isLoading}
            title="수동 새로고침"
          >
            <span className={`${styles.refreshIcon} ${isLoading ? styles.spinning : ''}`}>
              🔄
            </span>
            새로고침
          </button>
        </div>
      </div>

      {/* 통계 */}
      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{stats.total}</span>
          <span className={styles.statLabel}>전체 채널</span>
        </div>
        <div className={styles.statItem}>
          <span className={`${styles.statValue} ${styles.inProgress}`}>{stats.inProgress}</span>
          <span className={styles.statLabel}>진행중</span>
        </div>
        <div className={styles.statItem}>
          <span className={`${styles.statValue} ${styles.completed}`}>{stats.completed}</span>
          <span className={styles.statLabel}>완료</span>
        </div>
        <div className={styles.statItem}>
          <span className={`${styles.statValue} ${styles.error}`}>{stats.error + stats.timeout}</span>
          <span className={styles.statLabel}>에러/타임아웃</span>
        </div>
      </div>

      {/* 에러 표시 (자동 해제됨) */}
      {error && (
        <div className={styles.error}>
          <span className={styles.errorIcon}>⚠️</span>
          <span className={styles.errorText}>{error}</span>
          <div className={styles.errorActions}>
            <button
              className={styles.errorButton}
              onClick={refreshChannels}
              title="다시 연결 시도"
            >
              다시 시도
            </button>
          </div>
        </div>
      )}

      {/* 실시간 업데이트 알림 */}
      {isConnected && lastUpdate && (
        <div className={styles.realtimeIndicator}>
          <span className={styles.pulseIcon}>📡</span>
          <span>실시간 업데이트 활성화</span>
          <span className={styles.lastUpdateTime}>
            ({lastUpdate.toLocaleTimeString('ko-KR')})
          </span>
        </div>
      )}

      {/* 채널 카드 그리드 */}
      {channels.length > 0 ? (
        <div className={styles.channelGrid}>
          {channels
            .sort((a, b) => {
              // 상태별 우선순위: 진행중 > 에러/타임아웃 > 완료 > 대기중
              const statusOrder = {
                [ChannelStatus.IN_PROGRESS]: 1,
                [ChannelStatus.ERROR]: 2,
                [ChannelStatus.TIMEOUT]: 2,
                [ChannelStatus.COMPLETED]: 3,
                [ChannelStatus.IDLE]: 4
              };
              
              const orderA = statusOrder[a.status];
              const orderB = statusOrder[b.status];
              
              if (orderA !== orderB) {
                return orderA - orderB;
              }
              
              // 같은 상태면 최근 업데이트 순
              return b.lastUpdated.getTime() - a.lastUpdated.getTime();
            })
            .map(channel => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                onReset={handleChannelReset}
              />
            ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📭</div>
          <h3 className={styles.emptyTitle}>등록된 채널이 없습니다</h3>
          <p className={styles.emptyDescription}>
            슬랙 웹훅을 통해 메시지가 전송되면 채널이 실시간으로 등록됩니다.
          </p>
          
          {/* 테스트 안내 */}
          <div className={styles.testInstructions}>
            <h4>💡 테스트 방법:</h4>
            <div className={styles.testExample}>
              <code>신계약 요청 10</code> ← 작업 시작
            </div>
            <div className={styles.testExample}>
              <code>신계약 작업 8</code> ← 작업 완료
            </div>
          </div>
        </div>
      )}

      {/* 푸터 */}
      <div className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.info}>
            <span>💡 <strong>실시간 모니터링:</strong> WebSocket으로 즉시 업데이트</span>
          </div>
          <div className={styles.messageFormat}>
            <strong>메시지 형식:</strong> "채널명 요청 숫자" | "채널명 작업 숫자"
          </div>
          {lastUpdate && (
            <div className={styles.lastUpdate}>
              마지막 업데이트: {lastUpdate.toLocaleString('ko-KR')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};