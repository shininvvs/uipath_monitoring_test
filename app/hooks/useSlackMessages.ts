import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Channel, SlackMessage } from "../types/monitoring";
import { areErrorMessagesEqual } from "../utils/messageUtils";

interface ChannelResult {
  code: string;
  messages: SlackMessage[];
}

// 시작 메시지 패턴 - 사용자 요구사항에 맞게 수정
function isStartMessage(text: string): boolean {
  if (!text) return false;
  
  // "KB자동차 요청갯수 : 5" 형태의 패턴
  const startPattern = /([가-힣A-Za-z0-9_]+)\s*요청갯수\s*:\s*(\d+)/;
  return startPattern.test(text);
}

// 종료 메시지 패턴 - 사용자 요구사항에 맞게 수정
function isEndMessage(text: string): boolean {
  if (!text) return false;
  
  // "KB자동차 작업갯수 : 5" 형태의 패턴
  const endPattern = /([가-힣A-Za-z0-9_]+)\s*작업갯수\s*:\s*(\d+)/;
  return endPattern.test(text);
}

// 작업 관련 메시지인지 확인 (시작, 완료, 또는 일반 에러)
function isWorkRelatedMessage(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  
  // 시작/완료 메시지는 항상 포함
  if (isStartMessage(text) || isEndMessage(text)) return true;
  
  // 지연 메시지도 포함하지만 별도 처리
  if (text.includes('[DELAYED]')) return false;
  
  // 일반 에러 패턴 체크
  const errorPatterns = [
    // 기본 에러 키워드
    /\berror\b/gi, /\bexception\b/gi, /\bfailed\b/gi, /\bfailure\b/gi,
    /\bcritical\b/gi, /\bfatal\b/gi, /\bpanic\b/gi, /\bcrash\b/gi,
    /\btimeout\b/gi, /\babort\b/gi, /\bdenied\b/gi,
    
    // HTTP 에러 코드
    /\b[45]\d{2}\b/g, // 400-499, 500-599
    
    // 데이터베이스 에러
    /connection\s+(failed|error|refused)/gi,
    /database\s+(error|failure)/gi,
    /query\s+(failed|error)/gi,
    
    // 네트워크 에러
    /network\s+(error|failure|timeout)/gi,
    /connection\s+(reset|refused|timeout)/gi,
    
    // 한국어 에러 패턴
    /에러/gi, /오류/gi, /실패/gi, /장애/gi, /문제/gi
  ];
  
  return errorPatterns.some(pattern => pattern.test(text));
}

// 순수 에러 메시지인지 확인 (시작/완료 메시지 제외)
function containsError(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  
  // 시작/완료 메시지는 에러가 아님
  if (isStartMessage(text) || isEndMessage(text)) return false;
  
  // 지연 메시지도 에러가 아님 (별도 처리)
  if (text.includes('[DELAYED]')) return false;
  
  return isWorkRelatedMessage(text);
}

// 설정 객체 - 환경변수로 오버라이드 가능
const CONFIG = {
  // 지연 임계값 (분)
  delayThresholdMinutes: parseInt(process.env.NEXT_PUBLIC_DELAY_THRESHOLD || '5'),
  
  // 체크 간격 (초)
  checkIntervalSeconds: parseInt(process.env.NEXT_PUBLIC_CHECK_INTERVAL || '30'),
  
  // Fetch 간격 (초)
  fetchIntervalSeconds: parseInt(process.env.NEXT_PUBLIC_FETCH_INTERVAL || '15'),
  
  // 디버그 모드
  debugMode: process.env.NODE_ENV === 'development',
  
  // 최대 캐시된 프로세스 수
  maxProcesses: parseInt(process.env.NEXT_PUBLIC_MAX_PROCESSES || '1000'),
  
  // 프로세스 정리 간격 (분)
  cleanupIntervalMinutes: parseInt(process.env.NEXT_PUBLIC_CLEANUP_INTERVAL || '60')
};

