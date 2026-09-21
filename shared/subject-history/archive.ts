import { canonical, type HistoryChange, type SubjectSnapshot } from './model';

export const archiveCommit = '6f30f1cce96be848f70d8631fdff57a5111c989b';
export const archiveSource = {
  kind: 'archive' as const,
  url: `https://github.com/tofugu/wanikani-deprecated-content/blob/${archiveCommit}/deprecated_subject_data.csv`,
  summary: 'Pre-2019 content published by Tofugu. Compared with our saved version; exact change dates and intermediate versions are unknown. Blank archive fields are not treated as removals. Historical answer priority and acceptance are unknown.',
  licenseUrl: `https://github.com/tofugu/wanikani-deprecated-content/blob/${archiveCommit}/LICENSE`,
};

// CSV includes quoted commas, doubled quotes, and multiline mnemonics.
export function parseArchive(csv: string): Record<string, string>[] {
  const records: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') {
      if (quoted && csv[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n')) {
      row.push(cell.replace(/\r$/, '')); cell = '';
      if (c === '\n') { records.push(row); row = []; }
    } else cell += c;
  }
  if (quoted) throw new Error('Unterminated CSV field');
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); records.push(row); }
  const header = records.shift();
  const required = ['subject_id', 'subject_type', 'deprecated_meanings', 'deprecated_meaning_mnemonic', 'deprecated_reading_mnemonic', 'deprecated_meaning_hint', 'deprecated_reading_hint'];
  if (!header || required.some(key => !header.includes(key))) throw new Error('Unexpected archive columns');
  const ids = new Set<number>();
  return records.filter(record => record.some(Boolean)).map(record => {
    if (record.length !== header.length) throw new Error('Unexpected CSV width');
    const item = Object.fromEntries(header.map((key, i) => [key, record[i]]));
    const id = Number(item.subject_id);
    if (!Number.isSafeInteger(id) || id < 1 || ids.has(id)) throw new Error('Invalid or duplicate subject ID');
    if (!['Radical', 'Kanji'].includes(item.subject_type)) throw new Error('Unexpected subject type');
    ids.add(id);
    return item;
  });
}
export function archiveChanges(row: Record<string, string>, current: SubjectSnapshot): HistoryChange[] {
  if (Number(row.subject_id) !== current.id || row.subject_type.toLowerCase() !== current.object) throw new Error('Archive subject identity mismatch');
  const changes: HistoryChange[] = [];
  for (const field of ['meaning_mnemonic', 'reading_mnemonic', 'meaning_hint', 'reading_hint', 'meanings']) {
    const raw = row[`deprecated_${field}`];
    // Empty cells mean no historical value supplied, not that the field was empty.
    if (!raw) continue;
    const before = field === 'meanings' ? raw.split(',').map(meaning => ({ meaning: meaning.trim() })) : raw.replace(/\[(\/?)(radical|kanji|vocabulary|meaning|reading|em|ja)\]/g, '<$1$2>');
    const value = current.data[field];
    const after = field === 'meanings' && Array.isArray(value) ? value.map(item => ({ meaning: item.meaning })) : value ?? null;
    // Old hint fields no longer have an API equivalent: preserve, don't assert deletion.
    const archivedOnly = value === undefined || value === null;
    if (archivedOnly || canonical(before) !== canonical(after)) changes.push({ field, before, after, ...(archivedOnly ? { archivedOnly: true } : {}) });
  }
  return changes;
}
