import React from 'react';
import { ChannelStatus } from '../../types/channel';
import { CHANNEL_STATUS_COLORS } from '../../utils/constants';
import styles from './styles/StatusIndicator.module.css';

interface StatusIndicatorProps {
  status: ChannelStatus;
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  className?: string;
}

const STATUS_TEXT = {
  [ChannelStatus.IDLE]: '대기중',
  [ChannelStatus.IN_PROGRESS]: '진행중',
  [ChannelStatus.COMPLETED]: '완료',
  [ChannelStatus.ERROR]: '에러',
  [ChannelStatus.TIMEOUT]: '타임아웃'
};

const STATUS_ICONS = {
  [ChannelStatus.IDLE]: '⏸️',
  [ChannelStatus.IN_PROGRESS]: '🔄',
  [ChannelStatus.COMPLETED]: '✅',
  [ChannelStatus.ERROR]: '❌',
  [ChannelStatus.TIMEOUT]: '⏰'
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  size = 'medium',
  showText = true,
  className
}) => {
  const color = CHANNEL_STATUS_COLORS[status];
  const text = STATUS_TEXT[status];
  const icon = STATUS_ICONS[status];

  return (
    <div className={`${styles.statusIndicator} ${styles[size]} ${className || ''}`}>
      <div
        className={`${styles.statusDot} ${status === ChannelStatus.IN_PROGRESS ? styles.pulse : ''}`}
        style={{ backgroundColor: color }}
      >
        <span className={styles.statusIcon}>{icon}</span>
      </div>
      {showText && (
        <span className={styles.statusText} style={{ color }}>
          {text}
        </span>
      )}
    </div>
  );
};