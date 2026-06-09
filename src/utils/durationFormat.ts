/** "1h 23m", "12m 45s", "32s". Always returns something readable. */
export function formatDurationMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor((ms || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/** Coarse variant for averages and summaries: "1h 23m", "12m", "<1m". */
export function formatDurationMsCoarse(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms || 0) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return ms > 0 ? "<1m" : "0m";
}
