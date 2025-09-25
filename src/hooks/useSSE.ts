// src/hooks/useSSE.ts

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseSSEOptions {
  onChannelUpdate?: (update: any) => void;
  onConnectionStatus?: (status: { connected: boolean }) => void;
  onError?: (error: any) => void;
}

interface UseSSEReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnectCount: number;
  requestChannelStatus: () => void;
}

export const useSSE = (options: UseSSEOptions = {}): UseSSEReturn => {
  const { onChannelUpdate, onConnectionStatus, onError } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }

    console.log('🔌 Connecting to SSE...');
    setIsConnecting(true);
    setError(null);

    // SSE URL 구성
    const sseUrl = process.env.NODE_ENV === 'production'
      ? `${window.location.origin}/api/events`
      : 'http://localhost:3000/api/events';

    const eventSource = new EventSource(sseUrl);

    // 연결 성공
    eventSource.onopen = () => {
      console.log('✅ SSE connected');
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
      reconnectAttempts.current = 0;
      setReconnectCount(0);
      onConnectionStatus?.({ connected: true });
    };

    // 메시지 수신
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📡 SSE message received:', data);
        
        if (data.type === 'channel_update') {
          onChannelUpdate?.(data);
        } else if (data.type === 'error') {
          setError(data.message || 'SSE error occurred');
          onError?.(data);
        } else if (data.type === 'channel_status_response') {
          onChannelUpdate?.(data);
        }
      } catch (err) {
        console.error('❌ Failed to parse SSE message:', event.data);
      }
    };

    // 연결 오류
    eventSource.onerror = (event) => {
      console.error('❌ SSE connection error:', event);
      setIsConnected(false);
      setIsConnecting(false);
      onConnectionStatus?.({ connected: false });

      // 자동 재연결 시도
      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        setReconnectCount(reconnectAttempts.current);
        setError(`연결 실패, 재시도 중... (${reconnectAttempts.current}/${maxReconnectAttempts})`);
        
        setTimeout(() => {
          if (eventSourceRef.current?.readyState !== EventSource.OPEN) {
            eventSource.close();
            connect();
          }
        }, 3000 * reconnectAttempts.current);
      } else {
        setError('연결에 실패했습니다. 페이지를 새로고침해주세요.');
      }
    };

    eventSourceRef.current = eventSource;
  }, [onChannelUpdate, onConnectionStatus, onError]);

  const requestChannelStatus = useCallback(async () => {
    try {
      console.log('📨 Requesting channel status via HTTP...');
      const response = await fetch('/api/channel-status');
      const data = await response.json();
      
      if (data.success) {
        onChannelUpdate?.({
          type: 'channel_status_response',
          channels: data.data,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('❌ Failed to request channel status:', err);
    }
  }, [onChannelUpdate]);

  // 컴포넌트 마운트 시 연결
  useEffect(() => {
    connect();

    // 초기 채널 상태 요청
    const initialLoad = setTimeout(() => {
      requestChannelStatus();
    }, 1000);

    return () => {
      clearTimeout(initialLoad);
      if (eventSourceRef.current) {
        console.log('🔌 Disconnecting SSE...');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect, requestChannelStatus]);

  return {
    isConnected,
    isConnecting,
    error,
    reconnectCount,
    requestChannelStatus
  };
};
