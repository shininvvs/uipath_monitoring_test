// pages/api/channel-status.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { ChannelManager } from '../../src/utils/channelManager';

interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

// 싱글톤 채널 매니저
let channelManagerInstance: ChannelManager | null = null;

function getChannelManager(): ChannelManager {
  if (!channelManagerInstance) {
    channelManagerInstance = new ChannelManager();
  }
  return channelManagerInstance;
}

export default function handler(req: NextApiRequest, res: NextApiResponse<APIResponse>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed',
      timestamp: new Date()
    });
  }

  try {
    const channelManager = getChannelManager();
    const channels = channelManager.getAllChannels();

    console.log(`📊 Channel status requested, returning ${channels.length} channels`);

    return res.status(200).json({
      success: true,
      data: channels,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('❌ Failed to get channel status:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to get channel status',
      timestamp: new Date()
    });
  }
}
