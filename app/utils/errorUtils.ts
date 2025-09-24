// utils/errorUtils.ts
export function containsError(text = ""): boolean {
    const patterns = [/error/i, /exception/i, /failed/i, /failure/i, /에러/i, /시작/i];
    return patterns.some((re) => re.test(text));
  }
  