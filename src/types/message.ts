export interface SlackMessage {
    text: string;
    channel: string;
    user: string;
    timestamp: string;
    thread_ts?: string;
  }
  
  export interface ParsedMessage {
    channelName: string;
    messageType: MessageType;
    count: number;
    isError: boolean;
    timestamp: Date;
    originalText: string;
  }
  
  export enum MessageType {
    START = 'start',
    COMPLETE = 'complete',
    ERROR = 'error',
    UNKNOWN = 'unknown'
  }
  
  export interface WebSocketMessage {
    type: 'CHANNEL_UPDATE' | 'CONNECTION_STATUS' | 'ERROR';
    data: any;
    timestamp: Date;
  }