import { expect, it } from 'vitest';
import { bunproForecast, bunproJlptRows, bunproSeries, bunproTotal } from './analytics';
import { bunproAnalyticsFixture as fixture } from './analytics-fixture';
it('sorts reported dates while retaining absent series as unknown', () => {
  expect(bunproSeries({ grammar: { '2026-09-21': 2, 'bad': 8, '2026-09-19': 0 }, vocab: { '2026-09-21': 4 } })).toEqual([
    expect.objectContaining({ key: '2026-09-19', grammar: 0, vocab: null }),
    expect.objectContaining({ key: '2026-09-21', grammar: 2, vocab: 4 }),
  ]);
  expect(bunproTotal(2, undefined, 'all')).toBeNull();
  expect(bunproTotal(2, undefined, 'grammar')).toBe(2);
});
it('uses weighted JLPT totals and keeps unstarted levels visible', () => {
  const rows = bunproJlptRows(fixture.jlpt!, 'all');
  expect(rows[0]).toMatchObject({ level: '5', total: 700, studied: 270, percent: 39 });
  expect(rows[4]).toMatchObject({ level: '1', studied: 0, percent: 0 });
  expect(bunproJlptRows(fixture.jlpt!, 'grammar')[0]).toMatchObject({ total: 100, studied: 80, percent: 80 });
});

it('retains the live API relative forecast buckets without fabricating dates', () => {
  expect(bunproForecast({ grammar: { later: 1, tomorrow: 0, '2026-10-02': 2 }, vocab: { later: 0, tomorrow: 0, '2026-10-02': 0 } })).toEqual([
    { key: 'later', label: 'Later today', grammar: 1, vocab: 0 },
    { key: 'tomorrow', label: 'Tomorrow', grammar: 0, vocab: 0 },
    expect.objectContaining({ key: '2026-10-02', grammar: 2 }),
  ]);
});
