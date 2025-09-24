import { useState, useEffect, useRef } from "react";
import { Channel, SlackMessage } from "../types/monitoring";

type Alert = {
  id: string;
  channelName: string;
  message: string;
  created: string;
  ts?: string;
  type?: 'error' | 'delayed';
};

export const useNotifications = (
  allChannels: Channel[],
  errorMessagesAllByChannel: Record<string, SlackMessage[]>,
  delayedErrors: Record<string, SlackMessage[]>
) => {
  const [popupAlerts, setPopupAlerts] = useState<Alert[]>([]);
  const latestErrorIdsRef = useRef<Record<string, string>>({});
  const latestDelayedIdsRef = useRef<Record<string, string>>({});
  const isInitializedRef = useRef(false);

  // localStorage에서 최근 에러 ID들 복원
  useEffect(() => {
    if (!isInitializedRef.current) {
      try {
        const savedErrorIds = localStorage.getItem("latestErrorIds");
        const savedDelayedIds = localStorage.getItem("latestDelayedIds");
        
        if (savedErrorIds) {
          latestErrorIdsRef.current = JSON.parse(savedErrorIds);
        }
        if (savedDelayedIds) {
          latestDelayedIdsRef.current = JSON.parse(savedDelayedIds);
        }
      } catch (error) {
        console.error('Failed to restore notification state:', error);
        localStorage.removeItem("latestErrorIds");
        localStorage.removeItem("latestDelayedIds");
      }
      isInitializedRef.current = true;
    }
  }, []);

  // 일반 에러 알림 생성
  useEffect(() => {
    if (!isInitializedRef.current || allChannels.length === 0) {
      return;
    }

    const isFirstLoad = latestErrorIdsRef.current._firstLoad === undefined;
    
    if (isFirstLoad) {
      allChannels.forEach(ch => {
        const messages = errorMessagesAllByChannel[ch.code] || [];
        if (messages.length > 0) {
          const latest = messages[0];
          const eid = latest.ts || latest.text;
          latestErrorIdsRef.current[ch.code] = eid;
        }
      });
      latestErrorIdsRef.current._firstLoad = "true";
      
      try {
        localStorage.setItem("latestErrorIds", JSON.stringify(latestErrorIdsRef.current));
      } catch (error) {
        console.error('Failed to save error IDs:', error);
      }
      return;
    }

    const newAlerts: Alert[] = [];
    let hasChanges = false;
    
    allChannels.forEach(ch => {
      const messages = errorMessagesAllByChannel[ch.code] || [];
      if (messages.length > 0) {
        const latest = messages[0];
        const eid = latest.ts || latest.text;
        const previousEid = latestErrorIdsRef.current[ch.code];
        
        if (previousEid && previousEid !== eid) {
          newAlerts.push({
            id: ch.code,
            channelName: ch.name,
            message: latest.text,
            created: String(latest.ts ?? Date.now()),
            ts: latest.ts,
            type: 'error'
          });
        }
        
        if (latestErrorIdsRef.current[ch.code] !== eid) {
          latestErrorIdsRef.current[ch.code] = eid;
          hasChanges = true;
        }
      }
    });

    if (newAlerts.length > 0) {
      setPopupAlerts(prev => [...prev, ...newAlerts]);
    }
    
    if (hasChanges) {
      try {
        localStorage.setItem("latestErrorIds", JSON.stringify(latestErrorIdsRef.current));
      } catch (error) {
        console.error('Failed to save error IDs:', error);
      }
    }
  }, [errorMessagesAllByChannel, allChannels]);

  // 지연 에러 알림 생성
  useEffect(() => {
    if (!isInitializedRef.current || allChannels.length === 0) {
      return;
    }

    const isFirstLoad = latestDelayedIdsRef.current._firstLoad === undefined;
    
    if (isFirstLoad) {
      allChannels.forEach(ch => {
        const messages = delayedErrors[ch.code] || [];
        if (messages.length > 0) {
          const latest = messages[0];
          const did = latest.ts || latest.text;
          latestDelayedIdsRef.current[ch.code] = did;
        }
      });
      latestDelayedIdsRef.current._firstLoad = "true";
      
      try {
        localStorage.setItem("latestDelayedIds", JSON.stringify(latestDelayedIdsRef.current));
      } catch (error) {
        console.error('Failed to save delayed IDs:', error);
      }
      return;
    }

    const newDelayedAlerts: Alert[] = [];
    let hasDelayedChanges = false;
    
    allChannels.forEach(ch => {
      const messages = delayedErrors[ch.code] || [];
      
      if (messages.length > 0) {
        const latest = messages[0];
        const did = latest.ts || latest.text;
        const previousDid = latestDelayedIdsRef.current[ch.code];
        
        if (previousDid && previousDid !== did) {
          const delayMinutes = (latest as any).delayDuration || 1;
          
          newDelayedAlerts.push({
            id: ch.code,
            channelName: ch.name,
            message: `Process has been running for ${delayMinutes} minutes without completion: ${latest.text?.replace('[DELAYED] ', '') || 'Unknown process'}`,
            created: String(latest.ts ?? Date.now()),
            ts: latest.ts,
            type: 'delayed'
          });
        }
        
        if (latestDelayedIdsRef.current[ch.code] !== did) {
          latestDelayedIdsRef.current[ch.code] = did;
          hasDelayedChanges = true;
        }
      }
    });

    if (newDelayedAlerts.length > 0) {
      setPopupAlerts(prev => [...prev, ...newDelayedAlerts]);
    }
    
    if (hasDelayedChanges) {
      try {
        localStorage.setItem("latestDelayedIds", JSON.stringify(latestDelayedIdsRef.current));
      } catch (error) {
        console.error('Failed to save delayed IDs:', error);
      }
    }
  }, [delayedErrors, allChannels]);

  return {
    popupAlerts,
    setPopupAlerts
  };
};