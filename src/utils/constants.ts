export const TIMEOUT_DURATION = 10 * 60 * 1000; // 10분

export const MESSAGE_PATTERNS = {
  START_PATTERN: /^(.+?)\s+요청\s+(\d+)$/,
  COMPLETE_PATTERN: /^(.+?)\s+작업\s+(\d+)$/,
  ERROR_KEYWORDS: ['error', 'Error', 'ERROR', '에러', '오류', 'fail', 'Failed', 'exception']
};

export const CHANNEL_STATUS_COLORS = {
  idle: '#6b7280',
  in_progress: '#3b82f6',
  completed: '#10b981',
  error: '#ef4444',
  timeout: '#f59e0b'
};

export const API_ENDPOINTS = {
  WEBHOOK: '/api/webhook/slack',
  CHANNELS: '/api/channels',
  CHANNEL_STATUS: '/api/channels/status',
  WEBSOCKET: '/api/websocket'
} as const;