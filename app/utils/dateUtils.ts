// utils/dateUtils.ts
export function formatDateRange(startDate: string, endDate: string): string {
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
  }
  