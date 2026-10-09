import AsyncStorage from "@react-native-async-storage/async-storage";
import type { IssueActivity } from "../services/issueActivityService";

const cache = new Map<string, Record<string, string>>();
const pending = new Map<string, Promise<Record<string, string>>>();
const listeners = new Set<() => void>();
const key = (userId: string) => `community:read:${userId}:v1`;
export async function loadIssueVisits(userId: string): Promise<Record<string, string>> {
  if (cache.has(userId)) return cache.get(userId)!;
  if (pending.has(userId)) return pending.get(userId)!;
  const request = AsyncStorage.getItem(key(userId)).then((raw) => {
    let visits: Record<string, string> = {};
    try {
      const parsed = JSON.parse(raw || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) visits = Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string" && Number.isFinite(Date.parse(entry[1]))));
    } catch { /* A damaged read marker must not block the community. */ }
    cache.set(userId, visits);
    return visits;
  }).finally(() => pending.delete(userId));
  pending.set(userId, request);
  return request;
}
export function isUnreadIssueActivity(item: IssueActivity, visits: Record<string, string>) {
  return Boolean(item.latestReply && Date.parse(item.latestReply.createdAt) > Math.max(Date.parse(visits[item.issue.id] || item.participatedAt), Date.parse(item.participatedAt)));
}
let writes = Promise.resolve();
export async function markIssueRead(userId: string, issueId: string, observedAt: string) {
  await loadIssueVisits(userId);
  const visits = cache.get(userId) ?? {};
  if (!Number.isFinite(Date.parse(observedAt)) || Date.parse(visits[issueId] || "1970-01-01") >= Date.parse(observedAt)) return;
  const next = { ...visits, [issueId]: observedAt };
  cache.set(userId, next);
  listeners.forEach((listener) => listener());
  writes = writes.catch(() => undefined).then(() => AsyncStorage.setItem(key(userId), JSON.stringify(next)));
  await writes;
}
export function subscribeIssueVisits(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
