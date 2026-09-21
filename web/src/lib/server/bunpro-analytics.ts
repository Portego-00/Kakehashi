import 'server-only';
import { z } from 'zod';
import { bunproRequest, BunproError } from './bunpro';
import type { BunproAnalytics } from '@/features/bunpro/analytics';

const count = z.number().finite().nonnegative();
const series = z.object({ grammar: z.record(z.string(), count), vocab: z.record(z.string(), count) });
const reviewLevel = z.object({ total: count, correct: count, incorrect: count, accuracy: count.max(100) });
const reviewLevels = z.record(z.string(), reviewLevel);
const stages = z.object({ beginner: count, adept: count, seasoned: count, expert: count, master: count });
const jlptLevel = stages.extend({ total_count: count });
const jlptBucket = z.object({ '1': jlptLevel, '2': jlptLevel, '3': jlptLevel, '4': jlptLevel, '5': jlptLevel });
const overview = stages.extend({ ghost: count, self_study: count });
const facts = z.object({ days_studied: count, weekly_streak: z.array(z.object({ day: z.string(), val: z.boolean() })), streak: count, grammar_studied: count, vocab_studied: count });

export async function loadBunproAnalytics(token: string): Promise<BunproAnalytics> {
  const resources = [
    ['facts', '/user_stats/base_stats', z.object({ facts }).transform(value => value.facts)],
    ['activity', '/user_stats/activity_daily', series],
    ['forecast', '/user_stats/forecast_daily', series],
    ['srs', '/user_stats/srs_level_overview', z.object({ grammar: overview, vocab: overview })],
    ['jlpt', '/user_stats/jlpt_progress_mixed', z.object({ grammar: jlptBucket, vocab: jlptBucket })],
    ['reviewTotals', '/user_stats/total_review_stats', z.object({ grammar: reviewLevels, vocab: reviewLevels })],
    ['heatmap', '/user_stats/review_heatmap', series],
    ['cram', '/user_stats/total_cram_stats', z.object({ sessions: z.object({ session_count: count, total_time: z.string() }), items: z.object({ total: count, correct: count, incorrect: count, accuracy: count.max(100) }) })],
    ['due', '/user/due', z.object({ total_due_grammar: count, total_due_vocab: count })],
  ] as const;
  const results = await Promise.allSettled(resources.map(async ([, path, schema]) => schema.parse(await bunproRequest(token, path))));
  const rejectedKey = results.find(result => result.status === 'rejected' && result.reason instanceof BunproError && [401, 403].includes(result.reason.status));
  if (rejectedKey?.status === 'rejected') throw rejectedKey.reason;
  if (results.every(result => result.status === 'rejected')) throw new BunproError('Bunpro analytics could not be loaded. Try again shortly.');
  // Each resource is validated independently, so one unavailable endpoint does not erase the others.
  return { ...Object.fromEntries(resources.map(([key], index) => [key, results[index].status === 'fulfilled' ? results[index].value : null])), unavailable: resources.filter((_, index) => results[index].status === 'rejected').map(([key]) => key) } as BunproAnalytics;
}
