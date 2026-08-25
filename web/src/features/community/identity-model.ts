export interface CommunityUserPayload {
  data?: {
    id?: unknown;
    username?: unknown;
    level?: unknown;
  };
}

export interface ParsedCommunityIdentity {
  id: string;
  username: string;
  level: number;
  email: string;
}

export function identityFromUserPayload(payload: CommunityUserPayload | null): ParsedCommunityIdentity | null {
  const username = typeof payload?.data?.username === "string" ? payload.data.username.trim() : "";
  if (!username) return null;

  const stableId = typeof payload?.data?.id === "string" ? payload.data.id.trim() : "";
  const level = Number(payload?.data?.level);
  return {
    id: stableId || username.toLocaleLowerCase(),
    username,
    level: Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0,
    email: `${username}@users.noreply.local`,
  };
}
