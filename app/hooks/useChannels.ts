import { useState, useEffect } from "react";
import { Channel } from "../types/monitoring";

export const useChannels = () => {
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [myChannels, setMyChannels] = useState<Channel[]>([]);

  useEffect(() => {
    let mounted = true;
    
    fetch("/api/slack/channels")
      .then(res => res.json())
      .then(data => {
        if (mounted) {
          setAllChannels(data.channels || []);
        }
      })
      .catch(error => {
        console.error('채널 로드 실패:', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return {
    allChannels,
    myChannels,
    setMyChannels
  };
};
