// src/hooks/useChannelStatus.ts

import { useState, useCallback, useMemo, useRef } from 'react';
import { Channel, ChannelUpdate, ChannelStatus } from '../types/channel';
import { useSSE } from './useSSE';
import { API_ENDPOINTS } from '../utils/constants';

interface UseChannelStatusReturn {
  channels: Channel[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  refreshChannels: () => Promise<void>;
  resetChannel: (channelId: string) => Promise<boolean>;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export const useChannelStatus = (): UseChannelStatusReturn => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const channelsMapRef = useRef<Map<string, Channel>>(new Map());

  // 채널 업데이트 처리 (화면 깜빡임 없이 부드럽게)
  const handleChannelUpdate = useCallback((data: any) => {
    console.log('🔄 Processing channel update:', data);

    if (data.channels) {
      // 전체 채널 상태 응답 (초기 로드)
      const newChannels: Channel[] = data.channels;
      const newChannelsMap = new Map<string, Channel>();

      newChannels.forEach(channel => {
        // Date 객체 변환
        const processedChannel: Channel = {
          ...channel,
          lastUpdated: new Date(channel.lastUpdated),
          startTime: channel.startTime ? new Date(channel.startTime) : undefined,
          endTime: channel.endTime ? new Date(channel.endTime) : undefined
        };
        newChannelsMap.set(channel.id, processedChannel);
      });

      channelsMapRef.current = newChannelsMap;
      setChannels(Array.from(newChannelsMap.values()));
      setLastUpdate(new Date());
      console.log('✅ Full channel state updated');
    } else if (data.channelId || data.channelName) {
      // 개별 채널 업데이트 (실시간)
      const update: ChannelUpdate = {
        channelId: data.channelId || data.channelName,
        channelName: data.channelName || data.channelId,
        status: data.status,
        requestCount: data.requestCount,
        completedCount: data.completedCount,
        errorCount: data.errorCount,
        hasError: data.hasError,
        isDelayed: data.isDelayed,
        timestamp: new Date(data.timestamp || Date.now())
      };

      // 기존 채널 찾기 또는 새 채널 생성
      const existingChannel = channelsMapRef.current.get(update.channelId);
      const updatedChannel: Channel = existingChannel ? {
        ...existingChannel,
        status: update.status,
        requestCount: update.requestCount ?? existingChannel.requestCount,
        completedCount: update.completedCount ?? existingChannel.completedCount,
        errorCount: update.errorCount ?? existingChannel.errorCount,
        hasError: update.hasError ?? existingChannel.hasError,
        isDelayed: update.isDelayed ?? existingChannel.isDelayed,
        lastUpdated: update.timestamp,
        // 상태에 따른 시간 업데이트
        startTime: update.status === ChannelStatus.IN_PROGRESS && !existingChannel.startTime
          ? update.timestamp : existingChannel.startTime,
        endTime: (update.status === ChannelStatus.COMPLETED || update.status === ChannelStatus.ERROR || update.status === ChannelStatus.TIMEOUT)
          ? update.timestamp : existingChannel.endTime
      } : {
        id: update.channelId,
        name: update.channelName,
        status: update.status,
        requestCount: update.requestCount ?? 0,
        completedCount: update.completedCount ?? 0,
        errorCount: update.errorCount ?? 0,
        hasError: update.hasError ?? false,
        isDelayed: update.isDelayed ?? false,
        lastUpdated: update.timestamp,
        startTime: update.status === ChannelStatus.IN_PROGRESS ? update.timestamp : undefined,
        endTime: undefined
      };

      // 맵 업데이트
      channelsMapRef.current.set(update.channelId, updatedChannel);

      // 상태 업데이트 (부드러운 업데이트)
      setChannels(prev => {
        const newChannels = Array.from(channelsMapRef.current.values());
        return newChannels;
      });

      setLastUpdate(new Date());
      console.log(`✅ Channel ${update.channelName} updated to ${update.status}`);
    }
  }, []);

  // 연결 상태 처리
  const handleConnectionStatus = useCallback((status: { connected: boolean }) => {
    setConnectionStatus(status.connected ? 'connected' : 'disconnected');
    console.log('🔗 Connection status:', status.connected ? 'connected' : 'disconnected');
  }, []);

  // 에러 처리
  const handleError = useCallback((errorData: any) => {
    setError(errorData.message || '알 수 없는 오류가 발생했습니다.');
    setConnectionStatus('error');
    console.error('❌ SSE error:', errorData);
  }, []);

  // SSE 연결
  const {
    isConnected,
    isConnecting,
    error: sseError,
    requestChannelStatus,
    reconnectCount
  } = useSSE({
    onChannelUpdate: handleChannelUpdate,
    onConnectionStatus: handleConnectionStatus,
    onError: handleError
  });

  // 수동 새로고침
  const refreshChannels = useCallback(async () => {
    console.log('🔄 Refreshing channel status...');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINTS.CHANNEL_STATUS);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || '채널 정보를 가져오는데 실패했습니다.');
      }

      const channelData: Channel[] = (data.data || []).map((channel: any) => ({
        ...channel,
        lastUpdated: new Date(channel.lastUpdated),
        startTime: channel.startTime ? new Date(channel.startTime) : undefined,
        endTime: channel.endTime ? new Date(channel.endTime) : undefined
      }));

      const newChannelsMap = new Map<string, Channel>();
      channelData.forEach(channel => {
        newChannelsMap.set(channel.id, channel);
      });

      channelsMapRef.current = newChannelsMap;
      setChannels(channelData);
      setLastUpdate(new Date());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '채널 정보 새로고침에 실패했습니다.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 채널 리셋
  const resetChannel = useCallback(async (channelId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_ENDPOINTS.CHANNELS}/${channelId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        // 즉시 새로고침하여 업데이트된 상태 반영
        await refreshChannels();
        console.log(`✅ Channel ${channelId} reset successfully`);
        return true;
      } else {
        setError(data.error || '채널 초기화에 실패했습니다.');
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '채널 초기화에 실패했습니다.';
      setError(errorMessage);
      return false;
    }
  }, [refreshChannels]);

  // 연결 상태 통합 계산
  const finalConnectionStatus = useMemo(() => {
    if (isConnecting) return 'connecting';
    if (isConnected) return 'connected';
    if (sseError) return 'error';
    return 'disconnected';
  }, [isConnecting, isConnected, sseError]);

  // 에러 상태 통합
  const finalError = error || sseError;

  return {
    channels,
    isConnected,
    isLoading,
    error: finalError,
    lastUpdate,
    refreshChannels,
    resetChannel,
    connectionStatus: finalConnectionStatus
  };
};
