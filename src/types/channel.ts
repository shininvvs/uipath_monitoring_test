export interface Channel {
    id: string;
    name: string;
    status: ChannelStatus;
    requestCount: number;
    completedCount: number;
    errorCount: number;
    startTime?: Date;
    endTime?: Date;
    lastUpdated: Date;
    hasError: boolean;
    isDelayed: boolean;
  }
  
  export enum ChannelStatus {
    IDLE = 'idle',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed',
    ERROR = 'error',
    TIMEOUT = 'timeout'
  }
  
  export interface ChannelUpdate {
    channelId: string;
    channelName: string;
    status: ChannelStatus;
    requestCount?: number;
    completedCount?: number;
    errorCount?: number;
    hasError?: boolean;
    isDelayed?: boolean;
    timestamp: Date;
  }
  
  export interface ChannelCardProps {
    channel: Channel;
    onReset?: (channelId: string) => void;
  }