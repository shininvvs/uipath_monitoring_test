// pages/api/events.ts

import { NextApiRequest, NextApiResponse } from 'next';

// Edge runtime을 사용하지 않는 버전
interface ExtendedNextApiResponse extends NextApiResponse {
  flush?: () => void;
}

// 전역 클라이언트 관리
const sseClients = new Set<ExtendedNextApiResponse>();
const recentEvents: any[] = [];
const MAX_RECENT_EVENTS = 100;

export default function handler(req: NextApiRequest, res: ExtendedNextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('📡 New SSE client connected');

  // SSE 헤더 설정
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // 클라이언트 추가
  sseClients.add(res);

  // 최근 이벤트들 즉시 전송
  recentEvents.forEach(event => {
    const eventString = `data: ${JSON.stringify(event)}\n\n`;
    res.write(eventString);
  });

  // Keep-alive 메시지
  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 30000);

  // 클라이언트 연결 해제 처리
  req.on('close', () => {
    console.log('📡 SSE client disconnected');
    clearInterval(keepAlive);
    sseClients.delete(res);
  });

  // 연결 유지를 위해 응답을 종료하지 않음
}

// 이벤트 브로드캐스트 함수들
export function broadcastToSSEClients(event: any) {
  console.log('📡 Broadcasting to SSE clients:', event);
  
  // 최근 이벤트에 추가
  recentEvents.push(event);
  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.shift();
  }

  const eventString = `data: ${JSON.stringify(event)}\n\n`;
  
  // 모든 연결된 클라이언트에게 브로드캐스트
  const clientsToRemove: ExtendedNextApiResponse[] = [];
  
  sseClients.forEach(client => {
    try {
      client.write(eventString);
      client.flush?.();
    } catch (err) {
      console.error('Failed to send to client:', err);
      clientsToRemove.push(client);
    }
  });

  // 실패한 클라이언트 제거
  clientsToRemove.forEach(client => {
    sseClients.delete(client);
  });
}

export function broadcastChannelUpdate(update: any) {
  broadcastToSSEClients({
    type: 'channel_update',
    ...update,
    timestamp: new Date().toISOString()
  });
}

export function broadcastError(error: string, details?: any) {
  broadcastToSSEClients({
    type: 'error',
    message: error,
    details,
    timestamp: new Date().toISOString()
  });
}
