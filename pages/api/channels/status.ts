import { NextApiRequest, NextApiResponse } from 'next';
import { APIResponse } from '../../../src/types/webhook';
import { Channel } from '../../../src/types/channel';
import { channelManager } from '../../../src/utils/channelManager';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<APIResponse<Channel[]>>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      timestamp: new Date()
    });
  }

  try {
    const channels = channelManager.getAllChannels();
    
    return res.status(200).json({
      success: true,
      data: channels,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Channel status retrieval error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date()
    });
  }
}