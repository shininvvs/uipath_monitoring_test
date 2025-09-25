// src/utils/messageParser.ts

import { ParsedMessage, MessageType, SlackMessage } from '../types/message';
import { MESSAGE_PATTERNS } from './constants';

export class MessageParser {
  static parseSlackMessage(message: SlackMessage): ParsedMessage | null {
    const text = message.text.trim();
    const timestamp = new Date(parseFloat(message.timestamp) * 1000);

    // 시작 메시지 파싱
    const startMatch = text.match(MESSAGE_PATTERNS.START_PATTERN);
    if (startMatch) {
      const [, channelName, countStr] = startMatch;
      return {
        channelName: channelName.trim(),
        messageType: MessageType.START,
        count: parseInt(countStr, 10),
        isError: false,
        timestamp,
        originalText: text
      };
    }

    // 완료 메시지 파싱
    const completeMatch = text.match(MESSAGE_PATTERNS.COMPLETE_PATTERN);
    if (completeMatch) {
      const [, channelName, countStr] = completeMatch;
      return {
        channelName: channelName.trim(),
        messageType: MessageType.COMPLETE,
        count: parseInt(countStr, 10),
        isError: false,
        timestamp,
        originalText: text
      };
    }

    // 에러 메시지 체크
    const hasErrorKeyword = MESSAGE_PATTERNS.ERROR_KEYWORDS.some(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    );

    if (hasErrorKeyword) {
      const channelName = this.extractChannelNameFromError(text);
      return {
        channelName: channelName || 'unknown',
        messageType: MessageType.ERROR,
        count: 0,
        isError: true,
        timestamp,
        originalText: text
      };
    }

    return null;
  }

  private static extractChannelNameFromError(text: string): string | null {
    const patterns = [
      /^(.+?)\s+에러/,
      /^(.+?)\s+오류/,
      /^(.+?)\s+error/i,
      /^(.+?)\s+fail/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    return null;
  }

  static validateMessage(parsedMessage: ParsedMessage): boolean {
    return parsedMessage.channelName !== 'unknown' && 
           parsedMessage.messageType !== MessageType.UNKNOWN;
  }
}

// 편의를 위한 직접 export 함수 (channel_name을 channel로 수정)
export const parseSlackMessage = (text: string, channelName: string, timestamp: Date): ParsedMessage | null => {
  const slackMessage: SlackMessage = {
    text,
    timestamp: (timestamp.getTime() / 1000).toString(),
    channel: channelName, // channel_name -> channel로 수정
    user: 'webhook'
  };
  
  return MessageParser.parseSlackMessage(slackMessage);
};

// Webhook에서 사용할 수 있도록 SlackWebhookPayload 직접 처리하는 함수
export const parseWebhookMessage = (payload: {
  text: string;
  channel_name: string;
  timestamp: string;
}): ParsedMessage | null => {
  const slackMessage: SlackMessage = {
    text: payload.text,
    timestamp: payload.timestamp,
    channel: payload.channel_name, // channel_name을 channel로 매핑
    user: 'webhook'
  };
  
  return MessageParser.parseSlackMessage(slackMessage);
};

// 기본 export
export default MessageParser;
