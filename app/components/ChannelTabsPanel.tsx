import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Channel, SlackMessage } from "../types/monitoring";
import ErrorTable from "./ErrorTable";
import '../css/ChannelTabsPanel.css'

interface ChannelTabsPanelProps {
  myChannels: Channel[];
  setMyChannels: (chs: Channel[]) => void;
  errorMessagesAllByChannel: Record<string, SlackMessage[]>;
  setShowPickerModal: (show: boolean) => void;
  activeChannelCode: string;
  setActiveChannelCode: (code: string) => void;
  focusMessage: { channelCode: string, ts: string } | null;
  setFocusMessage: (msg: { channelCode: string, ts: string } | null) => void;
  readMessages?: Set<string>;
  onMarkAsRead?: (channelCode: string, messageTs: string) => void;
}

export default function ChannelTabsPanel({
  myChannels, setMyChannels, errorMessagesAllByChannel, setShowPickerModal,
  activeChannelCode, setActiveChannelCode, focusMessage, setFocusMessage,
  readMessages = new Set(),
  onMarkAsRead
}: ChannelTabsPanelProps) {
  const [search, setSearch] = useState("");
  
  // 이전 채널 목록을 추적하기 위한 ref
  const previousChannelsRef = useRef<Channel[]>([]);
  const isInitializedRef = useRef(false);

  // 새 채널 추가 감지 및 활성화
  useEffect(() => {
    // 첫 번째 렌더링은 무시
    if (!isInitializedRef.current) {
      previousChannelsRef.current = myChannels;
      isInitializedRef.current = true;
      
      // 채널이 없으면 활성 채널도 초기화
      if (myChannels.length === 0) {
        setActiveChannelCode("");
      } else if (!activeChannelCode) {
        // 활성 채널이 없고 채널이 있으면 첫 번째 채널 활성화
        setActiveChannelCode(myChannels[0].code);
      }
      return;
    }

    const previousChannels = previousChannelsRef.current;
    const currentChannels = myChannels;

    // 채널이 모두 제거된 경우
    if (currentChannels.length === 0) {
      setActiveChannelCode("");
      previousChannelsRef.current = currentChannels;
      return;
    }

    // 새로 추가된 채널들 찾기
    const previousChannelCodes = new Set(previousChannels.map(ch => ch.code));
    const newChannels = currentChannels.filter(ch => !previousChannelCodes.has(ch.code));

    if (newChannels.length > 0) {
      // 새로 추가된 채널 중 마지막 채널로 활성화
      const lastNewChannel = newChannels[newChannels.length - 1];
      console.log('새 채널 추가됨, 활성화:', lastNewChannel.name, lastNewChannel.code);
      setActiveChannelCode(lastNewChannel.code);
      setFocusMessage(null);
    } else {
      // 채널이 제거된 경우 처리
      const currentChannelExists = currentChannels.find(ch => ch.code === activeChannelCode);
      if (!currentChannelExists && currentChannels.length > 0) {
        // 현재 활성 채널이 제거되었으면 첫 번째 채널로 이동
        setActiveChannelCode(currentChannels[0].code);
      }
    }

    // 이전 채널 목록 업데이트
    previousChannelsRef.current = currentChannels;
  }, [myChannels, activeChannelCode, setActiveChannelCode, setFocusMessage]);

  // 포커스 메시지 자동 읽음 처리
  useEffect(() => {
    if (focusMessage && focusMessage.channelCode === activeChannelCode) {
      if (onMarkAsRead) {
        onMarkAsRead(focusMessage.channelCode, focusMessage.ts);
      }
      setTimeout(() => setFocusMessage(null), 1000);
    }
  }, [focusMessage, activeChannelCode, setFocusMessage, onMarkAsRead]);

  // 채널 탭 클릭 핸들러
  const handleChannelTabClick = useCallback((channelCode: string) => {
    console.log('Tab clicked:', channelCode, 'Current active:', activeChannelCode);
    setActiveChannelCode(channelCode);
    setFocusMessage(null);
  }, [activeChannelCode, setActiveChannelCode, setFocusMessage]);

  // 채널 탭 제거 핸들러
  const handleChannelTabClose = useCallback((channelToRemove: Channel) => {
    const updatedChannels = myChannels.filter(c => c.code !== channelToRemove.code);
    setMyChannels(updatedChannels);
    
    // 제거된 채널이 현재 활성 채널인 경우
    if (activeChannelCode === channelToRemove.code) {
      if (updatedChannels.length > 0) {
        // 제거된 채널의 인덱스를 찾아서 다음 채널 선택
        const removedIndex = myChannels.findIndex(c => c.code === channelToRemove.code);
        const nextIndex = removedIndex >= updatedChannels.length ? updatedChannels.length - 1 : removedIndex;
        setActiveChannelCode(updatedChannels[nextIndex].code);
      } else {
        setActiveChannelCode("");
      }
    }
  }, [myChannels, setMyChannels, activeChannelCode, setActiveChannelCode]);

  // rawMessages를 useMemo로 최적화 (ESLint 경고 해결)
  const rawMessages = useMemo(() => {
    return errorMessagesAllByChannel[activeChannelCode] || [];
  }, [errorMessagesAllByChannel, activeChannelCode]);

  // 검색 필터링된 메시지들
  const messages: SlackMessage[] = useMemo(() => {
    if (!search) return rawMessages;
    return rawMessages.filter(msg => (msg.text ?? "").toLowerCase().includes(search.toLowerCase()));
  }, [rawMessages, search]);

  // 현재 활성 채널 찾기
  const activeChannel = myChannels.find(ch => ch.code === activeChannelCode);

  return (
    <div className="channel-tabs-container">
      {/* 디버그 정보 (개발 환경에서만) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="debug-info">
          <div className="debug-line">Active: {activeChannelCode || 'none'}</div>
          <div className="debug-line">Channels: {myChannels.length}</div>
          <div className="debug-line">Messages: {rawMessages.length}</div>
          <div className="debug-line">Previous: {previousChannelsRef.current.length}</div>
          <div className="debug-line">Initialized: {isInitializedRef.current ? 'Yes' : 'No'}</div>
        </div>
      )}

      {/* 컨트롤 섹션 */}
      <div className="controls-section">
        <div className="control-buttons">
          <button
            onClick={() => setShowPickerModal(true)}
            className="primary-button"
          >
            Add Channels
          </button>
          <button
            onClick={() => {
              setMyChannels([]);
              setActiveChannelCode("");
            }}
            className="secondary-button"
          >
            Close All Tabs
          </button>
        </div>
        <div className="stats-info">
          <span className="channel-count-badge">
            {myChannels.length} Channels
          </span>
          <span>Active Monitoring</span>
        </div>
      </div>

      {/* 채널이 없는 경우 */}
      {myChannels.length === 0 ? (
        <div className="no-channels-state">
          <div className="no-channels-icon">📡</div>
          <div className="no-channels-title">No Channels Selected</div>
          <div className="no-channels-subtitle">
            Start monitoring your Slack channels by adding them to your dashboard.
            <br />
            Click &ldquo;Add Channels&rdquo; to get started.
          </div>
          <div className="add-channel-hint">
            💡 Tip: You can monitor multiple channels simultaneously and switch between them using tabs.
          </div>
        </div>
      ) : (
        <>
          {/* 채널 탭들 */}
          <div className="tabs-container">
            {myChannels.map((ch) => {
              const channelMessages = errorMessagesAllByChannel[ch.code] || [];
              const unreadCount = channelMessages.filter(msg => msg.ts && !readMessages.has(String(msg.ts))).length;
              const isActive = activeChannelCode === ch.code;
              
              return (
                <div 
                  key={ch.code}
                  className={`channel-tab ${isActive ? 'active' : 'inactive'}`}
                  onClick={() => handleChannelTabClick(ch.code)}
                  role="tab"
                  tabIndex={0}
                  aria-selected={isActive}
                  aria-controls={`panel-${ch.code}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleChannelTabClick(ch.code);
                    }
                  }}
                  title={`Switch to ${ch.name} channel`}
                >
                  <div className="tab-content">
                    <span className="tab-name">{ch.name}</span>
                    {unreadCount > 0 && (
                      <span className="unread-badge">{unreadCount}</span>
                    )}
                  </div>
                  <button
                    className="close-button"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      handleChannelTabClose(ch);
                    }}
                    title={`Remove ${ch.name} from tabs`}
                    aria-label={`Close ${ch.name} tab`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          {/* 검색 섹션 */}
          {activeChannel && (
            <div className="search-section">
              <div className="search-container">
                <input
                  type="text"
                  placeholder={`Search messages in ${activeChannel.name}...`}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="search-input"
                />
                {search && (
                  <button 
                    onClick={() => setSearch("")}
                    className="clear-button"
                  >
                    Clear
                  </button>
                )}
                {search && (
                  <span className="search-stats">
                    Found {messages.length} / {rawMessages.length} messages
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 콘텐츠 영역 */}
          <div className="content-area">
            {activeChannel ? (
              <ErrorTable
                messages={messages}
                readMessages={readMessages}
                onMarkAsRead={onMarkAsRead}
                channelCode={activeChannelCode}
                scrollToTs={
                  focusMessage?.channelCode === activeChannelCode
                      ? focusMessage.ts
                      : undefined
              }
                showStats={true}
                maxDisplayItems={1000}
              />
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📊</div>
                <h3>Select a channel to monitor</h3>
                <p>Choose from your added channels above to start monitoring.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}