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