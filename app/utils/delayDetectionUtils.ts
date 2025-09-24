// utils/delayDetectionUtils.ts
import { SlackMessage } from "../types/monitoring";

export interface DelayDetectionConfig {
  delayThreshold: number; // 지연 판단 임계값 (분)
  startKeywords: string[]; // 시작을 나타내는 키워드들
  endKeywords: string[]; // 종료를 나타내는 키워드들
  processIdPatterns: RegExp[]; // 프로세스 ID 패턴들
  debugMode?: boolean; // 디버그 모드
}

export const DEFAULT_DELAY_CONFIG: DelayDetectionConfig = {
  delayThreshold: 5, // 5분으로 증가 (테스트용)
  startKeywords: [
    // 한국어
    '시작', '작업 시작', '배치 시작', '프로세스 시작', '처리 시작',
    // 영어
    'start', 'started', 'starting', 'begin', 'began', 'initiated', 'launch', 'launched',
    // 구체적인 패턴
    'job start', 'task start', 'process start', 'batch start', 'execution start'
  ],
  endKeywords: [
    // 한국어
    '종료', '완료', '성공', '작업 완료', '배치 완료', '프로세스 완료', '처리 완료',
    // 영어  
    'end', 'ended', 'finish', 'finished', 'complete', 'completed', 'done', 'success', 'successful',
    // 구체적인 패턴
    'job complete', 'task complete', 'process complete', 'batch complete', 'execution complete'
  ],
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
  ],
  debugMode: true // 디버깅 활성화
};

/**
 * 메시지에서 프로세스 식별자를 추출
 */
export function extractProcessId(message: string, config: DelayDetectionConfig = DEFAULT_DELAY_CONFIG): string | null {
  if (config.debugMode) {
    console.log(`[DEBUG] 프로세스 ID 추출 시도: ${message.slice(0, 100)}...`);
  }
  
  // 1. 정규표현식 패턴으로 ID 찾기
  for (const pattern of config.processIdPatterns) {
    pattern.lastIndex = 0; // global 플래그 때문에 리셋 필요
    const match = message.match(pattern);
    if (match && match[1]) {
      const id = match[1].toLowerCase();
      if (config.debugMode) {
        console.log(`[DEBUG] 패턴 매칭으로 ID 발견: ${id}`);
      }
      return id;
    }
  }
  
  // 2. 패턴이 없으면 메시지의 핵심 단어들로 식별자 생성
  const cleanMessage = message.toLowerCase()
    .replace(/[^\w\s가-힣]/g, ' ') // 특수문자 제거
    .replace(/\s+/g, ' ') // 연속 공백 하나로
    .trim();
  
  const excludeWords = new Set([
    ...config.startKeywords.map(k => k.toLowerCase()),
    ...config.endKeywords.map(k => k.toLowerCase()),
    'the', 'and', 'for', 'with', 'from', 'into', 'by', 'at', 'on', 'in',
    '에서', '으로', '를', '을', '이', '가', '의', '와', '과', '에', '로'
  ]);
  
  const words = cleanMessage.split(' ')
    .filter(word => word.length >= 3) // 3글자 이상
    .filter(word => !excludeWords.has(word)) // 제외 단어가 아닌 것
    .slice(0, 3); // 최대 3개 단어
  
  if (words.length > 0) {
    const id = words.join('_');
    if (config.debugMode) {
      console.log(`[DEBUG] 핵심 단어로 ID 생성: ${id} (from words: ${words.join(', ')})`);
    }
    return id;
  }
  
  if (config.debugMode) {
    console.log(`[DEBUG] 프로세스 ID 추출 실패`);
  }
  return null;
}

/**
 * 시작 메시지인지 판단
 */
