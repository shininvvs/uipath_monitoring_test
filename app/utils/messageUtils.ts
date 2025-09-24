import { SlackMessage } from "../types/monitoring";

export function areErrorMessagesEqual(arr1: SlackMessage[], arr2: SlackMessage[]) {
  if (arr1.length !== arr2.length) return false;
  const set1 = new Set(arr1.map(msg => `${msg.text}_${msg.ts}`));
  const set2 = new Set(arr2.map(msg => `${msg.text}_${msg.ts}`));
  for (const id of set1) {
    if (!set2.has(id)) return false;
  }
  return true;
}
