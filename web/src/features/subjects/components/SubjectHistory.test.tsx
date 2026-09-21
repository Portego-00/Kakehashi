import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SubjectHistory } from './SubjectHistory';
import { subjectChanges, formatValue } from '../../../../../shared/subject-history/model';
afterEach(() => vi.unstubAllGlobals());
it('does not request history until opened and reuses cached history when reopened', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entries: [], baselineAt: '2026-09-19', level: 1, cursor: null }) });
  vi.stubGlobal('fetch', fetcher);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><SubjectHistory subjectId={1} label="一" /></QueryClientProvider>);
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Change history' }));
  await screen.findByText('No changes recorded yet.');
  fireEvent.click(screen.getByRole('button', { name: 'Close change history' }));
  fireEvent.click(screen.getByRole('button', { name: 'Change history' }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
});
it('captures composition, primary reading, nested changes, removals and new fields without timestamp-only events', () => {
  const before = { id: 1, object: 'kanji', data_updated_at: '2026-01-01', data: { component_subject_ids: [1, 2], readings: [{ reading: 'あ', primary: true }, { reading: 'めい', primary: false }], meaning_hint: 'old' } };
  expect(subjectChanges(before, { ...before, data_updated_at: '2026-09-19' })).toEqual([]);
  const changes = subjectChanges(before, { ...before, data: { component_subject_ids: [3], readings: [{ reading: 'あ', primary: false }, { reading: 'めい', primary: true }], future_field: { text: 'new' } } });
  expect(changes.map(change => change.field)).toEqual(['component_subject_ids', 'future_field', 'meaning_hint', 'readings']);
  expect(formatValue('component_subject_ids', [3], { '3': 'Bright' })).toBe('Bright');
  expect(formatValue('readings', [{ reading: 'めい', primary: true, accepted_answer: true }])).toBe('めい (primary, accepted)');
});

import { diffTokens } from '../../../../../shared/subject-history/diff';
it('highlights edited words without marking unchanged mnemonic content', () => {
  const diff = diffTokens([{ type: 'text', text: 'The leaf holds one sword.' }], [{ type: 'text', text: 'The prison holds one sword.' }]);
  expect(diff.before.filter(part => part.changed).map(part => part.text).join('')).toBe('leaf');
  expect(diff.after.filter(part => part.changed).map(part => part.text).join('')).toBe('prison');
  expect(diff.before.map(part => part.text).join('')).toBe('The leaf holds one sword.');
  expect(diff.after.map(part => part.text).join('')).toBe('The prison holds one sword.');
});
it('preserves mnemonic highlighting and catches formatting-only changes', () => {
  const diff = diffTokens([{ type: 'radical', text: 'ground' }], [{ type: 'kanji', text: 'ground' }]);
  expect(diff.before).toEqual([{ text: 'ground', type: 'radical', changed: true }]);
  expect(diff.after).toEqual([{ text: 'ground', type: 'kanji', changed: true }]);
});
it('bounds long-text comparison while preserving the full contents', () => {
  const before = 'same '.repeat(1000) + 'old ending';
  const after = 'same '.repeat(1000) + 'new ending';
  const diff = diffTokens([{ text: before, type: 'text' }], [{ text: after, type: 'text' }]);
  expect(diff.before.map(part => part.text).join('')).toBe(before);
  expect(diff.after.map(part => part.text).join('')).toBe(after);
  expect(diff.before[0].changed).toBe(false);
});

import { answerDetails } from '../../../../../shared/subject-history/model';
it('keeps reading type and answer acceptance visible in rich answer rows', () => {
  expect(answerDetails({ reading: 'あ', primary: true, type: 'kunyomi', accepted_answer: false })).toBe('Kun’yomi · Not accepted');
});

import { archiveChanges, parseArchive } from '../../../../../shared/subject-history/archive';
it('parses archived multiline CSV and rejects duplicate identities', () => {
  const header = 'subject_id,subject_type,deprecated_meanings,deprecated_meaning_mnemonic,deprecated_reading_mnemonic,deprecated_meaning_hint,deprecated_reading_hint\n';
  const row = '14,Radical,"Prison, Enclosure","A ""box"",\nwith walls.",,,\n';
  expect(parseArchive(header + row)[0].deprecated_meaning_mnemonic).toBe('A "box",\nwith walls.');
  expect(() => parseArchive(header + row + row)).toThrow('duplicate');
});
it('does not invent archive dates, answer priority, removals, or missing values', () => {
  const changes = archiveChanges({ subject_id: '14', subject_type: 'Radical', deprecated_meanings: 'Enclosure', deprecated_meaning_mnemonic: '[radical]box[/radical]', deprecated_reading_mnemonic: '', deprecated_meaning_hint: 'Old hint' }, { id: 14, object: 'radical', data_updated_at: '2026-09-19', data: { meanings: [{ meaning: 'Prison', primary: true, accepted_answer: true }], meaning_mnemonic: '<radical>prison</radical>', reading_mnemonic: 'Not in archive' } });
  expect(changes).toContainEqual({ field: 'meanings', before: [{ meaning: 'Enclosure' }], after: [{ meaning: 'Prison' }] });
  expect(changes).toContainEqual({ field: 'meaning_hint', before: 'Old hint', after: null, archivedOnly: true });
  expect(changes.find(change => change.field === 'meaning_mnemonic')?.before).toBe('<radical>box</radical>');
  expect(changes.some(change => change.field === 'reading_mnemonic')).toBe(false);
});
it('labels archives honestly and preserves hints without showing a deletion', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entries: [{ id: 'archive', updatedAt: '2026-09-20', observedAt: '2026-09-20', source: { kind: 'archive', url: 'https://github.com/tofugu/wanikani-deprecated-content', licenseUrl: 'https://example.com/license', summary: 'Exact change dates are unknown.' }, changes: [{ field: 'meaning_hint', before: 'An older hint.', after: null, archivedOnly: true }], labels: {} }], baselineAt: '2026-09-19', cursor: null }) }));
  render(<QueryClientProvider client={new QueryClient()}><SubjectHistory subjectId={14} label="勹" /></QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Change history' }));
  await screen.findByText('An older hint.');
  expect(screen.getByRole('link', { name: 'Tofugu archive' })).toHaveAttribute('href', 'https://github.com/tofugu/wanikani-deprecated-content');
  expect(screen.getByText('An older hint.').closest('del')).toBeNull();
  expect(screen.queryByText('None')).not.toBeInTheDocument();
  expect(screen.queryByText('September 20, 2026')).not.toBeInTheDocument();
});
