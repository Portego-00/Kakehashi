const MIN_COLUMN_WIDTH = 344;

export function analyticsGridColumns(width: number, gap: number): 1 | 2 {
  return Number.isFinite(width) && width >= MIN_COLUMN_WIDTH * 2 + Math.max(0, gap) ? 2 : 1;
}

export function analyticsGridOrphanIndices(sizes: readonly ("compact" | "wide")[], columns: 1 | 2): number[] {
  if (columns === 1) return [];
  const orphans: number[] = [];
  let pending: number | null = null;
  for (let index = 0; index < sizes.length; index += 1) {
    if (sizes[index] === "wide") {
      if (pending !== null) orphans.push(pending);
      pending = null;
    } else {
      pending = pending === null ? index : null;
    }
  }
  if (pending !== null) orphans.push(pending);
  return orphans;
}
