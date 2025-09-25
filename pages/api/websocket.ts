// pages/api/websocket.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { Server as NetServer, IncomingMessage } from 'http';
import { Socket as NetSocket } from 'net';
import { ChannelUpdate } from '../../src/types/channel';

interface SocketServer extends NetServer {
  io?: SocketIOServer | undefined;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

// 글로벌 WebSocket 인스턴스
let io: SocketIOServer | null = null;

export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (res.socket.server.io) {
    console.log('Socket.IO already running');
    res.end();
    return;
  }

  console.log('Initializing Socket.IO server...');

  const io = new SocketIOServer(res.socket.server, {
    path: '/api/websocket',
    addTrailingSlash: false,
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // 연결된 클라이언트 관리
  const connectedClients = new Set<string>();

  io.on('connection', (socket) => {
    console.log(`🔌 WebSocket client connected: ${socket.id}`);
    connectedClients.add(socket.id);

    // 연결 확인 메시지
    socket.emit('connection_status', {
      connected: true,
      clientId: socket.id,
      timestamp: new Date().toISOString()
    });

    // 핑-퐁 헬스체크
    socket.on('ping', () => {
      socket.emit('pong', { 
        timestamp: new Date().toISOString(),
        clientCount: connectedClients.size
      });
    });

    // 채널 상태 요청 처리
    socket.on('request_channel_status', () => {
      // 현재 채널 상태를 가져와서 전송
      import('../../src/utils/channelManager').then(({ channelManager }) => {
        const channels = channelManager.getAllChannels();
        socket.emit('channel_status_response', {
          channels,
          timestamp: new Date().toISOString()
        });
      });
    });

    // 연결 해제 처리
    socket.on('disconnect', (reason) => {
      console.log(`🔌 WebSocket client disconnected: ${socket.id}, reason: ${reason}`);
      connectedClients.delete(socket.id);
    });

    socket.on('error', (error) => {
      console.error(`❌ WebSocket error for client ${socket.id}:`, error);
    });
  });

  res.socket.server.io = io;
  
  // 글로벌 인스턴스 저장
  setGlobalIO(io);

  res.end();
}

// 글로벌 WebSocket 인스턴스 관리
function setGlobalIO(ioInstance: SocketIOServer) {
  if (typeof global !== 'undefined') {
    (global as any).__socketIO = ioInstance;
  }
}

export function getGlobalIO(): SocketIOServer | null {
  if (typeof global !== 'undefined') {
    return (global as any).__socketIO || null;
  }
  return null;
}

// 채널 업데이트 브로드캐스트
export function broadcastChannelUpdate(update: ChannelUpdate) {
  const io = getGlobalIO();
  if (io) {
    console.log(`📡 Broadcasting channel update: ${update.channelName} - ${update.status}`);
    io.emit('channel_update', {
      ...update,
      timestamp: new Date().toISOString()
    });
  } else {
    console.log('⚠️ WebSocket not initialized, cannot broadcast update');
  }
}

// 에러 브로드캐스트
export function broadcastError(error: string, details?: any) {
  const io = getGlobalIO();
  if (io) {
    console.log(`📡 Broadcasting error: ${error}`);
    io.emit('error', {
      message: error,
      details,
      timestamp: new Date().toISOString()
    });
  }
}