// 시작 메시지 파싱
function parseStartMessage(text: string) {
  const match = text.match(/([가-힣A-Za-z0-9_]+)\s*요청갯수\s*:\s*(\d+)/);
  return match ? { client: match[1], count: parseInt(match[2]) } : null;
}

// 완료 메시지 파싱
function parseEndMessage(text: string) {
  const match = text.match(/([가-힣A-Za-z0-9_]+)\s*작업갯수\s*:\s*(\d+)/);
  return match ? { client: match[1], count: parseInt(match[2]) } : null;
}

// 프로세스 ID 추출 - 클라이언트명 + 요청갯수 조합으로 고유 식별
function extractProcessId(text: string): string | null {
  if (!text) return null;
  
  // 시작 메시지에서 프로세스 ID 생성
  const startMatch = parseStartMessage(text);
  if (startMatch) {
    return `${startMatch.client}_${startMatch.count}_${Date.now()}`;
  }
  
  // 완료 메시지에서는 클라이언트명만 사용 (매칭을 위해)
  const endMatch = parseEndMessage(text);
  if (endMatch) {
    return endMatch.client;
  }
  
  return null;
}

// 관련 메시지 확인 - 같은 클라이언트의 시작/완료 메시지인지 확인
function areRelatedMessages(startText: string, endText: string): boolean {
  if (!startText || !endText) return false;
  
  const startMatch = parseStartMessage(startText);
  const endMatch = parseEndMessage(endText);
  
  // 같은 클라이언트명인지 확인
  return !!(startMatch && endMatch && startMatch.client === endMatch.client);
}

// 실행 중인 프로세스 관리 - 타입 정의 수정
interface RunningProcess {
  processId: string;
  client: string;
  requestCount: number;
  startTime: number;
  message: SlackMessage;
  channelCode: string;
  lastChecked: number;
}

// Debounce 유틸리티
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

