// app/api/channel-status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { ChannelManager } from '../../../src/utils/channelManager';

// 채널 매니저 인스턴스 (싱글톤)
let channelManagerInstance: ChannelManager | null = null;

function getChannelManager(): ChannelManager {
  if (!channelManagerInstance) {
    channelManagerInstance = new ChannelManager();
  }
  return channelManagerInstance;
}

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Channel status requested');
    
    const channelManager = getChannelManager();
    const channels = channelManager.getAllChannels();
    
    return NextResponse.json({
      success: true,
      data: channels,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('❌ Failed to get channel status:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get channel status',
      timestamp: new Date()
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
