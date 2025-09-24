// config/delayConfig.ts
export interface DelayErrorConfig {
    // 지연 판단 임계값 (분)
    delayThresholdMinutes: number;
    
    // 체크 간격 (초)
    checkIntervalSeconds: number;
    
    // 메시지 fetch 간격 (초) 
    fetchIntervalSeconds: number;
    
    // 디버그 모드
    debugMode: boolean;
    
    // 시작 키워드 패턴들
    startPatterns: RegExp[];
    
    // 종료 키워드 패턴들  
    endPatterns: RegExp[];
    
    // 프로세스 ID 패턴들
    processIdPatterns: RegExp[];
  }
  
  export const DEFAULT_DELAY_CONFIG: DelayErrorConfig = {
    // 개발환경: 3분, 운영환경: 15분 권장
    delayThresholdMinutes: process.env.NODE_ENV === 'production' ? 15 : 3,
    
    // 지연 에러 체크 간격: 30초
    checkIntervalSeconds: 30,
    
    // 실시간 메시지 fetch 간격: 10초
    fetchIntervalSeconds: 10,
    
    // 디버그 모드 (개발환경에서만 활성화)
    debugMode: process.env.NODE_ENV !== 'production',
    
    // 시작 패턴들
    startPatterns: [
      /시작/gi, /start/gi, /begin/gi, /initiated/gi, /started/gi, /starting/gi,
      /배치\s*시작/gi, /작업\s*시작/gi, /프로세스\s*시작/gi,
      /job\s*start/gi, /task\s*start/gi, /process\s*start/gi,
      /batch\s*start/gi, /execution\s*start/gi,
      // 추가 패턴들
      /processing\s*start/gi, /run\s*start/gi, /launch/gi, /launched/gi
    ],
    
    // 종료 패턴들
    endPatterns: [
      /종료/gi, /완료/gi, /end/gi, /finish/gi, /completed/gi, /done/gi, 
      /finished/gi, /success/gi, /successful/gi,
      /배치\s*완료/gi, /작업\s*완료/gi, /프로세스\s*완료/gi,
      /job\s*complete/gi, /task\s*complete/gi, /process\s*complete/gi,
      /batch\s*complete/gi, /execution\s*complete/gi,
      // 추가 패턴들
      /processing\s*complete/gi, /run\s*complete/gi, /terminated/gi
    ],
    
    // 프로세스 ID 패턴들
    processIdPatterns: [
      /job[_-]?id[:\s]*([a-zA-Z0-9\-_]+)/gi,
      /task[_-]?id[:\s]*([a-zA-Z0-9\-_]+)/gi,
      /process[_-]?id[:\s]*([a-zA-Z0-9\-_]+)/gi,
      /batch[_-]?id[:\s]*([a-zA-Z0-9\-_]+)/gi,
      /request[_-]?id[:\s]*([a-zA-Z0-9\-_]+)/gi,
      /execution[_-]?id[:\s]*([a-zA-Z0-9\-_]+)/gi,
      // 한국어 패턴
      /작업\s*번호[:\s]*([a-zA-Z0-9\-_]+)/gi,
      /배치\s*번호[:\s]*([a-zA-Z0-9\-_]+)/gi,
      /프로세스\s*번호[:\s]*([a-zA-Z0-9\-_]+)/gi,
      // 추가 패턴
      /run[_-]?id[:\s]*([a-zA-Z0-9\-_]+)/gi,
      /transaction[_-]?id[:\s]*([a-zA-Z0-9\-_]+)/gi
    ]
  };
  
  // 런타임에 설정을 조정할 수 있는 함수들
  export function createDelayConfig(overrides: Partial<DelayErrorConfig> = {}): DelayErrorConfig {
    return {
      ...DEFAULT_DELAY_CONFIG,
      ...overrides
    };
  }
  
  // 환경변수를 통한 설정 오버라이드
  export function getDelayConfigFromEnv(): DelayErrorConfig {
    const config = { ...DEFAULT_DELAY_CONFIG };
    
    // 환경변수에서 설정값 읽기
    if (process.env.DELAY_THRESHOLD_MINUTES) {
      config.delayThresholdMinutes = parseInt(process.env.DELAY_THRESHOLD_MINUTES, 10);
    }
    
    if (process.env.DELAY_CHECK_INTERVAL_SECONDS) {
      config.checkIntervalSeconds = parseInt(process.env.DELAY_CHECK_INTERVAL_SECONDS, 10);
    }
    
    if (process.env.FETCH_INTERVAL_SECONDS) {
      config.fetchIntervalSeconds = parseInt(process.env.FETCH_INTERVAL_SECONDS, 10);
    }
    
    if (process.env.DELAY_DEBUG_MODE) {
      config.debugMode = process.env.DELAY_DEBUG_MODE === 'true';
    }
    
    return config;
  }