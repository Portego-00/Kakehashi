import type { BunproBaseStatsFacts, BunproDueResponse, BunproForecastDailyResponse, BunproJlptProgressMixedResponse, BunproReviewActivityResponse, BunproSrsOverviewResponse } from '../../../../src/types/bunpro';

export type BunproAnalytics = {
  facts: Pick<BunproBaseStatsFacts, 'streak' | 'days_studied' | 'weekly_streak' | 'grammar_studied' | 'vocab_studied'> | null;
  activity: BunproReviewActivityResponse | null;
  forecast: BunproForecastDailyResponse | null;
  srs: BunproSrsOverviewResponse | null;
  jlpt: BunproJlptProgressMixedResponse | null;
  due: BunproDueResponse | null;
  reviewTotals: { grammar: Record<string, { total: number; correct: number; incorrect: number; accuracy: number }>; vocab: Record<string, { total: number; correct: number; incorrect: number; accuracy: number }> } | null;
  heatmap: BunproReviewActivityResponse | null;
  cram: { sessions: { session_count: number; total_time: string }; items: { total: number; correct: number; incorrect: number; accuracy: number } } | null;
  unavailable: string[];
};
export type BunproAnalyticsMode = 'all' | 'grammar' | 'vocab';
export const BUNPRO_STAGES = [
  { key: 'beginner', label: 'Beginner', color: 'var(--color-bunpro)' },
  { key: 'adept', label: 'Adept', color: 'var(--color-warning)' },
  { key: 'seasoned', label: 'Seasoned', color: 'var(--color-success)' },
  { key: 'expert', label: 'Expert', color: 'var(--color-accent)' },
  { key: 'master', label: 'Master', color: 'var(--color-vocabulary)' },
] as const;

export function bunproCount(value: number | undefined) { return value == null || !Number.isFinite(value) ? null : Math.max(0, value); }
export function bunproTotal(grammar: number | undefined, vocab: number | undefined, mode: BunproAnalyticsMode) {
  if (mode === 'grammar') return bunproCount(grammar);
  if (mode === 'vocab') return bunproCount(vocab);
  return grammar == null || vocab == null ? null : bunproCount(grammar + vocab);
}

/** Keep the API's dates and gaps; missing buckets are not zero-review days. */
export function bunproSeries(data: BunproReviewActivityResponse | null) {
  if (!data) return [];
  return [...new Set([...Object.keys(data.grammar), ...Object.keys(data.vocab)])]
    .filter(key => Number.isFinite(Date.parse(key)))
    .sort((a, b) => Date.parse(a) - Date.parse(b))
    .map(key => ({ key, label: new Date(/^\d{4}-\d{2}-\d{2}$/.test(key) ? `${key}T12:00:00` : key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), grammar: bunproCount(data.grammar[key]), vocab: bunproCount(data.vocab[key]) }));
}

export function bunproJlptRows(data: BunproJlptProgressMixedResponse, mode: BunproAnalyticsMode) {
  return (['5', '4', '3', '2', '1'] as const).map(level => {
    const grammar = data.grammar[level];
    const vocab = data.vocab[level];
    const stages = BUNPRO_STAGES.map(stage => ({ ...stage, value: bunproTotal(grammar[stage.key], vocab[stage.key], mode) ?? 0 }));
    const total = bunproTotal(grammar.total_count, vocab.total_count, mode) ?? 0;
    const studied = stages.reduce((sum, stage) => sum + stage.value, 0);
    return { level, stages, total, studied, percent: total ? Math.min(100, Math.round(studied / total * 100)) : 0 };
  });
}

/** Bunpro returns relative buckets before its dated forecast entries. */
export function bunproForecast(data: BunproForecastDailyResponse | null) {
  if (!data) return [];
  const relative = ([['later', 'Later today'], ['tomorrow', 'Tomorrow']] as const)
    .filter(([key]) => key in data.grammar || key in data.vocab)
    .map(([key, label]) => ({ key, label, grammar: bunproCount(data.grammar[key]), vocab: bunproCount(data.vocab[key]) }));
  return [...relative, ...bunproSeries(data)];
}
