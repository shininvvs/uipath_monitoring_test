import { useState, useEffect, useCallback, useRef } from "react";

// localStorage 키
const STORAGE_KEY = 'slack_monitor_read_messages';
const STORAGE_VERSION = '1.0';

// 저장소 데이터 구조
interface StorageData {
  version: string;
  readMessages: string[];
  lastCleanup: number;
  metadata?: {
    totalMarked: number;
    lastUpdated: number;
  };
}

// 설정
const CONFIG = {
  maxStoredMessages: 10000, // 최대 저장할 읽음 메시지 수
  cleanupIntervalDays: 7, // 정리 주기 (일)
  batchSize: 100, // 배치 처리 크기
  debounceMs: 500, // 저장 디바운스 시간
};

export const useReadStatus = () => {
  const [readMessages, setReadMessages] = useState<Set<string>>(new Set());
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 성능 최적화를 위한 refs
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef<Set<string> | null>(null);
  const lastSaveTimeRef = useRef<number>(0);

  // localStorage 지원 여부 확인
  const isLocalStorageSupported = useCallback(() => {
    try {
      const testKey = '__localStorage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }, []);

  // 안전한 localStorage 읽기
  const safeLoadFromStorage = useCallback((): StorageData | null => {
    if (!isLocalStorageSupported()) {
      console.warn('[ReadStatus] localStorage가 지원되지 않습니다.');
      return null;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const data: StorageData = JSON.parse(stored);
      
      // 버전 호환성 체크
      if (data.version !== STORAGE_VERSION) {
        console.warn('[ReadStatus] 버전 불일치로 데이터를 초기화합니다.');
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      // 데이터 유효성 검증
      if (!Array.isArray(data.readMessages)) {
        throw new Error('잘못된 데이터 형식');
      }

      return data;
    } catch (error) {
      console.error('[ReadStatus] 저장소 읽기 오류:', error);
      setError('읽음 상태를 불러오는데 실패했습니다.');
      
      // 손상된 데이터 정리
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // 무시
      }
      
      return null;
    }
  }, [isLocalStorageSupported]);

  // 안전한 localStorage 쓰기 - debounced
  const safeSaveToStorage = useCallback((messages: Set<string>) => {
    if (!isLocalStorageSupported()) return;

    // 기존 타이머 취소
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 저장할 데이터 준비
    pendingSaveRef.current = messages;

    // debounced 저장
    saveTimeoutRef.current = setTimeout(() => {
      if (!pendingSaveRef.current) return;

      try {
        const messagesArray = Array.from(pendingSaveRef.current);
        
        // 메시지 수 제한 (가장 최근 것들만 유지)
        const limitedMessages = messagesArray.length > CONFIG.maxStoredMessages
          ? messagesArray.slice(-CONFIG.maxStoredMessages)
          : messagesArray;

        const storageData: StorageData = {
          version: STORAGE_VERSION,
          readMessages: limitedMessages,
          lastCleanup: Date.now(),
          metadata: {
            totalMarked: messagesArray.length,
            lastUpdated: Date.now()
          }
        };

        const dataString = JSON.stringify(storageData);
        
        // 저장소 용량 체크 (대략적)
        if (dataString.length > 5 * 1024 * 1024) { // 5MB 초과 시
          console.warn('[ReadStatus] 저장소 용량이 큽니다. 데이터를 정리합니다.');
          
          // 절반만 유지
          storageData.readMessages = limitedMessages.slice(-Math.floor(CONFIG.maxStoredMessages / 2));
          
          localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
        } else {
          localStorage.setItem(STORAGE_KEY, dataString);
        }
        
        lastSaveTimeRef.current = Date.now();
        
        // 에러 상태 해제
        if (error && error.includes('저장')) {
          setError(null);
        }

      } catch (saveError: any) {
        console.error('[ReadStatus] 저장소 쓰기 오류:', saveError);
        
        // 용량 초과 오류 처리
        if (saveError.name === 'QuotaExceededError') {
          setError('저장소 용량이 부족합니다. 읽음 상태 일부가 손실될 수 있습니다.');
          
          // 강제로 데이터 절반 정리
          try {
            const reducedMessages = Array.from(pendingSaveRef.current || [])
              .slice(-Math.floor(CONFIG.maxStoredMessages / 4));
            
            const minimalData: StorageData = {
              version: STORAGE_VERSION,
              readMessages: reducedMessages,
              lastCleanup: Date.now()
            };
            
            localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalData));
          } catch {
            // 최후의 수단: 모든 데이터 삭제
            localStorage.removeItem(STORAGE_KEY);
          }
        } else {
          setError('읽음 상태 저장에 실패했습니다.');
        }
      } finally {
        pendingSaveRef.current = null;
      }
    }, CONFIG.debounceMs);
  }, [isLocalStorageSupported, error]);

  // 초기 로딩
  useEffect(() => {
    const initializeReadStatus = () => {
      setIsClient(true);
      setIsLoading(true);
      
      const stored = safeLoadFromStorage();
      if (stored?.readMessages) {
        setReadMessages(new Set(stored.readMessages));
        
        // 정리가 필요한지 확인
        const daysSinceCleanup = (Date.now() - stored.lastCleanup) / (1000 * 60 * 60 * 24);
        if (daysSinceCleanup > CONFIG.cleanupIntervalDays) {
          console.log('[ReadStatus] 정리 주기가 지나 데이터 정리를 수행합니다.');
          // 다음 저장 시 자동으로 정리됨
        }
      }
      
      setIsLoading(false);
    };

    initializeReadStatus();

    // 컴포넌트 언마운트 시 정리
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [safeLoadFromStorage]);

  // 단일 메시지 읽음 처리 - 최적화됨
  const handleMarkAsRead = useCallback((channelCode: string, messageTs: string) => {
    if (!messageTs) return;

    setReadMessages(prev => {
      if (prev.has(messageTs)) {
        return prev; // 이미 읽음 처리된 경우 상태 변경 없음
      }
      
      const newSet = new Set(prev);
      newSet.add(messageTs);
      
      // 비동기 저장
      if (isClient) {
        safeSaveToStorage(newSet);
      }
      
      return newSet;
    });
  }, [isClient, safeSaveToStorage]);

  // 다중 메시지 읽음 처리 - 배치 최적화
  const handleMarkMultipleAsRead = useCallback((messageTimestamps: string[]) => {
    if (!Array.isArray(messageTimestamps) || messageTimestamps.length === 0) {
      return;
    }

    setReadMessages(prev => {
      const newSet = new Set(prev);
      let hasChanges = false;
      
      // 배치 처리로 성능 최적화
      const batches = [];
      for (let i = 0; i < messageTimestamps.length; i += CONFIG.batchSize) {
        batches.push(messageTimestamps.slice(i, i + CONFIG.batchSize));
      }
      
      batches.forEach(batch => {
        batch.forEach(ts => {
          if (ts && !newSet.has(ts)) {
            newSet.add(ts);
            hasChanges = true;
          }
        });
      });
      
      if (hasChanges && isClient) {
        safeSaveToStorage(newSet);
      }
      
      return hasChanges ? newSet : prev;
    });
  }, [isClient, safeSaveToStorage]);

  // 채널별 읽음 처리
  const handleMarkChannelAsRead = useCallback((channelCode: string, messages: any[]) => {
    if (!Array.isArray(messages)) return;

    const timestamps = messages
      .filter(msg => msg?.ts && typeof msg.ts === 'string')
      .map(msg => msg.ts)
      .filter(ts => !readMessages.has(ts)); // 이미 읽은 것은 제외

    if (timestamps.length > 0) {
      handleMarkMultipleAsRead(timestamps);
    }
  }, [readMessages, handleMarkMultipleAsRead]);

  // 읽음 상태 해제 (특정 메시지)
  const handleMarkAsUnread = useCallback((messageTs: string) => {
    if (!messageTs) return;

    setReadMessages(prev => {
      if (!prev.has(messageTs)) {
        return prev; // 읽음 처리되지 않은 경우 상태 변경 없음
      }
      
      const newSet = new Set(prev);
      newSet.delete(messageTs);
      
      if (isClient) {
        safeSaveToStorage(newSet);
      }
      
      return newSet;
    });
  }, [isClient, safeSaveToStorage]);

  // 읽음 상태 완전 초기화
  const clearReadStatus = useCallback(() => {
    setReadMessages(new Set());
    
    if (isClient && isLocalStorageSupported()) {
      try {
        localStorage.removeItem(STORAGE_KEY);
        setError(null);
      } catch (clearError) {
        console.error('[ReadStatus] 초기화 오류:', clearError);
        setError('읽음 상태 초기화에 실패했습니다.');
      }
    }
  }, [isClient, isLocalStorageSupported]);

  // 오래된 읽음 상태 정리 (수동 실행)
  const cleanupOldReadStatus = useCallback((olderThanDays: number = 30) => {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    
    setReadMessages(prev => {
      const newSet = new Set<string>();
      let cleanedCount = 0;
      
      // 타임스탬프 기반 정리 (Slack 타임스탬프는 초 단위)
      prev.forEach(ts => {
        const msgTime = parseFloat(ts) * 1000; // 밀리초로 변환
        if (msgTime > cutoffTime) {
          newSet.add(ts);
        } else {
          cleanedCount++;
        }
      });
      
      console.log(`[ReadStatus] ${cleanedCount}개의 오래된 읽음 상태가 정리되었습니다.`);
      
      if (cleanedCount > 0 && isClient) {
        safeSaveToStorage(newSet);
      }
      
      return cleanedCount > 0 ? newSet : prev;
    });
  }, [isClient, safeSaveToStorage]);

  // 통계 정보
  const getReadStats = useCallback(() => {
    const stored = safeLoadFromStorage();
    
    return {
      totalRead: readMessages.size,
      lastSave: lastSaveTimeRef.current ? new Date(lastSaveTimeRef.current) : null,
      storageSize: stored ? JSON.stringify(stored).length : 0,
      lastCleanup: stored?.lastCleanup ? new Date(stored.lastCleanup) : null,
      isStorageSupported: isLocalStorageSupported(),
      error: error
    };
  }, [readMessages.size, safeLoadFromStorage, isLocalStorageSupported, error]);

  // 읽음 여부 확인 유틸리티
  const isMessageRead = useCallback((messageTs: string): boolean => {
    return readMessages.has(messageTs);
  }, [readMessages]);

  // 채널별 읽지 않은 메시지 수 계산
  const getUnreadCount = useCallback((messages: any[]): number => {
    if (!Array.isArray(messages)) return 0;
    
    return messages.filter(msg => 
      msg?.ts && typeof msg.ts === 'string' && !readMessages.has(msg.ts)
    ).length;
  }, [readMessages]);

  return {
    // 상태
    readMessages,
    isClient,
    isLoading,
    error,
    
    // 기본 기능
    handleMarkAsRead,
    handleMarkMultipleAsRead,
    handleMarkChannelAsRead,
    handleMarkAsUnread,
    clearReadStatus,
    
    // 유틸리티
    isMessageRead,
    getUnreadCount,
    cleanupOldReadStatus,
    getReadStats
  };
};