export type CommunityAuthorIdentity = { id: string; username: string };

export function resolveCommunityMode(input: { url: string; serviceRoleKey: string; anonKey?: string; production: boolean; localStoreEnabled?: boolean }) {
  if (input.url && input.serviceRoleKey) return "supabase" as const;
  if (input.url && input.anonKey) return input.production ? "supabase-readonly" as const : "supabase-native-dev" as const;
  if (!input.production && input.localStoreEnabled) return "local-server" as const;
  return "unavailable" as const;
}

export function resolveCommunityModeFromEnvironment(input: {
  url?: string;
  serviceRoleKey?: string;
  anonKey?: string;
  nodeEnv?: string;
  localStore?: string;
}) {
  return resolveCommunityMode({
    url: input.url?.trim() || "",
    serviceRoleKey: input.serviceRoleKey?.trim() || "",
    anonKey: input.anonKey?.trim() || "",
    production: input.nodeEnv === "production",
    localStoreEnabled: input.localStore === "1",
  });
}

export function canManageIssueAuthor(issue: Record<string, unknown>, identity: CommunityAuthorIdentity, adminIds: string[] = []) {
  const candidates = new Set([String(issue.user_id || "").toLocaleLowerCase(), String(issue.user_username || "").toLocaleLowerCase()]);
  const admins = new Set(adminIds.map((entry) => entry.trim().toLocaleLowerCase()).filter(Boolean));
  return candidates.has(identity.id.toLocaleLowerCase()) || candidates.has(identity.username.toLocaleLowerCase()) || admins.has(identity.id.toLocaleLowerCase());
}
