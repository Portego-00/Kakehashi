function words(value: string): string[] {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

// Bounded edit distance, including adjacent transpositions (e.g. “soudn”).
function nearWord(query: string, candidate: string) {
  if (candidate.startsWith(query)) return true;
  const limit = query.length >= 7 ? 2 : query.length >= 4 ? 1 : 0;
  if (!limit || Math.abs(query.length - candidate.length) > limit) return false;
  const rows = Array.from({ length: query.length + 1 }, () => Array<number>(candidate.length + 1).fill(0));
  for (let i = 0; i <= query.length; i++) rows[i][0] = i;
  for (let j = 0; j <= candidate.length; j++) rows[0][j] = j;
  for (let i = 1; i <= query.length; i++) {
    for (let j = 1; j <= candidate.length; j++) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + Number(query[i - 1] !== candidate[j - 1]));
      if (i > 1 && j > 1 && query[i - 1] === candidate[j - 2] && query[i - 2] === candidate[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[query.length][candidate.length] <= limit;
}

export function settingsSearchScore(query: string, label: string, description = "", section = "", keywords = "") {
  const tokens = words(query).slice(0, 12);
  if (!tokens.length) return 0;
  const labelWords = words(label);
  const otherWords = words(`${description} ${section} ${keywords}`);
  let score = 0;
  for (const token of tokens) {
    if (labelWords.includes(token)) score += 8;
    else if (labelWords.some((word) => word.startsWith(token))) score += 6;
    else if (labelWords.some((word) => nearWord(token, word))) score += 4;
    else if (otherWords.some((word) => nearWord(token, word))) score += 1;
    else return 0;
  }
  return score;
}
