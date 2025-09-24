import { useState, useCallback, useMemo } from "react";

export const useDateRange = () => {
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const setQuickDateRange = useCallback((days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days + 1);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  }, []);

  const getDateRangeText = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (startDate === endDate) {
      return `${start.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short'
      })} (1일)`;
    } else {
      return `${start.toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric'
      })} ~ ${end.toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric'
      })} (${diffDays}일간)`;
    }
  }, [startDate, endDate]);

  return {
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    setQuickDateRange,
    getDateRangeText
  };
};
