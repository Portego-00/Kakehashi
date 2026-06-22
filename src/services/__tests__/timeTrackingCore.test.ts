import {
  APP_TOTAL_KEY,
  MAX_FOLD_DELTA_MS,
  TimeTrackingCore,
  emptyRangeSummary,
  addRecordToSummary,
  getLocalDateKey,
  splitSpanByLocalDay,
  studyMsOfRecord,
  summarizeRange,
  type DayRecord,
  type DayStore,
} from '../timeTrackingCore';

class MemoryDayStore implements DayStore {
  map = new Map<string, DayRecord>();

  getDay(dateKey: string): DayRecord | null {
    const record = this.map.get(dateKey);
    return record ? { ...record } : null;
  }

  setDay(dateKey: string, record: DayRecord): void {
    this.map.set(dateKey, { ...record });
  }

  getAllDayKeys(): string[] {
    return [...this.map.keys()].sort();
  }
}

// Local-time timestamps keep the tests deterministic in any timezone.
const at = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0
) => new Date(year, month - 1, day, hour, minute, second, ms).getTime();

function makeCore(startMs: number) {
  const store = new MemoryDayStore();
  let now = startMs;
  const core = new TimeTrackingCore(store, () => now);
  const advance = (deltaMs: number) => {
    now += deltaMs;
  };
  const setNow = (timestamp: number) => {
    now = timestamp;
  };
  return { core, store, advance, setNow };
}

describe('splitSpanByLocalDay', () => {
  it('keeps a same-day span in one part', () => {
    const start = at(2026, 6, 9, 10, 0);
    const parts = splitSpanByLocalDay(start, start + 5_000);
    expect(parts).toEqual([{ dateKey: '2026-06-09', ms: 5_000 }]);
  });

  it('splits a span crossing midnight between both days', () => {
    const start = at(2026, 6, 9, 23, 59, 58);
    const end = at(2026, 6, 10, 0, 0, 3);
    expect(splitSpanByLocalDay(start, end)).toEqual([
      { dateKey: '2026-06-09', ms: 2_000 },
      { dateKey: '2026-06-10', ms: 3_000 },
    ]);
  });

  it('returns nothing for empty or inverted spans', () => {
    const start = at(2026, 6, 9, 10, 0);
    expect(splitSpanByLocalDay(start, start)).toEqual([]);
    expect(splitSpanByLocalDay(start, start - 1_000)).toEqual([]);
  });
});

describe('TimeTrackingCore', () => {
  it('accrues app total while foregrounded with no activity', () => {
    const { core, store, advance } = makeCore(at(2026, 6, 9, 10, 0));
    core.setForeground(true);
    advance(7_000);
    core.fold();

    expect(store.getDay('2026-06-09')).toEqual({ [APP_TOTAL_KEY]: 7_000 });
  });

  it('attributes time to the most recently begun activity', () => {
    const { core, store, advance } = makeCore(at(2026, 6, 9, 10, 0));
    core.setForeground(true);

    const reviewsToken = core.begin('reviews');
    advance(10_000);

    // A focus-tracked screen opens on top of the review flow.
    const songsToken = core.begin('songs');
    advance(5_000);
    core.end(songsToken);

    advance(10_000);
    core.end(reviewsToken);

    const day = store.getDay('2026-06-09')!;
    expect(day.reviews).toBe(20_000);
    expect(day.songs).toBe(5_000);
    expect(day[APP_TOTAL_KEY]).toBe(25_000);
  });

  it('keeps the flow activity running while neutral screens are on top', () => {
    // Neutral screens (subject details, search) never register, so the flow
    // simply keeps accruing — this asserts that nothing else interferes.
    const { core, store, advance } = makeCore(at(2026, 6, 9, 10, 0));
    core.setForeground(true);

    const token = core.begin('reviews');
    advance(60_000 * 0 + 30_000);
    core.fold();
    advance(30_000);
    core.end(token);

    expect(store.getDay('2026-06-09')!.reviews).toBe(60_000);
  });

  it('does not accrue while backgrounded and resumes cleanly', () => {
    const { core, store, advance } = makeCore(at(2026, 6, 9, 10, 0));
    core.setForeground(true);
    core.begin('lessons');

    advance(10_000);
    core.setForeground(false); // folds the first 10s

    advance(120_000); // suspended for 2 minutes
    core.setForeground(true);

    advance(5_000);
    core.fold();

    const day = store.getDay('2026-06-09')!;
    expect(day.lessons).toBe(15_000);
    expect(day[APP_TOTAL_KEY]).toBe(15_000);
  });

  it('splits time across local days at midnight', () => {
    const { core, store, advance } = makeCore(at(2026, 6, 9, 23, 59, 57));
    core.setForeground(true);
    core.begin('epub');

    advance(6_000); // 3s before midnight + 3s after
    core.fold();

    expect(store.getDay('2026-06-09')!.epub).toBe(3_000);
    expect(store.getDay('2026-06-10')!.epub).toBe(3_000);
  });

  it('caps implausibly large folds (missed lifecycle events)', () => {
    const { core, store, advance } = makeCore(at(2026, 6, 9, 10, 0));
    core.setForeground(true);
    core.begin('reviews');

    advance(45 * 60_000); // 45 minutes without any fold
    core.fold();

    const day = store.getDay('2026-06-09')!;
    expect(day.reviews).toBe(MAX_FOLD_DELTA_MS);
    expect(day[APP_TOTAL_KEY]).toBe(MAX_FOLD_DELTA_MS);
  });

  it('drops negative deltas when the clock moves backwards', () => {
    const { core, store, advance, setNow } = makeCore(at(2026, 6, 9, 10, 0));
    core.setForeground(true);
    core.begin('reviews');

    setNow(at(2026, 6, 9, 9, 0)); // device clock jumped back an hour
    core.fold();
    expect(store.getDay('2026-06-09')).toBeNull();

    advance(5_000);
    core.fold();
    expect(store.getDay('2026-06-09')!.reviews).toBe(5_000);
  });

  it('keeps one continuous clock when the same activity overlaps', () => {
    // e.g. songs tab focused, then song lyrics pushed on top (both "songs").
    const { core, store, advance } = makeCore(at(2026, 6, 9, 10, 0));
    core.setForeground(true);

    const tabToken = core.begin('songs');
    advance(4_000);
    const lyricsToken = core.begin('songs');
    advance(4_000);
    core.end(tabToken);
    advance(4_000);
    core.end(lyricsToken);

    expect(store.getDay('2026-06-09')!.songs).toBe(12_000);
  });

  it('exposes live totals without persisting them', () => {
    const { core, store, advance } = makeCore(at(2026, 6, 9, 10, 0));
    core.setForeground(true);
    core.begin('news');
    advance(8_000);

    const live = core.getLiveDayRecord('2026-06-09');
    expect(live.news).toBe(8_000);
    expect(live[APP_TOTAL_KEY]).toBe(8_000);
    expect(store.getDay('2026-06-09')).toBeNull();
  });
});