export const useSlackMessages = (
  allChannels: Channel[],
  startDate: string,
  endDate: string,
  readMessages: Set<string>
) => {
  const [allMessagesAllByChannel, setAllMessagesAllByChannel] = 
    useState<Record<string, SlackMessage[]>>({});
  
  const [delayedErrors, setDelayedErrors] = 
    useState<Record<string, SlackMessage[]>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  // 실행 중인 프로세스들을 추적
  const runningProcessesRef = useRef<Map<string, RunningProcess>>(new Map());
  const mountedRef = useRef(true);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const delayCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 컴포넌트 마운트 상태 추적
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      
      // 모든 타이머 정리
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      if (delayCheckTimeoutRef.current) clearTimeout(delayCheckTimeoutRef.current);
      if (cleanupTimeoutRef.current) clearTimeout(cleanupTimeoutRef.current);
      
      // 프로세스 맵 정리
      const currentProcesses = runningProcessesRef.current;
      if (currentProcesses) {
        currentProcesses.clear();
      }
    };
  }, []);

  // 에러 처리 함수
  const handleError = useCallback((error: any, context: string) => {
    console.error(`[ERROR] ${context}:`, error);
    if (mountedRef.current) {
      setError(`${context} 중 오류가 발생했습니다: ${error.message}`);
    }
  }, []);

  // 프로세스 정리 함수
  const cleanupOldProcesses = useCallback(() => {
    const now = Date.now();
    const maxAge = CONFIG.cleanupIntervalMinutes * 60 * 1000;
    let cleanedCount = 0;
    
    const currentProcesses = runningProcessesRef.current;
    if (!currentProcesses) return;
    
    currentProcesses.forEach((process, key) => {
      if (now - process.lastChecked > maxAge) {
        currentProcesses.delete(key);
        cleanedCount++;
      }
    });
    
    if (CONFIG.debugMode && cleanedCount > 0) {
      console.log(`[CLEANUP] ${cleanedCount}개의 오래된 프로세스 정리됨`);
    }
    
    // 맵이 너무 크면 강제로 정리
    if (currentProcesses.size > CONFIG.maxProcesses) {
      const entries = Array.from(currentProcesses.entries());
      entries.sort((a, b) => a[1].lastChecked - b[1].lastChecked);
      
      const toDelete = entries.slice(0, Math.floor(CONFIG.maxProcesses * 0.3));
      toDelete.forEach(([key]) => currentProcesses.delete(key));
      
      if (CONFIG.debugMode) {
        console.log(`[CLEANUP] 메모리 절약을 위해 ${toDelete.length}개 프로세스 강제 정리`);
      }
    }
  }, []);

  // 실행 중인 프로세스 업데이트 함수 - 타입 안전성 개선
  const updateRunningProcesses = useCallback((channelCode: string, newMessages: SlackMessage[], oldMessages: SlackMessage[]) => {
    const now = Date.now();
    const currentProcesses = runningProcessesRef.current;
    if (!currentProcesses) return;
    
    // 새로운 메시지들만 처리
    const addedMessages = newMessages.filter(msg => 
      !oldMessages.some(oldMsg => oldMsg.ts === msg.ts)
    );
    
    addedMessages.forEach(msg => {
      if (!msg.text || !msg.ts) return;
      
      const startMatch = parseStartMessage(msg.text);
      const endMatch = parseEndMessage(msg.text);
      
      if (startMatch) {
        // 시작 메시지 - 실행 중인 프로세스로 등록
        const processKey = `${channelCode}_${startMatch.client}`;
        
        const runningProcess: RunningProcess = {
          processId: processKey,
          client: startMatch.client,
          requestCount: startMatch.count,
          startTime: Number(msg.ts) * 1000,
          message: msg,
          channelCode,
          lastChecked: now
        };
        
        currentProcesses.set(processKey, runningProcess);
        
        if (CONFIG.debugMode) {
          console.log(`[PROCESS] 시작 등록: ${processKey} (${startMatch.count}건 요청)`);
        }
      } else if (endMatch) {
        // 완료 메시지 - 관련된 프로세스들 제거
        const processKey = `${channelCode}_${endMatch.client}`;
        
        if (currentProcesses.has(processKey)) {
          currentProcesses.delete(processKey);
          if (CONFIG.debugMode) {
            console.log(`[PROCESS] 완료 제거: ${processKey} (${endMatch.count}건 처리)`);
          }
        }
      }
    });
  }, []);

  // 메시지 fetch 함수 - debounced
  const fetchAllMessages = useCallback(async () => {
    if (!mountedRef.current || allChannels.length === 0) return;
    
    setIsLoading(true);
    setError(null);
    
    const startDateObj = new Date(startDate);
    startDateObj.setHours(0, 0, 0, 0);
    const startTimestamp = startDateObj.getTime() / 1000;
    
    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999);
    const endTimestamp = endDateObj.getTime() / 1000;

    try {
      const results: ChannelResult[] = [];
      const fetchPromises = allChannels.map(async (ch) => {
        try {
          const url = `/api/slack?channel=${encodeURIComponent(ch.code)}&startDate=${startDate}&endDate=${endDate}`;
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          if (data.error) {
            console.warn(`[WARNING] Channel ${ch.name} error:`, data.error);
            return { code: ch.code, messages: [] };
          }
          
          const messages = Array.isArray(data.messages) ? data.messages : [];
          
          const filteredMessages = messages.filter((m: any) => {
            if (!m || !m.text || !m.ts) return false;
            const msgTimestamp = parseFloat(m.ts);
            return msgTimestamp >= startTimestamp && msgTimestamp <= endTimestamp;
          }) as SlackMessage[];
          
          return { code: ch.code, messages: filteredMessages };

        } catch (error) {
          console.error(`[ERROR] Channel ${ch.name} fetch failed:`, error);
          return { code: ch.code, messages: [] };
        }
      });

      const channelResults = await Promise.allSettled(fetchPromises);
      
      channelResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`[ERROR] Channel ${allChannels[index].name} failed:`, result.reason);
          results.push({ code: allChannels[index].code, messages: [] });
        }
      });

      if (!mountedRef.current) return;
      
      // 메시지 업데이트 및 프로세스 추적
      setAllMessagesAllByChannel(prev => {
        let changed = false;
        const next = { ...prev };
        
        for (const result of results) {
          const oldArr = prev[result.code] || [];
          const newArr = result.messages;
          
          if (!areErrorMessagesEqual(oldArr, newArr)) {
            next[result.code] = newArr;
            changed = true;
            
            // 실행 중인 프로세스 업데이트
            updateRunningProcesses(result.code, newArr, oldArr);
          }
        }
        
        return changed ? next : prev;
      });
      
      setLastFetchTime(new Date());
      
    } catch (error) {
      handleError(error, '메시지 로드');
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [allChannels, startDate, endDate, updateRunningProcesses, handleError]);

  // Debounced fetch 함수
  const debouncedFetch = useMemo(
    () => debounce(fetchAllMessages, 1000),
    [fetchAllMessages]
  );

  // 지연 에러 체크 함수 - 타입 안전성 개선
  const checkDelayedErrors = useCallback(() => {
    if (!mountedRef.current) return;

    const delayedByChannel: Record<string, SlackMessage[]> = {};
    const thresholdMs = CONFIG.delayThresholdMinutes * 60 * 1000;
    const currentTime = Date.now();
    let totalDelayedMessages = 0;

    const currentProcesses = runningProcessesRef.current;
    if (!currentProcesses) return;

    if (CONFIG.debugMode) {
      console.log(`[DELAY CHECK] 시작 - ${currentProcesses.size}개 프로세스 확인`);
    }
    
    const processesToRemove: string[] = [];
    
    currentProcesses.forEach((process, key) => {
      const elapsedTime = currentTime - process.startTime;
      
      // lastChecked 업데이트
      process.lastChecked = currentTime;
      
      if (elapsedTime > thresholdMs) {
        const delayMinutes = Math.floor(elapsedTime / 1000 / 60);
        
        if (CONFIG.debugMode) {
          console.log(`[DELAY] 지연 감지: ${process.client} 작업 (${delayMinutes}분)`);
        }
        
        const delayedMsg: SlackMessage = {
          ...process.message,
          text: `[DELAYED ${delayMinutes}min] ${process.client} 작업이 ${delayMinutes}분째 진행중입니다. 요청건수: ${process.requestCount}`,
          delayDuration: delayMinutes,
          level: 'HIGH',
          priority: 2,
          color: '#f97316'
        };
        
        if (!delayedByChannel[process.channelCode]) {
          delayedByChannel[process.channelCode] = [];
        }
        delayedByChannel[process.channelCode].push(delayedMsg);
        totalDelayedMessages++;
        
        // 중복 알림 방지를 위해 제거 대상으로 표시
        processesToRemove.push(key);
      }
    });

    // 지연 에러로 처리된 프로세스들 제거
    processesToRemove.forEach(key => {
      currentProcesses.delete(key);
    });

    if (CONFIG.debugMode) {
      console.log(`[DELAY CHECK] 완료 - ${totalDelayedMessages}개 지연 에러 발견`);
    }
    
    setDelayedErrors(delayedByChannel);
  }, []);

  // 주기적인 작업들 설정
  useEffect(() => {
    if (allChannels.length === 0) return;

    // 즉시 실행
    debouncedFetch();

    // 초기 지연 에러 체크 (2초 후)
    const initialDelayCheck = setTimeout(() => {
      if (mountedRef.current) {
        checkDelayedErrors();
      }
    }, 2000);

    // 정기적인 메시지 fetch
    const setupFetchInterval = () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      
      const scheduleNext = () => {
        if (mountedRef.current) {
          fetchTimeoutRef.current = setTimeout(() => {
            debouncedFetch();
            scheduleNext();
          }, CONFIG.fetchIntervalSeconds * 1000);
        }
      };
      
      scheduleNext();
    };

    // 정기적인 지연 에러 체크
    const setupDelayCheckInterval = () => {
      if (delayCheckTimeoutRef.current) clearTimeout(delayCheckTimeoutRef.current);
      
      const scheduleNext = () => {
        if (mountedRef.current) {
          delayCheckTimeoutRef.current = setTimeout(() => {
            checkDelayedErrors();
            scheduleNext();
          }, CONFIG.checkIntervalSeconds * 1000);
        }
      };
      
      scheduleNext();
    };

    // 정기적인 프로세스 정리
    const setupCleanupInterval = () => {
      if (cleanupTimeoutRef.current) clearTimeout(cleanupTimeoutRef.current);
      
      const scheduleNext = () => {
        if (mountedRef.current) {
          cleanupTimeoutRef.current = setTimeout(() => {
            cleanupOldProcesses();
            scheduleNext();
          }, CONFIG.cleanupIntervalMinutes * 60 * 1000);
        }
      };
      
      scheduleNext();
    };

    setupFetchInterval();
    setupDelayCheckInterval();
    setupCleanupInterval();

    return () => {
      clearTimeout(initialDelayCheck);
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      if (delayCheckTimeoutRef.current) clearTimeout(delayCheckTimeoutRef.current);
      if (cleanupTimeoutRef.current) clearTimeout(cleanupTimeoutRef.current);
    };
  }, [allChannels, startDate, endDate, debouncedFetch, checkDelayedErrors, cleanupOldProcesses]);

  // 작업 관련 메시지 필터링 (시작/완료 메시지 + 에러 메시지)
  const errorMessagesAllByChannel = useMemo(() => {
    const workMessages: Record<string, SlackMessage[]> = {};
    Object.entries(allMessagesAllByChannel).forEach(([channelCode, messages]) => {
      workMessages[channelCode] = messages.filter(msg => 
        msg.text && isWorkRelatedMessage(msg.text)
      );
    });
    return workMessages;
  }, [allMessagesAllByChannel]);

  // 읽지 않은 작업 관련 메시지만 필터링
  const filteredErrorMessagesByChannel = useMemo(() => {
    const filtered: Record<string, SlackMessage[]> = {};
    Object.entries(errorMessagesAllByChannel).forEach(([channelCode, messages]) => {
      filtered[channelCode] = messages.filter(msg => msg.ts && !readMessages.has(msg.ts));
    });
    return filtered;
  }, [errorMessagesAllByChannel, readMessages]);

  // 읽지 않은 지연 에러만 필터링
  const filteredDelayedErrors = useMemo(() => {
    const filtered: Record<string, SlackMessage[]> = {};
    Object.entries(delayedErrors).forEach(([channelCode, messages]) => {
      filtered[channelCode] = messages.filter(msg => msg.ts && !readMessages.has(msg.ts));
    });
    return filtered;
  }, [delayedErrors, readMessages]);

  // 통계 정보 - 타입 안전성 개선
  const stats = useMemo(() => {
    const runningProcessesList = Array.from(runningProcessesRef.current?.values() || []);
    
    return {
      runningProcessesCount: runningProcessesList.length,
      totalErrorMessages: Object.values(errorMessagesAllByChannel).reduce((sum, msgs) => sum + msgs.length, 0),
      totalDelayedErrors: Object.values(delayedErrors).reduce((sum, msgs) => sum + msgs.length, 0),
      lastFetchTime,
      isLoading,
      error,
      // 추가 통계
      runningProcesses: runningProcessesList.map(p => ({
        client: p.client,
        requestCount: p.requestCount,
        channel: p.channelCode,
        elapsedMinutes: Math.floor((Date.now() - p.startTime) / 1000 / 60)
      }))
    };
  }, [errorMessagesAllByChannel, delayedErrors, lastFetchTime, isLoading, error]);

  return {
    errorMessagesAllByChannel,
    filteredErrorMessagesByChannel,
    delayedErrors: filteredDelayedErrors,
    allDelayedErrors: delayedErrors,
    stats
  };
};