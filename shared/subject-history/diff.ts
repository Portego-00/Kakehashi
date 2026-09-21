export type DiffToken = { text: string; type: string };
export type DiffPart = DiffToken & { changed: boolean };
export function words(tokens: DiffToken[]): DiffToken[] {
  return tokens.flatMap(token => (token.text.match(/\s+|[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[\p{L}\p{N}_]+|[^\s]/gu) ?? []).map(text => ({ text, type: token.type })));
}
/** Bounded LCS: preserve unchanged wording and existing mnemonic semantics. */
export function diffTokens(before: DiffToken[], after: DiffToken[]): { before: DiffPart[]; after: DiffPart[] } {
  const left = words(before), right = words(after);
  const same = (i: number, j: number) => left[i].text === right[j].text && left[i].type === right[j].type;
  const old = left.map(token => ({ ...token, changed: true })), next = right.map(token => ({ ...token, changed: true }));
  if (left.length * right.length <= 250_000) {
    const width = right.length + 1;
    const matrix = new Uint32Array((left.length + 1) * width);
    for (let i = left.length - 1; i >= 0; i--) for (let j = right.length - 1; j >= 0; j--) matrix[i * width + j] = same(i, j) ? matrix[(i + 1) * width + j + 1] + 1 : Math.max(matrix[(i + 1) * width + j], matrix[i * width + j + 1]);
    let i = 0, j = 0;
    while (i < left.length && j < right.length) {
      if (same(i, j)) { old[i++].changed = false; next[j++].changed = false; }
      else if (matrix[(i + 1) * width + j] >= matrix[i * width + j + 1]) i++; else j++;
    }
  } else {
    let start = 0;
    while (start < left.length && start < right.length && same(start, start)) { old[start].changed = false; next[start++].changed = false; }
    let i = left.length - 1, j = right.length - 1;
    while (i >= start && j >= start && same(i, j)) { old[i--].changed = false; next[j--].changed = false; }
  }
  const merge = (parts: DiffPart[]) => parts.reduce<DiffPart[]>((result, part) => {
    const last = result[result.length - 1];
    if (last && last.changed === part.changed && last.type === part.type) last.text += part.text; else result.push({ ...part });
    return result;
  }, []);
  return { before: merge(old), after: merge(next) };
}
