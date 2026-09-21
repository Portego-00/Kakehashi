import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SubjectHistoryButton } from '../SubjectHistory';
jest.mock('../../../utils/theme', () => ({ useTheme: () => ({ theme: { backgroundColor: '#181818', textColor: '#222', textLight: '#666', border: '#ccc' } }) }));
jest.mock('../../../utils/store', () => ({
  useAuthStore: (select: (state: { apiToken: string }) => unknown) => select({ apiToken: 'test-history-token' }),
  useSettingsStore: (select: (state: { showSubjectHistory: boolean }) => unknown) => select({ showSubjectHistory: true }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) }));
jest.mock('../../../utils/subjectColors', () => ({ useSubjectColors: () => ({ kanji: '#d04a79', radical: '#368fb2', vocabulary: '#9466ae' }), getReadableTextColor: () => '#fff' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
it('loads only after opening and reuses its cached page', async () => {
  fetchMock.resetMocks();
  fetchMock.mockResponse(JSON.stringify({ entries: [], baselineAt: '2026-09-19', level: 1, cursor: null }));
  render(<SubjectHistoryButton subjectId={123} label="一" />);
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Change history'));
  await screen.findByText('No changes recorded yet.');
  fireEvent.press(screen.getByLabelText('Close change history'));
  fireEvent.press(screen.getByLabelText('Change history'));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
});
it('opens the latest update with highlighted mnemonic edits and composition names', async () => {
  fetchMock.resetMocks();
  fetchMock.mockResponse(JSON.stringify({ baselineAt: '2026-09-19', cursor: null, level: 1, entries: [{ id: 'edit', updatedAt: '2026-09-20', observedAt: '2026-09-20', labels: { '1': '一 — Ground', '2': '囗 — Prison' }, changes: [{ field: 'meaning_mnemonic', before: 'The leaf moves.', after: 'The sword moves.' }, { field: 'component_subject_ids', before: [1], after: [2] }] }] }));
  render(<SubjectHistoryButton subjectId={456} label="万" meaning="Ten thousand" subjectType="kanji" />);
  fireEvent.press(screen.getByLabelText('Change history'));
  await screen.findByText('Meaning mnemonic');
  expect(screen.getByText('leaf').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ textDecorationLine: 'line-through' })]));
  expect(screen.getByText('sword').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ textDecorationLine: 'underline' })]));
  expect(screen.getByText('− Ground')).toBeTruthy();
  expect(screen.getByText('+ Prison')).toBeTruthy();
});
it('shows historical provenance and archive-only hints without a false deletion', async () => {
  fetchMock.resetMocks();
  fetchMock.mockResponse(JSON.stringify({ baselineAt: '2026-09-19', cursor: null, level: 1, entries: [{ id: 'archive', updatedAt: '2026-09-20', observedAt: '2026-09-20', source: { kind: 'archive', url: 'https://github.com/tofugu/wanikani-deprecated-content', summary: 'Exact change dates are unknown.' }, labels: {}, changes: [{ field: 'meaning_hint', before: 'A historical hint.', after: null, archivedOnly: true }] }] }));
  render(<SubjectHistoryButton subjectId={789} label="一" />);
  fireEvent.press(screen.getByLabelText('Change history'));
  await screen.findByText('A historical hint.');
  expect(screen.getByText('Tofugu archive')).toBeTruthy();
  expect(screen.getByText('Archived text only. This field has no equivalent in the current API.')).toBeTruthy();
  expect(screen.queryByText('None')).toBeNull();
  expect(screen.queryByText('September 20, 2026')).toBeNull();
});

it('uses normal sheet padding even when the device has a large top inset', async () => {
  fetchMock.resetMocks();
  fetchMock.mockResponse(JSON.stringify({ entries: [], cursor: null }));
  render(<SubjectHistoryButton subjectId={901} label="一" />);
  fireEvent.press(screen.getByLabelText('Change history'));
  await screen.findByText('No changes recorded yet.');
  const header = screen.UNSAFE_getAllByType(View).find(view =>
    StyleSheet.flatten(view.props.style)?.backgroundColor === '#d04a79'
  );
  expect(StyleSheet.flatten(header?.props.style).paddingTop).toBe(16);
});
it('keeps the sheet content and dark background during dismissal', async () => {
  fetchMock.resetMocks();
  fetchMock.mockResponse(JSON.stringify({ entries: [], cursor: null }));
  render(<SubjectHistoryButton subjectId={902} label="一" />);
  fireEvent.press(screen.getByLabelText('Change history'));
  await screen.findByText('No changes recorded yet.');
  fireEvent.press(screen.getByLabelText('Close change history'));
  const modal = screen.UNSAFE_getByType(Modal);
  expect(modal.props.visible).toBe(false);
  expect(React.Children.count(modal.props.children)).toBe(1);
  expect(modal.props.backdropColor).toBe('#181818');
  fireEvent(modal, 'dismiss');
  expect(React.Children.count(screen.UNSAFE_getByType(Modal).props.children)).toBe(0);
  fireEvent.press(screen.getByLabelText('Change history'));
  await screen.findByText('No changes recorded yet.');
});
