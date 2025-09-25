// app/api/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { ChannelManager } from '../../../src/utils/channelManager';
import { parseWebhookMessage } from '../../../src/utils/messageParser';
import { broadcastChannelUpdate } from '../events/route';

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

// 채널 매니저 인스턴스 (싱글톤)
let channelManagerInstance: ChannelManager | null = null;

function getChannelManager(): ChannelManager {
  if (!channelManagerInstance) {
    channelManagerInstance = new ChannelManager();
  }
  return channelManagerInstance;
}

export async function POST(request: NextRequest) {
  try {
    const payload: SlackWebhookPayload = await request.json();
    console.log('📨 Webhook received:', payload);

    // 메시지 파싱
    const parsedMessage = parseWebhookMessage({
      text: payload.text,
      channel_name: payload.channel_name,
      timestamp: payload.timestamp
    });
    
    if (!parsedMessage) {
      return NextResponse.json({ 
        success: true, 
        message: 'Message ignored (not relevant)' 
      });
    }

    // 채널 매니저로 메시지 처리
    const channelManager = getChannelManager();
    const channelUpdate = channelManager.processMessage(parsedMessage);

    if (channelUpdate) {
      // SSE를 통해 실시간 업데이트 브로드캐스트
      broadcastChannelUpdate(channelUpdate);
      
      console.log('✅ Channel update broadcasted via SSE:', channelUpdate);
    }

    return NextResponse.json({
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
    
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
