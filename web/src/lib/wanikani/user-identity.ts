export function waniKaniUserId(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const user = payload as { id?: unknown; data?: { id?: unknown } };
  const candidate = user.data?.id ?? user.id;
  return typeof candidate === "string" || typeof candidate === "number" ? String(candidate).trim() : "";
}
