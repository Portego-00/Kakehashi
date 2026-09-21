import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BunproAnalytics, BunproAnalyticsSource } from './BunproAnalytics';
import { bunpro } from './client';
import { bunproAnalyticsFixture as fixture } from './analytics-fixture';
vi.mock('./client', () => ({ bunpro: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function setup(source = false) {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={cache}>{source ? <BunproAnalyticsSource accountKey="account:1">{navigation => <>{navigation}<p>WaniKani analytics</p></>}</BunproAnalyticsSource> : <BunproAnalytics accountKey="account:1" />}</QueryClientProvider>);
  return cache;
}
it('loads only after selecting a connected Bunpro source and filters counts and chart data', async () => {
  vi.mocked(bunpro).mockImplementation(async query => query === 'action=connection' ? { connected: true } : fixture);
  setup(true);
  const source = await screen.findByRole('button', { name: 'Bunpro' });
  expect(bunpro).toHaveBeenCalledTimes(1);
  fireEvent.click(source);
  expect(await screen.findByText('710', { selector: 'dd' })).toBeVisible();
  expect(screen.getByText('45', { selector: 'dd' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Grammar' }));
  expect(screen.getByText('230', { selector: 'dd' })).toBeVisible();
  expect(screen.getByRole('region', { name: 'Study streak' })).toHaveTextContent('12 days');
  expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute('href', '/bunpro-reviews?mode=grammar');
  const chart = screen.getByRole('group', { name: 'Bunpro daily review activity' });
  fireEvent.click(within(chart).getByText('Chart data'));
  await waitFor(() => expect(within(chart).getByRole('columnheader', { name: 'Grammar' })).toBeVisible());
  expect(within(chart).queryByRole('columnheader', { name: 'Vocabulary' })).not.toBeInTheDocument();
});
it('does not offer analytics without a connected key', async () => {
  vi.mocked(bunpro).mockResolvedValue({ connected: false });
  setup(true);
  expect(await screen.findByText('WaniKani analytics')).toBeVisible();
  expect(screen.queryByRole('group', { name: 'Analytics source' })).not.toBeInTheDocument();
});
it('renders partial responses without turning missing data into zero', async () => {
  vi.mocked(bunpro).mockResolvedValue({ ...fixture, srs: null, unavailable: ['srs'] });
  setup();
  expect(await screen.findByRole('status')).toHaveTextContent('Some Bunpro statistics are unavailable');
  expect(screen.getByText('710', { selector: 'dd' })).toBeVisible();
  expect(screen.queryByRole('img', { name: /SRS composition/ })).not.toBeInTheDocument();
  expect(screen.queryByText('—')).not.toBeInTheDocument();
});
it('offers recovery when the key is rejected', async () => {
  vi.mocked(bunpro).mockRejectedValue(new Error('Reconnect in Settings.'));
  setup();
  expect(await screen.findByRole('alert')).toHaveTextContent('Reconnect in Settings.');
  expect(screen.getByRole('link', { name: 'Bunpro settings' })).toHaveAttribute('href', '/settings#bunpro-api-key');
});

it('hides unavailable and empty chart panels and renders real calendar dates', async () => {
  vi.mocked(bunpro).mockResolvedValue({ ...fixture, activity: null, forecast: { grammar: {}, vocab: {} }, facts: { ...fixture.facts, weekly_streak: [{ day: '2026-09-21', val: true }] }, unavailable: ['activity'] });
  setup();
  expect(await screen.findByText('Mon')).toBeVisible();
  expect(screen.getByLabelText('2026-09-21: Studied')).toHaveTextContent('21');
  expect(screen.queryByRole('region', { name: 'Review activity' })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Upcoming reviews' })).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('region', { name: 'Grammar · JLPT' })).toBeVisible());
  expect(screen.getByRole('region', { name: 'Vocabulary · JLPT' })).toBeVisible();
});

it('shows domain accuracy only when answers exist', async () => {
  vi.mocked(bunpro).mockResolvedValue({ ...fixture, reviewTotals: { grammar: { '5': { total: 10, correct: 9, incorrect: 1, accuracy: 90 }, '4': { total: 90, correct: 45, incorrect: 45, accuracy: 50 } }, vocab: { '5': { total: 0, correct: 0, incorrect: 0, accuracy: 0 } } } });
  setup();
  const grammar = await screen.findByRole('region', { name: 'Grammar knowledge' });
  expect(grammar).toHaveTextContent('54.0%');
  expect(screen.getByRole('region', { name: 'Vocabulary knowledge' })).not.toHaveTextContent('review accuracy');
});