export function isStartMessage(message: string, config: DelayDetectionConfig = DEFAULT_DELAY_CONFIG): boolean {
  const lowerMessage = message.toLowerCase();
  const isStart = config.startKeywords.some(keyword => 
    lowerMessage.includes(keyword.toLowerCase())
  );
  
  if (config.debugMode && isStart) {
    console.log(`[DEBUG] 시작 메시지 감지: ${message.slice(0, 100)}...`);
  }
  
  return isStart;
}

/**
 * 종료 메시지인지 판단
 */
export function isEndMessage(message: string, config: DelayDetectionConfig = DEFAULT_DELAY_CONFIG): boolean {
  const lowerMessage = message.toLowerCase();
  const isEnd = config.endKeywords.some(keyword => 
    lowerMessage.includes(keyword.toLowerCase())
  );
  
  if (config.debugMode && isEnd) {
    console.log(`[DEBUG] 종료 메시지 감지: ${message.slice(0, 100)}...`);
  }
  
  return isEnd;
}

/**
 * 두 메시지가 같은 프로세스에 관련된 것인지 판단
 */
export function areRelatedMessages(
  startMessage: string, 
  endMessage: string,
  config: DelayDetectionConfig = DEFAULT_DELAY_CONFIG
): boolean {
  if (config.debugMode) {
    console.log(`[DEBUG] 메시지 관련성 체크:`);
    console.log(`  시작: ${startMessage.slice(0, 50)}...`);
    console.log(`  종료: ${endMessage.slice(0, 50)}...`);
  }
  
  // 1. 프로세스 ID로 매칭
  const startId = extractProcessId(startMessage, { ...config, debugMode: false }); // 중복 로그 방지
  const endId = extractProcessId(endMessage, { ...config, debugMode: false });
  
  if (startId && endId && startId === endId) {
    if (config.debugMode) {
      console.log(`[DEBUG] ID 매칭 성공: ${startId}`);
    }
    return true;
  }
  
  // 2. 공통 키워드로 매칭
  const getKeywords = (text: string) => {
    return text.toLowerCase()
      .replace(/[^\w\s가-힣]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 3)
      .filter(word => {
        const excludeWords = [
          ...config.startKeywords.map(k => k.toLowerCase()),
          ...config.endKeywords.map(k => k.toLowerCase()),
          'the', 'and', 'for', 'with', 'from'
        ];
        return !excludeWords.includes(word);
      });
  };
  
  const startWords = getKeywords(startMessage);
  const endWords = getKeywords(endMessage);
  
  const commonWords = startWords.filter(word => endWords.includes(word));
  
  // 공통 단어가 2개 이상이거나, 1개라도 5글자 이상의 고유한 단어면 관련된 것으로 판단
  const isRelated = commonWords.length >= 2 || 
    (commonWords.length >= 1 && commonWords.some(word => word.length >= 5));
  
  if (config.debugMode) {
    console.log(`[DEBUG] 공통 키워드: ${commonWords.join(', ')}`);
    console.log(`[DEBUG] 관련성 판단: ${isRelated ? '관련됨' : '관련 없음'}`);
  }
  
  return isRelated;
}

/**
 * 지연 에러 감지
 */
