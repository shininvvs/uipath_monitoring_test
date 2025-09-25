// app/api/events/route.ts

export const runtime = 'edge';

// 전역 스토리지 (실제 운영환경에서는 Redis 등 사용 권장)
const eventStreamClients = new Set<ReadableStreamDefaultController>();
const recentEvents: any[] = [];
const MAX_RECENT_EVENTS = 100;

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      console.log('📡 New SSE client connected');
      eventStreamClients.add(controller);

      // 최근 이벤트들을 즉시 전송
      recentEvents.forEach(event => {
        const eventString = `data: ${JSON.stringify(event)}\n\n`;
        try {
          controller.enqueue(encoder.encode(eventString));
        } catch (err) {
          console.error('Failed to send recent event:', err);
        }
      });

      // Keep-alive 메시지
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch (err) {
          clearInterval(keepAlive);
          eventStreamClients.delete(controller);
        }
      }, 30000);

      // 정리
      const cleanup = () => {
        clearInterval(keepAlive);
        eventStreamClients.delete(controller);
        console.log('📡 SSE client disconnected');
      };

      // 클라이언트 연결 해제 감지
      request.signal?.addEventListener('abort', cleanup);
      
      return {
        cancel() {
          cleanup();
        }
      };
    },

    cancel() {
      console.log('📡 SSE stream cancelled');
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}

// 이벤트 브로드캐스트 함수
export function broadcastToSSEClients(event: any) {
  console.log('📡 Broadcasting to SSE clients:', event);
  
  // 최근 이벤트에 추가
  recentEvents.push(event);
  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.shift();
  }

  const eventString = `data: ${JSON.stringify(event)}\n\n`;
  const encoder = new TextEncoder();
  
  // 모든 연결된 클라이언트에게 브로드캐스트
  const clientsToRemove: ReadableStreamDefaultController[] = [];
  
  eventStreamClients.forEach(controller => {
    try {
      controller.enqueue(encoder.encode(eventString));
    } catch (err) {
      console.error('Failed to send to client:', err);
      clientsToRemove.push(controller);
    }
  });

  // 실패한 클라이언트 제거
  clientsToRemove.forEach(controller => {
    eventStreamClients.delete(controller);
  });
}

// 채널 업데이트 브로드캐스트
export function broadcastChannelUpdate(update: any) {
  broadcastToSSEClients({
    type: 'channel_update',
    ...update,
    timestamp: new Date().toISOString()
  });
}

// 에러 브로드캐스트
export function broadcastError(error: string, details?: any) {
  broadcastToSSEClients({
    type: 'error',
    message: error,
    details,
    timestamp: new Date().toISOString()
  });
}
