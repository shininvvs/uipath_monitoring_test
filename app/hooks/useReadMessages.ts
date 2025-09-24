// hooks/useReadMessages.ts
import { useState, useEffect, useCallback } from 'react';

export function useReadMessages() {
  const [readMessages, setReadMessages] = useState<Set<string>>(new Set());
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const savedReadMessages = localStorage.getItem('readMessages');
    if (savedReadMessages) {
      try {
        const parsed = JSON.parse(savedReadMessages);
        setReadMessages(new Set(parsed));
      } catch (error) {
        console.error('읽음 상태 복원 실패:', error);
        localStorage.removeItem('readMessages');
      }
    }
  }, []);

  const handleMarkAsRead = useCallback((channelCode: string, messageTs: string) => {
    setReadMessages(prev => {
      if (prev.has(messageTs)) {
        return prev;
      }
      
      const newSet = new Set(prev);
      newSet.add(messageTs);
      
      if (isClient) {
        try {
          localStorage.setItem('readMessages', JSON.stringify(Array.from(newSet)));
        } catch (error) {
          console.error('읽음 상태 저장 실패:', error);
        }
      }
      
      return newSet;
    });
  }, [isClient]);

  return {
    readMessages,
    handleMarkAsRead
  };
}
