import { normalizeGravatarEmail } from "@/lib/gravatar";

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

export function identityFromUserPayload(payload: CommunityUserPayload | null, gravatarEmail?: unknown): ParsedCommunityIdentity | null {
  const username = typeof payload?.data?.username === "string" ? payload.data.username.trim() : "";
  if (!username) return null;

  const stableId = typeof payload?.data?.id === "string" ? payload.data.id.trim() : "";
  const level = Number(payload?.data?.level);
  const normalizedGravatarEmail = normalizeGravatarEmail(gravatarEmail);
  return {
    id: stableId || username.toLocaleLowerCase(),
    username,
    level: Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0,
    email: normalizedGravatarEmail || `${username}@users.noreply.local`,
  };
}