describe('aggregation', () => {
  it('separates study time from app total and counts active days', () => {
    const store = new MemoryDayStore();
    store.setDay('2026-06-07', { reviews: 60_000, [APP_TOTAL_KEY]: 90_000 });
    store.setDay('2026-06-08', { [APP_TOTAL_KEY]: 30_000 }); // app open, no study
    store.setDay('2026-06-09', {
      lessons: 30_000,
      kana_kanji: 15_000,
      [APP_TOTAL_KEY]: 50_000,
    });

    const summary = summarizeRange(store, '2026-06-01', '2026-06-30');

    expect(summary.studyMs).toBe(105_000);
    expect(summary.appTotalMs).toBe(170_000);
    expect(summary.activeDayCount).toBe(2);
    expect(summary.byCategory.reviews).toBe(60_000);
    expect(summary.byCategory.lessons).toBe(30_000);
    expect(summary.byCategory.extra_study).toBe(15_000);
  });

  it('uses the live record instead of the stored one for today', () => {
    const store = new MemoryDayStore();
    store.setDay('2026-06-09', { reviews: 10_000 });

    const summary = summarizeRange(store, '2026-06-09', '2026-06-09', {
      dateKey: '2026-06-09',
      record: { reviews: 12_500 },
    });

    expect(summary.studyMs).toBe(12_500);
  });

  it('ignores unknown bucket keys', () => {
    const record: DayRecord = { reviews: 1_000, some_future_key: 9_999 };
    expect(studyMsOfRecord(record)).toBe(1_000);

    const summary = emptyRangeSummary();
    addRecordToSummary(summary, record);
    expect(summary.studyMs).toBe(1_000);
  });

  it('maps every activity key to a category', () => {
    const summary = emptyRangeSummary();
    addRecordToSummary(summary, {
      reviews: 1,
      bunpro_reviews: 1,
      lessons: 1,
      bunpro_lessons: 1,
      recent_lessons_review: 1,
      custom_review: 1,
      custom_lesson: 1,
      test_session: 1,
      meaning_reading: 1,
      similar_kanji: 1,
      kana_kanji: 1,
      writing_practice: 1,
      writing_freehand: 1,
      context_sentence: 1,
      listening_practice: 1,
      crossword: 1,
      wordle: 1,
      news: 1,
      songs: 1,
      epub: 1,
      video: 1,
    });
    expect(summary.studyMs).toBe(21);
  });
});

describe('getLocalDateKey', () => {
  it('formats local dates as YYYY-MM-DD', () => {
    expect(getLocalDateKey(at(2026, 6, 9, 0, 0))).toBe('2026-06-09');
    expect(getLocalDateKey(at(2026, 1, 1, 23, 59))).toBe('2026-01-01');
  });
});
