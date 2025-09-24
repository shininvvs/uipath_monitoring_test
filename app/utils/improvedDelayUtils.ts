// utils/improvedDelayUtils.ts
import { SlackMessage } from "../types/monitoring";
import { DelayErrorConfig, DEFAULT_DELAY_CONFIG } from "../config/delayConfig";

/**
 * 메시지에서 프로세스 식별자를 추출
 */
export function extractProcessId(
  message: string, 
  config: DelayErrorConfig = DEFAULT_DELAY_CONFIG
): string | null {
  if (config.debugMode) {
    console.log(`[DEBUG] 프로세스 ID 추출 시도: ${message.slice(0, 100)}...`);
  }
  
  // 1. 정규표현식 패턴으로 ID 찾기
  for (const pattern of config.processIdPatterns) {
    // global 플래그 때문에 패턴 재사용 시 리셋 필요
    const newPattern = new RegExp(pattern.source, pattern.flags);
    const match = message.match(newPattern);
    if (match && match[1]) {
      const id = match[1].toLowerCase().trim();
      if (config.debugMode) {
        console.log(`[DEBUG] 패턴 매칭으로 ID 발견: ${id}`);
      }
      return id;
    }
  }
  
  // 2. 패턴이 없으면 메시지의 핵심 단어들로 식별자 생성
  const cleanMessage = message.toLowerCase()
    .replace(/[^\w\s가-힣]/g, ' ') // 특수문자를 공백으로
    .replace(/\s+/g, ' ') // 연속 공백을 하나로
    .trim();
  
  // 제외할 단어들
  const excludeWords = new Set([
    '시작', '종료', '완료', 'start', 'end', 'finish', 'complete', 'done',
    'the', 'and', 'for', 'with', 'from', 'into', 'by', 'at', 'on', 'in',
    '에서', '으로', '를', '을', '이', '가', '의', '와', '과', '에', '로', '는', '은'
  ]);
  
  const meaningfulWords = cleanMessage.split(' ')
    .filter(word => word.length >= 3) // 3글자 이상
    .filter(word => !excludeWords.has(word)) // 제외 단어가 아닌 것
    .filter(word => !/^\d+$/.test(word)) // 숫자만 있는 단어 제외
    .slice(0, 3); // 최대 3개 단어
  
  if (meaningfulWords.length > 0) {
    const id = meaningfulWords.join('_');
    if (config.debugMode) {
      console.log(`[DEBUG] 핵심 단어로 ID 생성: ${id} (단어들: ${meaningfulWords.join(', ')})`);
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
export function isStartMessage(
  message: string, 
  config: DelayErrorConfig = DEFAULT_DELAY_CONFIG
): boolean {
  const isStart = config.startPatterns.some(pattern => {
    const newPattern = new RegExp(pattern.source, pattern.flags);
    return newPattern.test(message);
  });
  
  if (config.debugMode && isStart) {
    console.log(`[DEBUG] 시작 메시지 감지: ${message.slice(0, 100)}...`);
  }
  
  return isStart;
}

/**
 * 종료 메시지인지 판단
 */
export function isEndMessage(
  message: string, 
  config: DelayErrorConfig = DEFAULT_DELAY_CONFIG
): boolean {
  const isEnd = config.endPatterns.some(pattern => {
    const newPattern = new RegExp(pattern.source, pattern.flags);
    return newPattern.test(message);
  });
  
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
  config: DelayErrorConfig = DEFAULT_DELAY_CONFIG
): boolean {
  if (config.debugMode) {
    console.log(`[DEBUG] 메시지 관련성 체크:`);
    console.log(`  시작: ${startMessage.slice(0, 50)}...`);
    console.log(`  종료: ${endMessage.slice(0, 50)}...`);
  }
  
  // 1. 프로세스 ID로 매칭 (가장 확실한 방법)
  const startId = extractProcessId(startMessage, { ...config, debugMode: false });
  const endId = extractProcessId(endMessage, { ...config, debugMode: false });
  
  if (startId && endId && startId === endId) {
    if (config.debugMode) {
      console.log(`[DEBUG] ID 매칭 성공: ${startId}`);
    }
    return true;
  }
  
  // 2. 공통 키워드로 매칭
  const getKeywords = (text: string): string[] => {
    return text.toLowerCase()
      .replace(/[^\w\s가-힣]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 3)
      .filter(word => {
        const excludeWords = [
          '시작', '종료', '완료', 'start', 'end', 'finish', 'complete', 'done',
          'the', 'and', 'for', 'with', 'from', 'job', 'task', 'process', 'batch'
        ];
        return !excludeWords.includes(word);
      })
      .filter(word => !/^\d+$/.test(word)); // 숫자만 있는 단어 제외
  };
  
  const startWords = getKeywords(startMessage);
  const endWords = getKeywords(endMessage);
  
  const commonWords = startWords.filter(word => endWords.includes(word));
  
  // 공통 단어가 2개 이상이거나, 1개라도 5글자 이상의 고유한 단어면 관련된 것으로 판단
  const isRelated = commonWords.length >= 2 || 
    (commonWords.length >= 1 && commonWords.some(word => word.length >= 5));
  
  if (config.debugMode) {
    console.log(`[DEBUG] 시작 키워드: ${startWords.join(', ')}`);
    console.log(`[DEBUG] 종료 키워드: ${endWords.join(', ')}`);
    console.log(`[DEBUG] 공통 키워드: ${commonWords.join(', ')}`);
    console.log(`[DEBUG] 관련성 판단: ${isRelated ? '관련됨' : '관련 없음'}`);
  }
  
  return isRelated;
}

/**
 * 실행 중인 프로세스 관리자 클래스
 */
export class RunningProcessManager {
  private processes: Map<string, {
    processId: string;
    startTime: number;
    message: SlackMessage;
    channelCode: string;
  }>;
  private config: DelayErrorConfig;
  
  constructor(config: DelayErrorConfig = DEFAULT_DELAY_CONFIG) {
    this.processes = new Map();
    this.config = config;
  }
  
  /**
   * 새 메시지 처리
   */
  processMessage(message: SlackMessage, channelCode: string): void {
    if (!message.text || !message.ts) return;
    
    const processId = extractProcessId(message.text, this.config);
    if (!processId) return;
    
    const key = `${channelCode}_${processId}`;
    
    if (isStartMessage(message.text, this.config)) {
      // 시작 메시지 - 실행 중인 프로세스로 등록
      this.processes.set(key, {
        processId,
        startTime: Number(message.ts) * 1000,
        message,
        channelCode
      });
      
      if (this.config.debugMode) {
        console.log(`[DEBUG] 실행 중인 프로세스 등록: ${key}`);
      }
    } else if (isEndMessage(message.text, this.config)) {
      // 종료 메시지 - 관련된 시작 프로세스가 있으면 제거
      const relatedKeys = Array.from(this.processes.keys()).filter(k => {
        const process = this.processes.get(k);
        return process && 
               process.channelCode === channelCode &&
               areRelatedMessages(process.message.text || '', message.text, this.config);
      });
      
      relatedKeys.forEach(key => {
        this.processes.delete(key);
        if (this.config.debugMode) {
          console.log(`[DEBUG] 실행 중인 프로세스 제거: ${key}`);
        }
      });
    }
  }
  
  /**
   * 지연된 프로세스들을 찾아서 반환
   */
  getDelayedProcesses(): SlackMessage[] {
    const currentTime = Date.now();
    const thresholdMs = this.config.delayThresholdMinutes * 60 * 1000;
    const delayedMessages: SlackMessage[] = [];
    
    this.processes.forEach((process, key) => {
      const elapsedTime = currentTime - process.startTime;
      
      if (elapsedTime > thresholdMs) {
        const delayMinutes = Math.floor(elapsedTime / 1000 / 60);
        
        if (this.config.debugMode) {
          console.log(`[DEBUG] 지연된 프로세스 발견: ${key} (${delayMinutes}분)`);
        }
        
        delayedMessages.push({
          ...process.message,
          text: `[DELAYED ${delayMinutes}min] ${process.message.text}`,
          delayDuration: delayMinutes,
          level: 'HIGH',
          priority: 2,
          color: '#f97316'
        });
        
        // 중복 알림 방지를 위해 임시 제거 (다음 체크에서 다시 감지될 수 있음)
        this.processes.delete(key);
      }
    });
    
    return delayedMessages;
  }
  
  /**
   * 채널별 실행 중인 프로세스 수 반환
   */
  getProcessCountByChannel(): Record<string, number> {
    const counts: Record<string, number> = {};
    
    this.processes.forEach(process => {
      counts[process.channelCode] = (counts[process.channelCode] || 0) + 1;
    });
    
    return counts;
  }
  
  /**
   * 전체 실행 중인 프로세스 수 반환
   */
  getTotalProcessCount(): number {
    return this.processes.size;
  }
  
  /**
   * 특정 채널의 프로세스들을 정리
   */
  clearChannelProcesses(channelCode: string): void {
    const keysToDelete = Array.from(this.processes.keys()).filter(key => {
      const process = this.processes.get(key);
      return process && process.channelCode === channelCode;
    });
    
    keysToDelete.forEach(key => this.processes.delete(key));
    
    if (this.config.debugMode && keysToDelete.length > 0) {
      console.log(`[DEBUG] ${channelCode} 채널의 ${keysToDelete.length}개 프로세스 정리`);
    }
  }
  
  /**
   * 모든 프로세스 정리
   */
  clearAll(): void {
    this.processes.clear();
    
    if (this.config.debugMode) {
      console.log(`[DEBUG] 모든 실행 중인 프로세스 정리`);
    }
  }
  
  /**
   * 현재 실행 중인 프로세스 목록 반환 (디버그용)
   */
  getRunningProcessesList(): Array<{
    key: string;
    processId: string;
    channelCode: string;
    startTime: Date;
    message: string;
    elapsedMinutes: number;
  }> {
    const currentTime = Date.now();
    const processList: Array<{
      key: string;
      processId: string;
      channelCode: string;
      startTime: Date;
      message: string;
      elapsedMinutes: number;
    }> = [];
    
    this.processes.forEach((process, key) => {
      const elapsedMinutes = Math.floor((currentTime - process.startTime) / 1000 / 60);
      
      processList.push({
        key,
        processId: process.processId,
        channelCode: process.channelCode,
        startTime: new Date(process.startTime),
        message: process.message.text || '',
        elapsedMinutes
      });
    });
    
    return processList.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }
}

/**
 * 배치로 메시지들을 처리하여 지연 에러를 감지
 */
export function detectDelayedErrorsBatch(
  messagesByChannel: Record<string, SlackMessage[]>,
  config: DelayErrorConfig = DEFAULT_DELAY_CONFIG
): Record<string, SlackMessage[]> {
  const manager = new RunningProcessManager(config);
  const delayedByChannel: Record<string, SlackMessage[]> = {};
  
  if (config.debugMode) {
    console.log(`[DEBUG] 배치 지연 에러 감지 시작`);
  }
  
  // 모든 채널의 메시지를 시간순으로 정렬하여 처리
  Object.entries(messagesByChannel).forEach(([channelCode, messages]) => {
    if (!messages || messages.length === 0) return;
    
    const sortedMessages = [...messages].sort((a, b) => 
      Number(a.ts || 0) - Number(b.ts || 0)
    );
    
    // 각 메시지를 순서대로 처리
    sortedMessages.forEach(message => {
      manager.processMessage(message, channelCode);
    });
  });
  
  // 지연된 프로세스들을 채널별로 그룹화
  const delayedMessages = manager.getDelayedProcesses();
  
  delayedMessages.forEach(message => {
    // 메시지에서 채널 코드를 찾기 (원본 메시지의 채널 정보 활용)
    Object.entries(messagesByChannel).forEach(([channelCode, channelMessages]) => {
      const found = channelMessages.some(msg => 
        msg.ts === message.ts && msg.text?.includes(message.text?.replace(/^\[DELAYED \d+min\] /, '') || '')
      );
      
      if (found) {
        if (!delayedByChannel[channelCode]) {
          delayedByChannel[channelCode] = [];
        }
        delayedByChannel[channelCode].push(message);
      }
    });
  });
  
  if (config.debugMode) {
    const totalDelayed = Object.values(delayedByChannel).reduce((sum, msgs) => sum + msgs.length, 0);
    console.log(`[DEBUG] 배치 지연 에러 감지 완료: ${totalDelayed}개 발견`);
  }
  
  return delayedByChannel;
}