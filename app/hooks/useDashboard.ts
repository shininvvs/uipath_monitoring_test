import { useState, useMemo, useCallback } from "react";
import { Channel, SlackMessage } from "../types/monitoring";

interface UseDashboardProps {
  allChannels: Channel[];
  errorMessagesByChannel: Record<string, SlackMessage[]>;
  readMessages: Set<string>;
  delayedErrors: Record<string, SlackMessage[]>;
  onChannelCardClick?: (code: string, ts?: string) => void;
  onMarkAsRead?: (channelCode: string, messageTs: string) => void;
}

interface ChannelStats {
  hasActiveWork: boolean;
  isInProgress: boolean;
  errorCount: number;
  completedCount: number;
  requestCount: number;
  client: string;
  unreadCount: number;
  delayedCount: number;
}

interface WorkSession {
  client: string;
  requestCount: number;
  completedCount: number;
  errorCount: number;
  isInProgress: boolean;
  hasActiveWork: boolean;
  startTime: number;
  endTime: number | null;
}

export function useDashboard({
  allChannels,
  errorMessagesByChannel,
  readMessages,
  delayedErrors,
  onChannelCardClick,
  onMarkAsRead,
}: UseDashboardProps) {
  const [search, setSearch] = useState("");

  // 메시지 패턴 파싱 함수들 (useChannelCard와 동일)
  const parseStartMessage = useCallback((text: string) => {
    const match = text.match(/([가-힣A-Za-z0-9_]+)\s*요청갯수\s*:\s*(\d+)/);
    return match ? { client: match[1], count: parseInt(match[2]) } : null;
  }, []);

  const parseEndMessage = useCallback((text: string) => {
    const match = text.match(/([가-힣A-Za-z0-9_]+)\s*작업갯수\s*:\s*(\d+)/);
    return match ? { client: match[1], count: parseInt(match[2]) } : null;
  }, []);

  const isErrorMessage = useCallback((text: string): boolean => {
    if (!text) return false;
    const startMatch = parseStartMessage(text);
    const endMatch = parseEndMessage(text);
    if (startMatch || endMatch) return false;
    if (text.includes('[DELAYED]')) return false;
    return true;
  }, [parseStartMessage, parseEndMessage]);

  // 채널별 작업 통계 계산
  const getChannelStats = useCallback((channelCode: string): ChannelStats => {
    const channelErrorMessages = errorMessagesByChannel[channelCode] || [];
    const channelDelayedMessages = delayedErrors[channelCode] || [];
    
    // 시간순 정렬
    const sortedMessages = [...channelErrorMessages, ...channelDelayedMessages]
      .sort((a, b) => (Number(a.ts) || 0) - (Number(b.ts) || 0));

    const defaultProgress: ChannelStats = {
      client: '',
      requestCount: 0,
      completedCount: 0,
      errorCount: 0,
      isInProgress: false,
      hasActiveWork: false,
      unreadCount: 0,
      delayedCount: 0,
    };

    let latestStartTime = 0;
    let activeSession: WorkSession | null = null;

    // 메시지 분석
    for (const message of sortedMessages) {
      const messageTime = Number(message.ts) || 0;
      const startMatch = parseStartMessage(message.text || '');
      const endMatch = parseEndMessage(message.text || '');

      if (startMatch) {
        if (messageTime > latestStartTime) {
          activeSession = {
            client: startMatch.client,
            requestCount: startMatch.count,
            completedCount: 0,
            errorCount: 0,
            isInProgress: true,
            hasActiveWork: true,
            startTime: messageTime,
            endTime: null,
          };
          latestStartTime = messageTime;
        }
      } else if (endMatch && activeSession && activeSession.client === endMatch.client) {
        activeSession.completedCount = endMatch.count;
        activeSession.isInProgress = false;
        activeSession.endTime = messageTime;
      } else if (activeSession && isErrorMessage(message.text || '')) {
        if (messageTime > activeSession.startTime && 
            (!activeSession.endTime || messageTime < activeSession.endTime)) {
          activeSession.errorCount++;
        }
      }
    }

    // 읽지 않은 메시지 수 계산
    const unreadCount = channelErrorMessages.filter(msg => msg.ts && !readMessages.has(msg.ts)).length;
    const delayedCount = channelDelayedMessages.filter(msg => msg.ts && !readMessages.has(msg.ts)).length;

    if (!activeSession) {
      return {
        ...defaultProgress,
        unreadCount,
        delayedCount,
      };
    }

    return {
      hasActiveWork: activeSession.hasActiveWork,
      isInProgress: activeSession.isInProgress,
      errorCount: activeSession.errorCount,
      completedCount: activeSession.completedCount,
      requestCount: activeSession.requestCount,
      client: activeSession.client,
      unreadCount,
      delayedCount,
    };
  }, [errorMessagesByChannel, delayedErrors, readMessages, parseStartMessage, parseEndMessage, isErrorMessage]);

  // 채널별 읽지 않은 메시지 계산
  const getUnreadMessages = useCallback((channelCode: string): SlackMessage[] => {
    const allMessages = errorMessagesByChannel[channelCode] || [];
    return allMessages.filter(msg => msg.ts && !readMessages.has(msg.ts));
  }, [errorMessagesByChannel, readMessages]);

  // 채널별 지연된 메시지 계산
  const getDelayedMessages = useCallback((channelCode: string): SlackMessage[] => {
    return delayedErrors[channelCode] || [];
  }, [delayedErrors]);

  // 검색어에 따른 채널 필터링 (향상된 검색)
  const matchesSearch = useCallback((channel: Channel, searchTerm: string): boolean => {
    if (!searchTerm) return true;
    
    const lowerSearch = searchTerm.toLowerCase();
    const stats = getChannelStats(channel.code);
    
    // 기본 검색 (채널명, 코드)
    if (channel.name.toLowerCase().includes(lowerSearch) ||
        channel.code.toLowerCase().includes(lowerSearch)) {
      return true;
    }
    
    // 상태 기반 검색
    if (lowerSearch === "진행" || lowerSearch === "progress") {
      return stats.isInProgress;
    }
    
    if (lowerSearch === "에러" || lowerSearch === "error") {
      return stats.errorCount > 0;
    }
    
    if (lowerSearch === "완료" || lowerSearch === "completed") {
      return stats.hasActiveWork && !stats.isInProgress && stats.completedCount > 0;
    }
    
    if (lowerSearch === "지연" || lowerSearch === "delayed") {
      return stats.delayedCount > 0;
    }
    
    // 클라이언트명 검색
    if (stats.client && stats.client.toLowerCase().includes(lowerSearch)) {
      return true;
    }
    
    return false;
  }, [getChannelStats]);

  // 필터링된 채널 목록 (에러나 지연된 메시지가 있는 채널만)
  const filteredChannels = useMemo(() => {
    const channelsWithIssues = allChannels.filter(channel => {
      const hasUnread = getUnreadMessages(channel.code).length > 0;
      const hasDelayed = getDelayedMessages(channel.code).length > 0;
      const matchesSearchTerm = matchesSearch(channel, search);
      
      return (hasUnread || hasDelayed) && matchesSearchTerm;
    });

    // 우선순위 정렬: 진행중 > 지연 > 에러 > 총 메시지 수
    return channelsWithIssues.sort((a, b) => {
      const aStats = getChannelStats(a.code);
      const bStats = getChannelStats(b.code);
      const aDelayed = getDelayedMessages(a.code).length;
      const bDelayed = getDelayedMessages(b.code).length;
      const aUnread = getUnreadMessages(a.code).length;
      const bUnread = getUnreadMessages(b.code).length;
      
      // 1순위: 진행중인 작업
      if (aStats.isInProgress && !bStats.isInProgress) return -1;
      if (bStats.isInProgress && !aStats.isInProgress) return 1;
      
      // 2순위: 지연된 메시지
      if (aDelayed > 0 && bDelayed === 0) return -1;
      if (bDelayed > 0 && aDelayed === 0) return 1;
      
      // 3순위: 에러 수
      if (aStats.errorCount > bStats.errorCount) return -1;
      if (bStats.errorCount > aStats.errorCount) return 1;
      
      // 4순위: 총 이슈 수
      const aTotal = aDelayed + aUnread;
      const bTotal = bDelayed + bUnread;
      
      return bTotal - aTotal;
    });
  }, [allChannels, search, getUnreadMessages, getDelayedMessages, matchesSearch, getChannelStats]);

  // 총 읽지 않은 메시지 수
  const totalUnreadCount = useMemo(() => {
    return filteredChannels.reduce((total, channel) => {
      return total + getUnreadMessages(channel.code).length + getDelayedMessages(channel.code).length;
    }, 0);
  }, [filteredChannels, getUnreadMessages, getDelayedMessages]);

  // 채널 카드 클릭 핸들러
  const handleChannelClick = useCallback((channelCode: string, messageTs?: string) => {
    if (messageTs && onMarkAsRead) {
      onMarkAsRead(channelCode, messageTs);
    }
    if (onChannelCardClick) {
      onChannelCardClick(channelCode, messageTs);
    }
  }, [onMarkAsRead, onChannelCardClick]);

  // 모든 메시지를 읽음으로 표시
  const handleMarkAllAsRead = useCallback(() => {
    if (!onMarkAsRead) return;

    filteredChannels.forEach(channel => {
      const unreadMessages = getUnreadMessages(channel.code);
      const delayedMessages = getDelayedMessages(channel.code);
      
      [...unreadMessages, ...delayedMessages].forEach(msg => {
        if (msg.ts) {
          onMarkAsRead(channel.code, msg.ts);
        }
      });
    });
  }, [filteredChannels, getUnreadMessages, getDelayedMessages, onMarkAsRead]);

  // 검색어 기반 필터링 (검색 제안)
  const getSearchSuggestions = useCallback(() => {
    const suggestions: Array<{ label: string; value: string }> = [];
    let hasInProgress = false;
    let hasErrors = false;
    let hasCompleted = false;
    let hasDelayed = false;
    const clients = new Set<string>();

    allChannels.forEach(channel => {
      const stats = getChannelStats(channel.code);
      if (stats.isInProgress) hasInProgress = true;
      if (stats.errorCount > 0) hasErrors = true;
      if (stats.hasActiveWork && !stats.isInProgress) hasCompleted = true;
      if (stats.delayedCount > 0) hasDelayed = true;
      if (stats.client) clients.add(stats.client);
    });

    if (hasInProgress) suggestions.push({ label: "진행 중", value: "진행" });
    if (hasErrors) suggestions.push({ label: "에러 발생", value: "에러" });
    if (hasCompleted) suggestions.push({ label: "완료됨", value: "완료" });
    if (hasDelayed) suggestions.push({ label: "지연됨", value: "지연" });
    
    clients.forEach(client => {
      suggestions.push({ label: `${client} 작업`, value: client });
    });

    return suggestions;
  }, [allChannels, getChannelStats]);

  return {
    search,
    setSearch,
    filteredChannels,
    totalUnreadCount,
    handleChannelClick,
    handleMarkAllAsRead,
    getUnreadMessages,
    getDelayedMessages,
    getChannelStats,
    getSearchSuggestions,
    // 추가 유틸리티
    parseStartMessage,
    parseEndMessage,
    isErrorMessage,
  };
}