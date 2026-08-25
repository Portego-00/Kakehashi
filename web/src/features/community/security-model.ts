export type CommunityAuthorIdentity = { id: string; username: string };

export function resolveCommunityMode(input: { url: string; serviceRoleKey: string; anonKey?: string; production: boolean }) {
  if (input.url && input.serviceRoleKey) return "supabase" as const;
  if (input.url && input.anonKey) return input.production ? "supabase-readonly" as const : "supabase-native-dev" as const;
  return input.production ? "unavailable" as const : "local-server" as const;
}

export function canManageIssueAuthor(issue: Record<string, unknown>, identity: CommunityAuthorIdentity, adminIds: string[] = []) {
  const candidates = new Set([String(issue.user_id || "").toLocaleLowerCase(), String(issue.user_username || "").toLocaleLowerCase()]);
  const admins = new Set(adminIds.map((entry) => entry.trim().toLocaleLowerCase()).filter(Boolean));
  return candidates.has(identity.id.toLocaleLowerCase()) || candidates.has(identity.username.toLocaleLowerCase()) || admins.has(identity.id.toLocaleLowerCase());
}
