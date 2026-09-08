export function validTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return "UTC";
  }
}

export function browserTimezone() {
  try {
    return validTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  } catch {
    return "UTC";
  }
}

export function dayKeyInTimezone(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: validTimezone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : date.toISOString().slice(0, 10);
}

export function activeDayKeysForSessions(sessionStartedAt: string[], timezone: string) {
  const keys = new Set<string>();
  for (const value of sessionStartedAt) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) keys.add(dayKeyInTimezone(date, timezone));
  }
  return [...keys].sort();
}

export function parseActiveDayKeys(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((day) => typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`)) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day)) return null;
  return [...new Set(value as string[])].sort();
}
