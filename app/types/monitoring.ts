// types/monitoring.ts
export interface Channel {
  code: string;
  name: string;
}

export interface SlackMessage {
  text: string;
  ts: string;
  user?: string;
  type?: string;
  bot_id?: string;
  username?: string;
  thread_ts?: string;
  reply_count?: number;
  level?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  priority?: number;
  color?: string;
  timestamp?: string;
  delayDuration?: number; // 지연 시간 (분)
}

export interface ErrorStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  delayed?: number; // 지연 에러 개수
  hourlyDistribution: number[];
  errorTypes: { [key: string]: number };
  avgErrorsPerHour: number;
  lastErrorTime: string | null;
}

export interface ChannelInfo {
  id: string;
  total_messages: number;
  error_messages: number;
  delayed_messages?: number; // 지연 에러 메시지 수
  error_percentage: number;
  latest_message_ts: string | null;
}

export interface SlackApiResponse {
  messages: SlackMessage[];
  statistics: ErrorStats;
  channel_info: ChannelInfo;
  timestamp: string;
}

export type AlertType = 'error' | 'delayed' | 'warning' | 'info';

export interface Alert {
  id: string;
  type: AlertType;
  channelName: string;
  channelCode: string;
  message: string;
  timestamp: string;
  ts?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRead: boolean;
  delayDuration?: number;
}

export interface NotificationSettings {
  enableSound: boolean;
  enableDesktopNotifications: boolean;
  delayThreshold: number; // 지연 알림 임계값 (분)
  autoMarkAsReadDelay: number; // 자동 읽음 처리 지연 시간 (밀리초)
}

export interface MonitoringState {
  channels: Channel[];
  activeChannels: Channel[];
  messages: Record<string, SlackMessage[]>;
  delayedErrors: Record<string, SlackMessage[]>;
  readMessages: Set<string>;
  alerts: Alert[];
  settings: NotificationSettings;
}