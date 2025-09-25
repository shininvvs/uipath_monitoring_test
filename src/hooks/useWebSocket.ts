// src/hooks/useWebSocket.ts

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketOptions {
  onChannelUpdate?: (update: any) => void;
  onConnectionStatus?: (status: { connected: boolean }) => void;
  onError?: (error: any) => void;
}

interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnectCount: number;
  requestChannelStatus: () => void;
  sendPing: () => void;
}

export const useWebSocket = (options: UseWebSocketOptions = {}): UseWebSocketReturn => {
  const { onChannelUpdate, onConnectionStatus, onError } = options;

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    console.log('🔌 Connecting to WebSocket...');
    setIsConnecting(true);
    setError(null);

    // WebSocket URL 구성
    const socketUrl = process.env.NODE_ENV === 'production' 
      ? window.location.origin 
      : 'http://localhost:3000';

    const newSocket = io(socketUrl, {
      path: '/api/websocket',
      transports: ['polling', 'websocket'], // polling을 먼저 시도, 그 다음 websocket
      upgrade: true,
      rememberUpgrade: true,
      timeout: 5000,
      forceNew: true
    });

    // 연결 성공
    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected:', newSocket.id);
      setSocket(newSocket);
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
      reconnectAttempts.current = 0;
      setReconnectCount(0);
      
      onConnectionStatus?.({ connected: true });

      // 연결 후 즉시 채널 상태 요청
      newSocket.emit('request_channel_status');
    });

    // 연결 상태 메시지 수신
    newSocket.on('connection_status', (data) => {
      console.log('📡 Connection status received:', data);
    });

    // 채널 업데이트 수신
    newSocket.on('channel_update', (update) => {
      console.log('📡 Channel update received:', update);
      onChannelUpdate?.(update);
    });

    // 채널 상태 응답 수신
    newSocket.on('channel_status_response', (data) => {
      console.log('📡 Channel status response received:', data);
      onChannelUpdate?.(data);
    });

    // 핑-퐁 응답 수신
    newSocket.on('pong', (data) => {
      console.log('🏓 Pong received:', data);
    });

    // 에러 수신
    newSocket.on('error', (errorData) => {
      console.error('❌ WebSocket error received:', errorData);
      setError(errorData.message || 'WebSocket error occurred');
      onError?.(errorData);
    });

    // 연결 해제
    newSocket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
      setIsConnected(false);
      setIsConnecting(false);
      onConnectionStatus?.({ connected: false });

      // 자동 재연결 시도
      if (reason === 'io server disconnect') {
        // 서버에서 연결을 끊었으므로 수동으로 재연결
        setTimeout(() => {
          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current++;
            setReconnectCount(reconnectAttempts.current);
            connect();
          }
        }, 2000 * reconnectAttempts.current); // 지수 백오프
      }
    });

    // 연결 오류
    newSocket.on('connect_error', (err) => {
      console.error('❌ WebSocket connection error:', err);
      setError('연결 실패: ' + err.message);
      setIsConnecting(false);
      
      // 재연결 시도
      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        setReconnectCount(reconnectAttempts.current);
        setTimeout(() => {
          connect();
        }, 3000 * reconnectAttempts.current);
      }
    });

    socketRef.current = newSocket;
  }, [onChannelUpdate, onConnectionStatus, onError]);

  const requestChannelStatus = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('📨 Requesting channel status...');
      socketRef.current.emit('request_channel_status');
    }
  }, []);

  const sendPing = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('ping');
    }
  }, []);

  // 컴포넌트 마운트 시 연결
  useEffect(() => {
    connect();

    // 정기적인 핑 전송 (연결 상태 확인)
    const pingInterval = setInterval(() => {
      sendPing();
    }, 30000); // 30초마다

    return () => {
      clearInterval(pingInterval);
      if (socketRef.current) {
        console.log('🔌 Disconnecting WebSocket...');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connect, sendPing]);

  return {
    socket: socketRef.current,
    isConnected,
    isConnecting,
    error,
    reconnectCount,
    requestChannelStatus,
    sendPing
  };
};