export function detectDelayedErrors(
  messages: SlackMessage[],
  config: DelayDetectionConfig = DEFAULT_DELAY_CONFIG
): SlackMessage[] {
  const delayedMessages: SlackMessage[] = [];
  const thresholdMs = config.delayThreshold * 60 * 1000; // 분을 밀리초로 변환
  const currentTime = Date.now();
  
  if (config.debugMode) {
    console.log(`[DEBUG] 지연 에러 감지 시작:`);
    console.log(`  - 총 메시지 수: ${messages.length}`);
    console.log(`  - 임계값: ${config.delayThreshold}분 (${thresholdMs}ms)`);
    console.log(`  - 현재 시간: ${new Date(currentTime).toLocaleString()}`);
  }
  
  // 시간순으로 정렬 (오래된 것부터)
  const sortedMessages = [...messages].sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
  
  // 시작 메시지들을 찾아서 처리
  const startMessages = sortedMessages.filter(msg => 
    msg.text && isStartMessage(msg.text, config)
  );
  
  if (config.debugMode) {
    console.log(`[DEBUG] 발견된 시작 메시지 수: ${startMessages.length}`);
  }
  
  startMessages.forEach((startMsg, index) => {
    if (!startMsg.text || !startMsg.ts) return;
    
    const startTime = Number(startMsg.ts) * 1000;
    const elapsedTime = currentTime - startTime;
    const processId = extractProcessId(startMsg.text, { ...config, debugMode: false });
    
    if (config.debugMode) {
      console.log(`\n[DEBUG] 시작 메시지 ${index + 1}/${startMessages.length} 처리:`);
      console.log(`  - 내용: ${startMsg.text.slice(0, 100)}...`);
      console.log(`  - 시작 시간: ${new Date(startTime).toLocaleString()}`);
      console.log(`  - 경과 시간: ${Math.floor(elapsedTime / 1000 / 60)}분`);
      console.log(`  - 프로세스 ID: ${processId}`);
    }
    
    // 해당 프로세스의 종료 메시지가 있는지 확인
    const hasEndMessage = sortedMessages.some(msg => {
      if (!msg.text || !msg.ts) return false;
      
      const msgTime = Number(msg.ts) * 1000;
      
      // 시작 메시지 이후의 메시지만 확인
      if (msgTime <= startTime) return false;
      
      // 종료 메시지인지 확인
      if (!isEndMessage(msg.text, config)) return false;
      
      // 같은 프로세스인지 확인
      return areRelatedMessages(startMsg.text, msg.text, { ...config, debugMode: false });
    });
    
    if (config.debugMode) {
      console.log(`  - 종료 메시지 발견: ${hasEndMessage ? 'Yes' : 'No'}`);
      console.log(`  - 임계값 초과: ${elapsedTime > thresholdMs ? 'Yes' : 'No'}`);
    }
    
    // 종료 메시지가 없고 임계값을 넘었으면 지연 에러
    if (!hasEndMessage && elapsedTime > thresholdMs) {
      const delayMinutes = Math.floor(elapsedTime / 1000 / 60);
      
      if (config.debugMode) {
        console.log(`  ⚠️ 지연 에러 감지! ${delayMinutes}분 경과`);
      }
      
      delayedMessages.push({
        ...startMsg,
        text: `[DELAYED ${delayMinutes}min] ${startMsg.text}`,
        delayDuration: delayMinutes,
        level: 'HIGH', // 지연 에러는 높은 우선순위
        priority: 2,
        color: '#f97316'
      });
    }
  });
  
  if (config.debugMode) {
    console.log(`\n[DEBUG] 지연 에러 감지 완료: ${delayedMessages.length}개 발견`);
  }
  
  return delayedMessages;
}

/**
 * 실시간으로 지연 에러를 모니터링
 */
export class DelayMonitor {
  private config: DelayDetectionConfig;
  private runningProcesses: Map<string, { startTime: number; message: SlackMessage }>;
  private callbacks: Array<(delayedMessage: SlackMessage) => void>;
  private checkInterval: NodeJS.Timeout | null;
  
  constructor(config: DelayDetectionConfig = DEFAULT_DELAY_CONFIG) {
    this.config = config;
    this.runningProcesses = new Map();
    this.callbacks = [];
    this.checkInterval = null;
    
    if (config.debugMode) {
      console.log('[DEBUG] DelayMonitor 초기화됨');
    }
  }
  
  /**
   * 지연 에러 콜백 등록
   */
  onDelayDetected(callback: (delayedMessage: SlackMessage) => void): void {
    this.callbacks.push(callback);
    if (this.config.debugMode) {
      console.log(`[DEBUG] 지연 에러 콜백 등록됨 (총 ${this.callbacks.length}개)`);
    }
  }
  
