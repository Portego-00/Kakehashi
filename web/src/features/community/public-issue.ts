const PUBLIC_ISSUE_FIELDS = [
  "id",
  "user_username",
  "user_level",
  "title",
  "content",
  "status",
  "labels",
  "created_at",
  "updated_at",
  "likes_count",
  "reply_count",
] as const;

export const COMMUNITY_ISSUE_READ_SELECT = [...PUBLIC_ISSUE_FIELDS, "user_id"].join(",");

export function publicCommunityIssue(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  return Object.fromEntries(PUBLIC_ISSUE_FIELDS.filter((field) => field in row).map((field) => [field, row[field]]));
}
