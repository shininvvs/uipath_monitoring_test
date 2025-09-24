"use client";
import React, { useState, useEffect } from "react";
import QuickButton from "./UI/QuickButton";
import "../css/DateRangeHeader.css";

interface DateRangeHeaderProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onQuickDateRange: (days: number) => void;
  dateRangeText: string;
}

const DateRangeHeader: React.FC<DateRangeHeaderProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onQuickDateRange,
  dateRangeText
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="date-range-header">
      <div className="date-input-group">
        <label className="date-label">
          조회 기간:
        </label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          max={endDate}
          className="date-input"
        />
        <span className="date-separator">~</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          min={startDate}
          className="date-input"
        />
      </div>

      <div className="quick-button-group">
        <QuickButton onClick={() => onQuickDateRange(1)}>오늘</QuickButton>
        <QuickButton onClick={() => onQuickDateRange(3)}>3일</QuickButton>
        <QuickButton onClick={() => onQuickDateRange(7)}>7일</QuickButton>
        <QuickButton onClick={() => onQuickDateRange(30)}>30일</QuickButton>
      </div>

      <span className="date-range-text">
        {dateRangeText} 에러 모니터링
      </span>
    </div>
  );
};

export default DateRangeHeader;