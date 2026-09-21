import type { BunproAnalytics } from './analytics';

/** Synthetic data for tests only; never used as a production fallback. */
export const bunproAnalyticsFixture: BunproAnalytics = {
  facts: { streak: 12, days_studied: 84, grammar_studied: 230, vocab_studied: 480, weekly_streak: ['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21'].map((day, index) => ({ day, val: index < 5 })) },
  due: { total_due_grammar: 18, total_due_vocab: 27 },
  srs: { grammar: { beginner: 35, adept: 50, seasoned: 70, expert: 45, master: 30, ghost: 4, self_study: 2 }, vocab: { beginner: 80, adept: 100, seasoned: 110, expert: 90, master: 100, ghost: 8, self_study: 0 } },
  activity: { grammar: { '2026-09-17': 24, '2026-09-18': 38, '2026-09-19': 18, '2026-09-20': 42, '2026-09-21': 22 }, vocab: { '2026-09-17': 40, '2026-09-18': 26, '2026-09-19': 35, '2026-09-20': 51, '2026-09-21': 30 } },
  forecast: { grammar: { '2026-09-21': 18, '2026-09-22': 23, '2026-09-23': 31, '2026-09-24': 16, '2026-09-25': 25, '2026-09-26': 12, '2026-09-27': 8 }, vocab: { '2026-09-21': 27, '2026-09-22': 40, '2026-09-23': 32, '2026-09-24': 28, '2026-09-25': 20, '2026-09-26': 18, '2026-09-27': 22 } },
  jlpt: {
    grammar: { '5': { beginner: 5, adept: 10, seasoned: 20, expert: 25, master: 20, total_count: 100 }, '4': { beginner: 10, adept: 20, seasoned: 30, expert: 10, master: 10, total_count: 150 }, '3': { beginner: 20, adept: 20, seasoned: 20, expert: 10, master: 0, total_count: 200 }, '2': { beginner: 0, adept: 0, seasoned: 0, expert: 0, master: 0, total_count: 200 }, '1': { beginner: 0, adept: 0, seasoned: 0, expert: 0, master: 0, total_count: 200 } },
    vocab: { '5': { beginner: 20, adept: 30, seasoned: 30, expert: 40, master: 70, total_count: 600 }, '4': { beginner: 30, adept: 40, seasoned: 40, expert: 30, master: 30, total_count: 800 }, '3': { beginner: 30, adept: 30, seasoned: 40, expert: 20, master: 0, total_count: 1800 }, '2': { beginner: 0, adept: 0, seasoned: 0, expert: 0, master: 0, total_count: 2000 }, '1': { beginner: 0, adept: 0, seasoned: 0, expert: 0, master: 0, total_count: 3000 } },
  },
  reviewTotals: { grammar: { '5': { total: 100, correct: 92, incorrect: 8, accuracy: 92 } }, vocab: { '5': { total: 200, correct: 160, incorrect: 40, accuracy: 80 } } },
  heatmap: { grammar: { '2026-09-19': 25, '2026-09-20': 10 }, vocab: { '2026-09-19': 30 } },
  cram: { sessions: { session_count: 5, total_time: '00h 02m' }, items: { total: 11, correct: 11, incorrect: 0, accuracy: 100 } },
  unavailable: [],
};
