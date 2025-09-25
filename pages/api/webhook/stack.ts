// pages/api/webhook.ts 또는 app/api/webhook/route.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { channelManager } from '../../../src/utils/channelManager';
import { parseSlackMessage } from '../../../src/utils/messageParser';
import { broadcastChannelUpdate } from '../route'; // SSE 브로드캐스트 함수 가져오기

export interface SlackWebhookPayload {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  text: string;
  timestamp: string;
  trigger_word?: string;
}

export interface WebhookResponse {
  success: boolean;
  message?: string;
  channelUpdate?: {
    channelName: string;
    status: string;
    count: number;
  };
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<WebhookResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const payload: SlackWebhookPayload = req.body;
    console.log('📨 Webhook received:', payload);

    // 메시지 파싱
    const parsedMessage = parseSlackMessage(payload.text, payload.channel_name, new Date(payload.timestamp));
    
    if (!parsedMessage) {
      return res.status(200).json({ 
        success: true, 
        message: 'Message ignored (not relevant)' 
      });
    }

    // 채널 매니저로 메시지 처리
    const channelUpdate = channelManager.processMessage(parsedMessage);

    if (channelUpdate) {
      // SSE를 통해 실시간 업데이트 브로드캐스트
      broadcastChannelUpdate(channelUpdate);
      
      console.log('✅ Channel update broadcasted via SSE');
    }

    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      channelUpdate: channelUpdate ? {
        channelName: channelUpdate.channelName,
        status: channelUpdate.status,
        count: channelUpdate.requestCount || channelUpdate.completedCount || 0
      } : undefined
    });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}
