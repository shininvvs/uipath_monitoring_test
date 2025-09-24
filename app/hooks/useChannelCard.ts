import { useMemo } from "react";
import { Channel, SlackMessage } from "../types/monitoring";

interface UseChannelCardProps {
  channel: Channel;
  errorMessages: SlackMessage[];
  delayedMessages: SlackMessage[];
  readMessages: Set<string>;
}

interface WorkProgress {
  client: string;
  requestCount: number;
  completedCount: number;
  errorCount: number;
  isInProgress: boolean;
  startTime: number | null;
  endTime: number | null;
  startMessage: SlackMessage | null;
  endMessage: SlackMessage | null;
}

interface ActiveSession extends WorkProgress {
  hasActiveWork: boolean;
}

export function useChannelCard({
  channel,
  errorMessages,
  delayedMessages,
  readMessages,
}: UseChannelCardProps) {
  
  // 읽지 않은 메시지 필터링
  const unreadMessages = useMemo(() => {
    return errorMessages.filter(msg => msg.ts && !readMessages.has(msg.ts));
  }, [errorMessages, readMessages]);

  // 최신 메시지 (읽지 않은 메시지 또는 지연된 메시지 중 가장 최근)
  const latestMessage = useMemo(() => {
    const allMessages = [...unreadMessages, ...delayedMessages];
    return allMessages.sort((a, b) => {
      const aTime = Number(a.ts) || 0;
      const bTime = Number(b.ts) || 0;
      return bTime - aTime;
    })[0];
  }, [unreadMessages, delayedMessages]);

  // 카드 상태 결정
  const cardStatus = useMemo(() => {
    if (delayedMessages.length > 0) return 'delayed';
    if (unreadMessages.length > 0) return 'error';
    return 'normal';
  }, [unreadMessages.length, delayedMessages.length]);

  // 메시지 패턴 파싱 함수들 (더 정확한 매칭)
  const parseStartMessage = (text: string) => {
    // "KB자동차 요청갯수 : 5" 형태 매칭
    const match = text.match(/([가-힣A-Za-z0-9_]+)\s*요청갯수\s*:\s*(\d+)/);
    return match ? { client: match[1], count: parseInt(match[2]) } : null;
  };

  const parseEndMessage = (text: string) => {
    // "KB자동차 작업갯수 : 5" 형태 매칭
    const match = text.match(/([가-힣A-Za-z0-9_]+)\s*작업갯수\s*:\s*(\d+)/);
    return match ? { client: match[1], count: parseInt(match[2]) } : null;
  };

  // 에러 메시지 판별 함수
  const isErrorMessage = (text: string): boolean => {
    if (!text) return false;
    
    const startMatch = parseStartMessage(text);
    const endMatch = parseEndMessage(text);
    
    // 시작/완료 메시지가 아닌 경우 에러로 간주
    if (startMatch || endMatch) return false;
    
    // 지연 메시지도 에러가 아님
    if (text.includes('[DELAYED]')) return false;
    
    return true;
  };

  // 시간순으로 정렬된 모든 메시지 (에러 + 지연)
  const sortedMessages = useMemo(() => {
    const allMessages = [...errorMessages, ...delayedMessages];
    return allMessages.sort((a, b) => {
      const aTime = Number(a.ts) || 0;
      const bTime = Number(b.ts) || 0;
      return aTime - bTime; // 시간 순서대로 정렬
    });
  }, [errorMessages, delayedMessages]);

  // 작업 진행 상태 분석
  const workProgress = useMemo((): WorkProgress => {
    const defaultProgress: WorkProgress = {
      client: '',
      requestCount: 0,
      completedCount: 0,
      errorCount: 0,
      isInProgress: false,
      startTime: null,
      endTime: null,
      startMessage: null,
      endMessage: null,
    };

    // 가장 최근의 작업 세션을 찾기 위한 변수들
    let latestStartTime = 0;
    let activeSession: ActiveSession | null = null;

    // 모든 메시지를 순회하면서 작업 세션들을 분석
    for (const message of sortedMessages) {
      const messageTime = Number(message.ts) || 0;
      const startMatch = parseStartMessage(message.text || '');
      const endMatch = parseEndMessage(message.text || '');

      if (startMatch) {
        // 새로운 작업 시작
        if (messageTime > latestStartTime) {
          // 더 최근의 작업이면 갱신
          activeSession = {
            client: startMatch.client,
            requestCount: startMatch.count,
            completedCount: 0,
            errorCount: 0,
            isInProgress: true,
            startTime: messageTime,
            endTime: null,
            startMessage: message,
            endMessage: null,
            hasActiveWork: true,
          };
          latestStartTime = messageTime;
        }
      } else if (endMatch && activeSession && activeSession.client === endMatch.client) {
        // 현재 진행중인 작업의 완료
        activeSession.completedCount = endMatch.count;
        activeSession.isInProgress = false;
        activeSession.endTime = messageTime;
        activeSession.endMessage = message;
      } else if (activeSession && isErrorMessage(message.text || '')) {
        // 작업 진행 중 발생한 에러
        const sessionStartTime = activeSession.startTime;
        const sessionEndTime = activeSession.endTime;
        
        if (sessionStartTime && messageTime > sessionStartTime && 
            (!sessionEndTime || messageTime < sessionEndTime)) {
          activeSession.errorCount++;
        }
      }
    }

    if (!activeSession) {
      return defaultProgress;
    }

    return {
      client: activeSession.client,
      requestCount: activeSession.requestCount,
      completedCount: activeSession.completedCount,
      errorCount: activeSession.errorCount,
      isInProgress: activeSession.isInProgress,
      startTime: activeSession.startTime,
      endTime: activeSession.endTime,
      startMessage: activeSession.startMessage,
      endMessage: activeSession.endMessage,
    };
  }, [sortedMessages]);

  // 진행 상태 텍스트
  const progressStatus = useMemo(() => {
    if (!workProgress.startMessage) {
      return "대기";
    }

    if (workProgress.isInProgress) {
      if (workProgress.errorCount > 0) {
        return `진행 중... (${workProgress.errorCount}개 에러 발생)`;
      }
      return "진행 중...";
    } else if (workProgress.endMessage) {
      const successRate = workProgress.requestCount > 0 
        ? ((workProgress.completedCount / workProgress.requestCount) * 100).toFixed(1)
        : "0.0";
      return `완료 (${workProgress.completedCount}/${workProgress.requestCount}) - ${successRate}%`;
    } else if (workProgress.startMessage && workProgress.errorCount > 0) {
      return `중단됨 (${workProgress.errorCount}개 에러)`;
    } else {
      return "대기 중";
    }
  }, [workProgress]);

  // 진행률 (퍼센트)
  const progressRate = useMemo(() => {
    if (!workProgress.startMessage || workProgress.requestCount === 0) {
      return 0;
    }
    
    if (workProgress.isInProgress) {
      // 진행 중일 때: 시작했으므로 최소 10%, 에러가 많으면 낮게
      const errorPenalty = Math.min(workProgress.errorCount * 5, 30); // 에러당 5% 감점, 최대 30%
      return Math.max(10, 50 - errorPenalty);
    } else if (workProgress.endMessage) {
      // 완료된 경우: 완료율에 따라 계산
      return workProgress.requestCount > 0 
        ? Math.min(100, (workProgress.completedCount / workProgress.requestCount) * 100)
        : 100;
    } else if (workProgress.errorCount > 0) {
      // 시작했지만 완료되지 않고 에러만 있는 경우
      return Math.max(5, 25 - (workProgress.errorCount * 5));
    }
    
    return 10; // 시작했지만 진행 상태가 불분명한 경우
  }, [workProgress]);

  // 에러 건수
  const errorCount = useMemo(() => {
    return workProgress.errorCount;
  }, [workProgress.errorCount]);

  // 완료 건수
  const progressCount = useMemo(() => {
    if (workProgress.isInProgress) {
      // 진행 중: 요청건수에서 에러건수를 뺀 예상 완료건수
      return Math.max(0, workProgress.requestCount - workProgress.errorCount);
    } else if (workProgress.endMessage) {
      // 완료됨: 실제 완료건수
      return workProgress.completedCount;
    } else if (workProgress.startMessage) {
      // 시작했지만 상태가 불분명한 경우
      return Math.max(0, workProgress.requestCount - workProgress.errorCount);
    }
    return 0;
  }, [workProgress]);

  // 시간 포맷팅 함수
  const formatTime = (timestamp?: string) => {
    if (!timestamp) return "-";
    const date = new Date(Number(timestamp) * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // 작업 세션 정보 (디버깅용)
  const workStatus = useMemo(() => ({
    hasActiveWork: !!workProgress.startMessage,
    client: workProgress.client,
    requestCount: workProgress.requestCount,
    completedCount: workProgress.completedCount,
    errorsBetween: workProgress.errorCount,
    isInProgress: workProgress.isInProgress,
    duration: workProgress.startTime && workProgress.endTime 
      ? workProgress.endTime - workProgress.startTime 
      : workProgress.startTime 
      ? Date.now() / 1000 - workProgress.startTime 
      : 0,
    startMessage: workProgress.startMessage,
    endMessage: workProgress.endMessage,
  }), [workProgress]);

  return {
    progressRate,
    progressStatus,
    errorCount,
    progressCount,
    unreadMessages,
    latestMessage,
    cardStatus,
    formatTime,
    workStatus, // 디버깅용으로 추가
    workProgress, // 전체 작업 진행 정보
  };
}