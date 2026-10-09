export interface ActivityReply { id: string; createdAt: string; username: string }
export const COMMUNITY_READ_EVENT = "kakehashi-community-read";

function key(username: string) { return `kakehashi-web:community-read:${username.trim().toLowerCase()}:v1`; }
export function readCommunityVisits(storage: Pick<Storage, "getItem">, username: string): Record<string, string> {
  try {
    const value = JSON.parse(storage.getItem(key(username)) || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string" && Number.isFinite(Date.parse(entry[1]))));
  } catch { return {}; }
}
export function hasUnreadReply(reply: ActivityReply | null, visitedAt: string | undefined, participatedAt: string) {
  return Boolean(reply && Date.parse(reply.createdAt) > Math.max(Date.parse(visitedAt || participatedAt), Date.parse(participatedAt)));
}
export function markCommunityRead(storage: Pick<Storage, "getItem" | "setItem">, username: string, issueId: string, observedAt: string) {
  const visits = readCommunityVisits(storage, username);
  if (!Number.isFinite(Date.parse(observedAt)) || Date.parse(visits[issueId] || "1970-01-01") >= Date.parse(observedAt)) return;
  storage.setItem(key(username), JSON.stringify({ ...visits, [issueId]: observedAt }));
  window.dispatchEvent(new Event(COMMUNITY_READ_EVENT));
}
