export function normalizeReviewPromptTextColor(value: unknown): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim().toLowerCase()
    : "";
}
