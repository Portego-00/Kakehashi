export type SubjectSnapshot = { id: number; object: string; data_updated_at: string; data: Record<string, unknown> };
export type HistoryChange = { field: string; before: unknown; after: unknown; archivedOnly?: boolean };
export type HistoryEntry = { id: string; updatedAt: string; observedAt: string; changes: HistoryChange[]; source?: { url: string; summary: string; kind?: 'archive'; licenseUrl?: string; comparedAt?: string }; labels: Record<string, string> };
export type HistoryPage = { entries: HistoryEntry[]; baselineAt: string | null; level: number | null; cursor: string | null };

export function canonical(value: unknown): string {
  if (value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

export function subjectChanges(before: SubjectSnapshot, after: SubjectSnapshot): HistoryChange[] {
  const left = { ...before.data, subject_type: before.object };
  const right = { ...after.data, subject_type: after.object };
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].sort().flatMap(field => {
    const oldValue = (left as Record<string, unknown>)[field] ?? null;
    const newValue = (right as Record<string, unknown>)[field] ?? null;
    return canonical(oldValue) === canonical(newValue) ? [] : [{ field, before: oldValue, after: newValue }];
  });
}

const labels: Record<string, string> = {
  component_subject_ids: 'Composition', amalgamation_subject_ids: 'Used in', visually_similar_subject_ids: 'Visually similar subjects',
  meaning_mnemonic: 'Meaning mnemonic', reading_mnemonic: 'Reading mnemonic', meaning_hint: 'Meaning hint', reading_hint: 'Reading hint',
  meanings: 'Meanings', readings: 'Readings', auxiliary_meanings: 'Additional answers', auxiliary_readings: 'Additional readings',
  context_sentences: 'Context sentences', pronunciation_audios: 'Pronunciation audio', character_images: 'Radical images',
  hidden_at: 'Visibility', lesson_position: 'Lesson order', spaced_repetition_system_id: 'SRS system', subject_type: 'Subject type',
};
export function fieldLabel(field: string): string { return labels[field] ?? field.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()); }
export function plainText(value: string): string { return value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"); }
export function formatValue(field: string, value: unknown, names: Record<string, string> = {}): string {
  if (value === null || value === undefined) return 'None';
  if (Array.isArray(value)) {
    if (!value.length) return 'None';
    if (field.endsWith('_subject_ids')) return value.map(id => names[String(id)] ?? `Subject #${id}`).join(' · ');
    return value.map(item => {
      if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>;
        if ('meaning' in row || 'reading' in row) {
          const flags = [row.primary === true ? 'primary' : null, row.accepted_answer === true ? 'accepted' : row.accepted_answer === false ? 'not accepted' : null, row.type].filter(Boolean);
          return `${row.meaning ?? row.reading}${flags.length ? ` (${flags.join(', ')})` : ''}`;
        }
        if ('ja' in row && 'en' in row) return `${row.ja}\n${row.en}`;
        return Object.entries(row).map(([key, itemValue]) => `${fieldLabel(key)}: ${formatValue(key, itemValue, names)}`).join('\n');
      }
      return formatValue(field, item, names);
    }).join('\n');
  }
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${fieldLabel(key)}: ${formatValue(key, item, names)}`).join('\n');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return plainText(String(value));
}

export function answerDetails(row: Record<string, unknown>): string {
  return Object.entries(row).filter(([key]) => !['meaning', 'reading', 'primary'].includes(key)).map(([key, value]) => {
    if (key === 'accepted_answer') return value ? 'Accepted answer' : 'Not accepted';
    if (key === 'type') return ({ onyomi: 'On’yomi', kunyomi: 'Kun’yomi', nanori: 'Nanori', whitelist: 'Allow list', blacklist: 'Block list' } as Record<string, string>)[String(value)] ?? String(value);
    return `${fieldLabel(key)}: ${formatValue(key, value)}`;
  }).join(' · ');
}
