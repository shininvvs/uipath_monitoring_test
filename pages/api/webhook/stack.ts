// pages/api/webhook/slack.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { SlackWebhookPayload, WebhookResponse } from '../../../src/types/webhook';
import { SlackMessage } from '../../../src/types/message';
import { MessageParser } from '../../../src/utils/messageParser';
import { channelManager } from '../../../src/utils/channelManager';
import { broadcastChannelUpdate } from '../websocket';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WebhookResponse>
) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // OPTIONS 요청 처리 (CORS 프리플라이트)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    const payload: SlackWebhookPayload = req.body;

    // 페이로드 검증
    if (!payload.text || !payload.channel_name || !payload.timestamp) {
      console.log('❌ Invalid payload:', payload);
      return res.status(400).json({
        success: false,
        message: 'Invalid payload: missing required fields'
      });
    }

    console.log(`📨 Received Slack message: "${payload.text}" from channel: ${payload.channel_name}`);

    // Slack 메시지 객체 생성
    const slackMessage: SlackMessage = {
      text: payload.text.trim(),
      channel: payload.channel_name,
      user: payload.user_name || 'unknown',
      timestamp: payload.timestamp
    };

    // 메시지 파싱
    const parsedMessage = MessageParser.parseSlackMessage(slackMessage);
    
    if (!parsedMessage) {
      console.log('ℹ️ Message ignored (not matching pattern):', payload.text);
      return res.status(200).json({
        success: true,
        message: 'Message ignored (not matching pattern)'
      });
    }

    // 메시지 검증
    if (!MessageParser.validateMessage(parsedMessage)) {
      console.log('❌ Invalid message format:', parsedMessage);
      return res.status(400).json({
        success: false,
        message: 'Invalid message format'
      });
    }

    console.log(`✅ Parsed message:`, {
      type: parsedMessage.messageType,
      channel: parsedMessage.channelName,
      count: parsedMessage.count,
      isError: parsedMessage.isError
    });

    // 채널 매니저에서 메시지 처리
    const channelUpdate = channelManager.processMessage(parsedMessage);
    
    if (channelUpdate) {
      console.log(`🔄 Channel update processed:`, {
        channel: channelUpdate.channelName,
        status: channelUpdate.status,
        requestCount: channelUpdate.requestCount,
        completedCount: channelUpdate.completedCount,
        errorCount: channelUpdate.errorCount
      });

      // 🚀 실시간 WebSocket 브로드캐스트
      broadcastChannelUpdate(channelUpdate);

      return res.status(200).json({
        success: true,
        message: 'Message processed successfully',
        channelUpdate: {
          channelName: channelUpdate.channelName,
          status: channelUpdate.status,
          count: channelUpdate.requestCount || channelUpdate.completedCount || 0
        }
      });
    } else {
      console.log('⚠️ Message processed but no channel update occurred');
      return res.status(200).json({
        success: true,
        message: 'Message processed but no channel update occurred'
      });
    }

  } catch (error) {
    console.error('❌ Slack webhook processing error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};