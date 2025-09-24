"use client";
import React, { useState, useCallback } from "react";
import DashboardPanel from "./components/DashboardPanel";
import ChannelTabsPanel from "./components/ChannelTabsPanel";
import NotificationPopup from "./components/NotificationPopup";
import ChannelPickerModal from "./components/ChannelPickerModal";
import DateRangeHeader from "./components/DateRangeHeader";
import TabNavigation from "./components/UI/TabNavigation";

// 커스텀 훅들
import { useChannels } from "./hooks/useChannels";
import { useDateRange } from "./hooks/useDateRange";
import { useReadStatus } from "./hooks/useReadStatus";
import { useSlackMessages } from "./hooks/useSlackMessages";
import { useNotifications } from "./hooks/useNotifications";

// 전역 CSS
import "./css/page.css";

type TabType = "overview" | "channels";

export default function MainPage() {
  // 커스텀 훅으로 상태 관리 분리
  const { allChannels, myChannels, setMyChannels } = useChannels();
  const { 
    startDate, 
    endDate, 
    setStartDate, 
    setEndDate, 
    setQuickDateRange, 
    getDateRangeText 
  } = useDateRange();
  const { readMessages, handleMarkAsRead } = useReadStatus();
  
  // 지연 에러 지원이 추가된 useSlackMessages 훅 사용
  const { 
    errorMessagesAllByChannel, 
    filteredErrorMessagesByChannel,
    delayedErrors
  } = useSlackMessages(
    allChannels, 
    startDate, 
    endDate, 
    readMessages
  );
  
  // 지연 에러 알림을 포함한 useNotifications 훅
  const { popupAlerts, setPopupAlerts } = useNotifications(
    allChannels, 
    errorMessagesAllByChannel, 
    delayedErrors
  );

  // 지역 상태
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [activeChannelCode, setActiveChannelCode] = useState("");
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [focusMessage, setFocusMessage] = useState<{ channelCode: string, ts: string } | null>(null);

  // 자동 읽음 처리가 적용된 대시보드 채널 클릭 핸들러
  const handleDashboardChannelClick = useCallback((code: string, ts?: string) => {
    if (ts) {
      handleMarkAsRead(code, ts);
    }

    if (!myChannels.some(ch => ch.code === code)) {
      const found = allChannels.find(ch => ch.code === code);
      if (found) {
        setMyChannels(prev => [...prev, found]);
        setActiveTab("channels");
        setActiveChannelCode(code);
        setFocusMessage(ts ? { channelCode: code, ts } : null);
      }
    } else {
      setActiveTab("channels");
      setActiveChannelCode(code);
      setFocusMessage(ts ? { channelCode: code, ts } : null);
    }
  }, [myChannels, allChannels, handleMarkAsRead, setMyChannels]);

  return (
    <div className="main-container">
      {/* 알림 팝업 - 지연 에러 알림 포함 */}
      <NotificationPopup
        alerts={popupAlerts}
        onConfirm={() => setPopupAlerts([])}
        onMarkAsRead={handleMarkAsRead}
      />

      {/* 날짜 범위 헤더 */}
      <DateRangeHeader
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onQuickDateRange={setQuickDateRange}
        dateRangeText={getDateRangeText}
      />

      {/* 탭 네비게이션 */}
      <TabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* 메인 콘텐츠 영역 */}
      <div className="content-wrapper">
        {activeTab === "overview" && (
          <div className="fade-in">
            <DashboardPanel
              allChannels={allChannels}
              errorMessagesByChannel={filteredErrorMessagesByChannel}
              delayedErrors={delayedErrors}
              onChannelCardClick={handleDashboardChannelClick}
              readMessages={readMessages}
              onMarkAsRead={handleMarkAsRead}
            />
          </div>
        )}
        
        {activeTab === "channels" && (
          <div className="fade-in">
            <ChannelTabsPanel
              myChannels={myChannels}
              setMyChannels={setMyChannels}
              errorMessagesAllByChannel={errorMessagesAllByChannel}
              setShowPickerModal={setShowPickerModal}
              activeChannelCode={activeChannelCode}
              setActiveChannelCode={setActiveChannelCode}
              focusMessage={focusMessage}
              setFocusMessage={setFocusMessage}
              readMessages={readMessages}
              onMarkAsRead={handleMarkAsRead}
            />
            
            {/* 채널 선택 모달 */}
            <ChannelPickerModal
              show={showPickerModal}
              allChannels={allChannels}
              myChannels={myChannels}
              setMyChannels={setMyChannels}
              onCancel={() => setShowPickerModal(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