  /**
   * 새 메시지 처리
   */
  processMessage(message: SlackMessage): void {
    if (!message.text || !message.ts) return;
    
    if (this.config.debugMode) {
      console.log(`[DEBUG] 메시지 처리: ${message.text.slice(0, 50)}...`);
    }
    
    const processId = extractProcessId(message.text, this.config);
    if (!processId) return;
    
    if (isStartMessage(message.text, this.config)) {
      // 시작 메시지 - 실행 중인 프로세스로 등록
      this.runningProcesses.set(processId, {
        startTime: Number(message.ts) * 1000,
        message
      });
      
      if (this.config.debugMode) {
        console.log(`[DEBUG] 실행 중인 프로세스에 추가: ${processId}`);
      }
    } else if (isEndMessage(message.text, this.config)) {
      // 종료 메시지 - 실행 중인 프로세스에서 제거
      if (this.runningProcesses.has(processId)) {
        this.runningProcesses.delete(processId);
        if (this.config.debugMode) {
          console.log(`[DEBUG] 실행 중인 프로세스에서 제거: ${processId}`);
        }
      }
    }
  }
  
  /**
   * 지연 에러 모니터링 시작
   */
  startMonitoring(checkIntervalMs: number = 60000): void { // 1분마다 체크
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    if (this.config.debugMode) {
      console.log(`[DEBUG] 지연 에러 모니터링 시작 (${checkIntervalMs}ms 간격)`);
    }
    
    this.checkInterval = setInterval(() => {
      this.checkForDelayedProcesses();
    }, checkIntervalMs);
  }
  
  /**
   * 모니터링 중단
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      
      if (this.config.debugMode) {
        console.log('[DEBUG] 지연 에러 모니터링 중단됨');
      }
    }
  }
  
  /**
   * 지연된 프로세스 확인
   */
  private checkForDelayedProcesses(): void {
    const currentTime = Date.now();
    const thresholdMs = this.config.delayThreshold * 60 * 1000;
    
    if (this.config.debugMode) {
      console.log(`[DEBUG] 지연된 프로세스 체크 (실행 중: ${this.runningProcesses.size}개)`);
    }
    
    this.runningProcesses.forEach((process, processId) => {
      const elapsedTime = currentTime - process.startTime;
      
      if (elapsedTime > thresholdMs) {
        const delayMinutes = Math.floor(elapsedTime / 1000 / 60);
        
        if (this.config.debugMode) {
          console.log(`[DEBUG] 지연된 프로세스 발견: ${processId} (${delayMinutes}분)`);
        }
        
        const delayedMessage: SlackMessage = {
          ...process.message,
          text: `[DELAYED ${delayMinutes}min] ${process.message.text}`,
          delayDuration: delayMinutes,
          level: 'HIGH',
          priority: 2,
          color: '#f97316'
        };
        
        // 콜백 실행
        this.callbacks.forEach(callback => callback(delayedMessage));
        
        // 중복 알림 방지를 위해 일시적으로 제거 (다음 체크에서 다시 감지됨)
        this.runningProcesses.delete(processId);
      }
    });
  }
  
  /**
   * 현재 실행 중인 프로세스 수 반환
   */
  getRunningProcessCount(): number {
    return this.runningProcesses.size;
  }
  
  /**
   * 현재 실행 중인 프로세스 목록 반환 (디버그용)
   */
  getRunningProcesses(): Array<{ id: string; startTime: Date; message: string }> {
    const processes: Array<{ id: string; startTime: Date; message: string }> = [];
    this.runningProcesses.forEach((process, processId) => {
      processes.push({
        id: processId,
        startTime: new Date(process.startTime),
        message: process.message.text || ''
      });
    });
    return processes;
  }
  
  /**
   * 정리
   */
  cleanup(): void {
    this.stopMonitoring();
    this.runningProcesses.clear();
    this.callbacks = [];
    
    if (this.config.debugMode) {
      console.log('[DEBUG] DelayMonitor 정리 완료');
    }
  }
}