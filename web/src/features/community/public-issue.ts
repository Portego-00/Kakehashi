import { gravatarHash, normalizeGravatarEmail } from "@/lib/gravatar";

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

const PUBLIC_COMMENT_FIELDS = [
  "id",
  "issue_id",
  "user_username",
  "user_level",
  "content",
  "created_at",
  "updated_at",
  "likes_count",
  "reply_to_comment_id",
] as const;

const PRIVATE_AUTHOR_FIELDS = ["user_id", "user_email"] as const;
const NO_SUPPORTERS: ReadonlySet<string> = new Set();
const DEVELOPER_USERNAME = "Portego";
const DEVELOPER_EMAIL = "portego2000@hotmail.es";
const NOREPLY_EMAIL_SUFFIX = "@users.noreply.local";

export const COMMUNITY_ISSUE_READ_SELECT = [...PUBLIC_ISSUE_FIELDS, ...PRIVATE_AUTHOR_FIELDS].join(",");
export const COMMUNITY_COMMENT_READ_SELECT = [...PUBLIC_COMMENT_FIELDS, ...PRIVATE_AUTHOR_FIELDS].join(",");

function publicCommunityAuthor(
  row: Record<string, unknown>,
  fields: readonly string[],
  supporterUsernames: ReadonlySet<string>,
) {
  const username = typeof row.user_username === "string" ? row.user_username : "";
  const normalizedUsername = username.trim().toLowerCase();
  const normalizedEmail = normalizeGravatarEmail(row.user_email);
  return {
    ...Object.fromEntries(fields.filter((field) => field in row).map((field) => [field, row[field]])),
    user_gravatar_hash: normalizedEmail.endsWith(NOREPLY_EMAIL_SUFFIX) ? null : gravatarHash(normalizedEmail),
    is_developer: username === DEVELOPER_USERNAME && normalizedEmail === DEVELOPER_EMAIL,
    is_patreon_supporter: normalizedUsername.length > 0 && supporterUsernames.has(normalizedUsername),
  };
}

export function publicCommunityIssue(value: unknown, supporterUsernames: ReadonlySet<string> = NO_SUPPORTERS): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return publicCommunityAuthor(value as Record<string, unknown>, PUBLIC_ISSUE_FIELDS, supporterUsernames);
}

export function publicCommunityComment(value: unknown, supporterUsernames: ReadonlySet<string> = NO_SUPPORTERS): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return publicCommunityAuthor(value as Record<string, unknown>, PUBLIC_COMMENT_FIELDS, supporterUsernames);
}
