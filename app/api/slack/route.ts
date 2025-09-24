import { NextRequest, NextResponse } from "next/server";

const SLACK_TOKEN = process.env.SLACK_TOKEN;

// Rate limiting을 위한 간단한 캐시
const requestCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 30000; // 30초 캐시

// Retry 로직이 있는 fetch 함수
async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      if (response.status === 429) {
        // Rate limit 에러 시 더 긴 대기
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 2000 * (i + 1);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      console.error(`Fetch attempt ${i + 1} failed:`, error);
      if (i === retries - 1) throw error;
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error('All retry attempts failed');
}

// Mock 데이터 생성 함수 (개발/테스트용)
function generateMockData(channel: string, startDate?: string, endDate?: string) {
  const mockMessages = [
    {
      text: "Error: Database connection failed",
      ts: (Date.now() / 1000 - 3600).toString(),
      user: "system",
      type: "message",
      bot_id: null,
      username: null,
      thread_ts: null,
      reply_count: 0,
    },
    {
      text: "배치 작업 시작: job_id_12345",
      ts: (Date.now() / 1000 - 1800).toString(),
      user: "batch_system",
      type: "message",
      bot_id: null,
      username: null,
      thread_ts: null,
      reply_count: 0,
    },
    {
      text: "Critical: Payment processing failed for user 67890",
      ts: (Date.now() / 1000 - 900).toString(),
      user: "payment_system",
      type: "message",
      bot_id: null,
      username: null,
      thread_ts: null,
      reply_count: 0,
    },
    {
      text: "Warning: High memory usage detected",
      ts: (Date.now() / 1000 - 300).toString(),
      user: "monitoring",
      type: "message",
      bot_id: null,
      username: null,
      thread_ts: null,
      reply_count: 0,
    }
  ];

  // 날짜 필터링 적용
  if (startDate && endDate) {
    const startTimestamp = new Date(startDate).getTime() / 1000;
    const endTimestamp = new Date(endDate + 'T23:59:59').getTime() / 1000;
    
    return mockMessages.filter(msg => {
      const msgTimestamp = parseFloat(msg.ts);
      return msgTimestamp >= startTimestamp && msgTimestamp <= endTimestamp;
    });
  }

  return mockMessages;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const limit = searchParams.get("limit") || "200";

  // 필수 파라미터 검증
  if (!channel) {
    return NextResponse.json(
      { error: "Channel ID is required" },
      { status: 400 }
    );
  }

  // Slack 토큰이 없으면 Mock 데이터 반환 (개발환경)
  if (!SLACK_TOKEN) {
    console.warn("[WARNING] SLACK_TOKEN not found. Using mock data for development.");
    
    if (process.env.NODE_ENV === 'development') {
      const mockMessages = generateMockData(channel, startDate || undefined, endDate || undefined);
      return NextResponse.json({ 
        messages: mockMessages,
        timestamp: new Date().toISOString(),
        mock: true
      });
    }

    return NextResponse.json(
      {
        error: "SLACK_TOKEN이 설정되지 않았습니다. 환경변수를 확인해주세요.",
        setup_guide: {
          message: ".env.local 파일에 SLACK_TOKEN=your-slack-bot-token을 추가하세요.",
          permissions_needed: ["channels:read", "channels:history", "groups:read", "groups:history"]
        }
      },
      { status: 500 }
    );
  }

  // 캐시 키 생성
  const cacheKey = `${channel}_${startDate}_${endDate}_${limit}`;
  const cached = requestCache.get(cacheKey);
  const now = Date.now();

  // 캐시된 데이터가 유효하면 반환
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    console.log(`[CACHE HIT] Returning cached data for ${channel}`);
    return NextResponse.json({
      ...cached.data,
      cached: true,
      cached_at: new Date(cached.timestamp).toISOString()
    });
  }

  try {
    const url = `https://slack.com/api/conversations.history?channel=${encodeURIComponent(channel)}&limit=${limit}`;

    console.log(`[API] Slack API 호출 시작: ${channel}`);

    const response = await fetchWithRetry(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${SLACK_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!data.ok) {
      console.error(`[ERROR] Slack API 오류:`, data.error);
      
      // 구체적인 에러 메시지 제공
      const errorMessages: Record<string, string> = {
        'channel_not_found': '채널을 찾을 수 없습니다. 채널 ID를 확인하세요.',
        'not_in_channel': '봇이 해당 채널에 참여하지 않았습니다.',
        'missing_scope': 'Slack 앱에 필요한 권한이 없습니다.',
        'invalid_auth': 'Slack 토큰이 유효하지 않습니다.',
        'account_inactive': 'Slack 계정이 비활성화되었습니다.'
      };

      const userFriendlyMessage = errorMessages[data.error] || `Slack API 오류: ${data.error}`;

      return NextResponse.json(
        { 
          error: userFriendlyMessage,
          slack_error: data.error,
          help: "https://api.slack.com/methods/conversations.history 문서를 확인하세요."
        },
        { status: 400 }
      );
    }

    // 메시지 데이터 정제
    let allMessages = (data.messages || []).map((msg: any) => ({
      text: msg.text || "",
      ts: msg.ts,
      user: msg.user || "unknown",
      type: msg.type || "message",
      bot_id: msg.bot_id,
      username: msg.username,
      thread_ts: msg.thread_ts,
      reply_count: msg.reply_count || 0,
      app_id: msg.app_id,
      subtype: msg.subtype
    }));

    // 날짜 범위 필터링
    if (startDate && endDate) {
      try {
        const startDateObj = new Date(startDate);
        startDateObj.setHours(0, 0, 0, 0);
        const startTimestamp = startDateObj.getTime() / 1000;
        
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        const endTimestamp = endDateObj.getTime() / 1000;

        const originalCount = allMessages.length;
        allMessages = allMessages.filter((msg: any) => {
          if (!msg.ts) return false;
          const msgTimestamp = parseFloat(msg.ts);
          return msgTimestamp >= startTimestamp && msgTimestamp <= endTimestamp;
        });

        console.log(`[FILTER] ${originalCount} -> ${allMessages.length} messages after date filtering`);
      } catch (dateError) {
        console.error('[ERROR] 날짜 파싱 오류:', dateError);
        return NextResponse.json(
          { error: "잘못된 날짜 형식입니다. YYYY-MM-DD 형식을 사용하세요." },
          { status: 400 }
        );
      }
    }

    // 최신 메시지부터 정렬
    allMessages.sort((a: any, b: any) => parseFloat(b.ts) - parseFloat(a.ts));

    const result = { 
      messages: allMessages,
      timestamp: new Date().toISOString(),
      total_count: allMessages.length,
      channel: channel,
      date_range: startDate && endDate ? { startDate, endDate } : null
    };

    // 캐시에 저장 (성공한 경우만)
    requestCache.set(cacheKey, { data: result, timestamp: now });
    
    // 캐시 크기 관리 (최대 100개 항목)
    if (requestCache.size > 100) {
      const oldestKey = requestCache.keys().next().value;
      if (oldestKey !== undefined) {
        requestCache.delete(oldestKey);
      }
    }    

    console.log(`[SUCCESS] ${allMessages.length} messages retrieved for channel ${channel}`);

    return NextResponse.json(result);

  } catch (err: any) {
    console.error("[ERROR] Slack API 호출 예외:", err);
    
    // 네트워크 오류와 기타 오류 구분
    const isNetworkError = err.message.includes('fetch') || err.message.includes('network');
    
    return NextResponse.json(
      { 
        error: isNetworkError 
          ? "네트워크 연결 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
          : "서버 내부 오류가 발생했습니다.",
        details: process.env.NODE_ENV === 'development' ? err.message : undefined,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}