import { Channel, ChannelStatus, ChannelUpdate } from '../types/channel';
import { ParsedMessage, MessageType } from '../types/message';
import { TIMEOUT_DURATION } from './constants';

export class ChannelManager {
  private channels: Map<string, Channel> = new Map();
  private timeoutIntervals: Map<string, NodeJS.Timeout> = new Map();

  processMessage(parsedMessage: ParsedMessage): ChannelUpdate | null {
    const channelId = parsedMessage.channelName;
    let channel = this.channels.get(channelId);

    if (!channel) {
      channel = this.createChannel(channelId, parsedMessage.channelName);
      this.channels.set(channelId, channel);
    }

    switch (parsedMessage.messageType) {
      case MessageType.START:
        return this.handleStartMessage(channel, parsedMessage);
      case MessageType.COMPLETE:
        return this.handleCompleteMessage(channel, parsedMessage);
      case MessageType.ERROR:
        return this.handleErrorMessage(channel, parsedMessage);
      default:
        return null;
    }
  }

  private createChannel(id: string, name: string): Channel {
    return {
      id,
      name,
      status: ChannelStatus.IDLE,
      requestCount: 0,
      completedCount: 0,
      errorCount: 0,
      lastUpdated: new Date(),
      hasError: false,
      isDelayed: false
    };
  }

  private handleStartMessage(channel: Channel, message: ParsedMessage): ChannelUpdate {
    this.clearChannelTimeout(channel.id);
    
    channel.status = ChannelStatus.IN_PROGRESS;
    channel.requestCount = message.count;
    channel.startTime = message.timestamp;
    channel.endTime = undefined;
    channel.hasError = false;
    channel.isDelayed = false;
    channel.lastUpdated = new Date();

    this.setChannelTimeout(channel.id);
    return this.createChannelUpdate(channel);
  }

  private handleCompleteMessage(channel: Channel, message: ParsedMessage): ChannelUpdate {
    this.clearChannelTimeout(channel.id);
    
    channel.status = ChannelStatus.COMPLETED;
    channel.completedCount = message.count;
    channel.endTime = message.timestamp;
    channel.lastUpdated = new Date();

    if (channel.requestCount > 0) {
      channel.errorCount = Math.max(0, channel.requestCount - channel.completedCount);
      if (channel.errorCount > 0) {
        channel.hasError = true;
      }
    }

    return this.createChannelUpdate(channel);
  }

  private handleErrorMessage(channel: Channel, message: ParsedMessage): ChannelUpdate {
    channel.hasError = true;
    channel.status = ChannelStatus.ERROR;
    channel.lastUpdated = new Date();
    return this.createChannelUpdate(channel);
  }

  private setChannelTimeout(channelId: string): void {
    const timeoutId = setTimeout(() => {
      const channel = this.channels.get(channelId);
      if (channel && channel.status === ChannelStatus.IN_PROGRESS) {
        channel.status = ChannelStatus.TIMEOUT;
        channel.isDelayed = true;
        channel.hasError = true;
        channel.lastUpdated = new Date();
      }
    }, TIMEOUT_DURATION);

    this.timeoutIntervals.set(channelId, timeoutId);
  }

  private clearChannelTimeout(channelId: string): void {
    const timeoutId = this.timeoutIntervals.get(channelId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeoutIntervals.delete(channelId);
    }
  }

  private createChannelUpdate(channel: Channel): ChannelUpdate {
    return {
      channelId: channel.id,
      channelName: channel.name,
      status: channel.status,
      requestCount: channel.requestCount,
      completedCount: channel.completedCount,
      errorCount: channel.errorCount,
      hasError: channel.hasError,
      isDelayed: channel.isDelayed,
      timestamp: new Date()
    };
  }

  getAllChannels(): Channel[] {
    return Array.from(this.channels.values());
  }

  getChannel(channelId: string): Channel | undefined {
    return this.channels.get(channelId);
  }

  resetChannel(channelId: string): boolean {
    const channel = this.channels.get(channelId);
    if (channel) {
      this.clearChannelTimeout(channelId);
      channel.status = ChannelStatus.IDLE;
      channel.requestCount = 0;
      channel.completedCount = 0;
      channel.errorCount = 0;
      channel.hasError = false;
      channel.isDelayed = false;
      channel.startTime = undefined;
      channel.endTime = undefined;
      channel.lastUpdated = new Date();
      return true;
    }
    return false;
  }
}

export const channelManager = new ChannelManager();