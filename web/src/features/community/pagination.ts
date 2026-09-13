export function boundedPage(value: string | null, maxPage = 100) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(maxPage, Math.floor(parsed))) : 0;
}

export function boundedIdChunks(ids: unknown[], chunkSize = 20, hardMax = 50) {
  const unique = [...new Set(ids.map((id) => String(id || "")).filter(Boolean))].slice(0, hardMax);
  const chunks: string[][] = [];
  for (let index = 0; index < unique.length; index += chunkSize) chunks.push(unique.slice(index, index + chunkSize));
  return chunks;
}
