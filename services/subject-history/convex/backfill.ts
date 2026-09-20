import { internalActionGeneric as internalAction, internalMutationGeneric as internalMutation, anyApi } from 'convex/server';
import { v } from 'convex/values';
import { archiveChanges, archiveCommit, archiveSource, parseArchive } from '../../../shared/subject-history/archive';

export const batch = internalMutation({ args: { rows: v.array(v.record(v.string(), v.string())), importedAt: v.string(), dryRun: v.boolean() }, handler: async (ctx, args) => {
  const result = { imported: 0, existing: 0, missing: [] as number[], fields: 0 };
  for (const row of args.rows) {
    const subjectId = Number(row.subject_id);
    const existing = await ctx.db.query('archives').withIndex('by_subject', q => q.eq('subjectId', subjectId)).unique();
    if (existing) { result.existing++; continue; }
    const subject = await ctx.db.query('subjects').withIndex('by_subject', q => q.eq('subjectId', subjectId)).unique();
    if (!subject) { result.missing.push(subjectId); continue; }
    const changes = archiveChanges(row, subject.snapshot);
    if (!changes.length) continue;
    if (!args.dryRun) await ctx.db.insert('archives', { subjectId, importedAt: args.importedAt, comparedAt: args.importedAt, changes, source: archiveSource });
    result.imported++; result.fields += changes.length;
  }
  return result;
}});
export const run = internalAction({ args: { dryRun: v.optional(v.boolean()) }, handler: async (ctx, args) => {
  const response = await fetch(`https://raw.githubusercontent.com/tofugu/wanikani-deprecated-content/${archiveCommit}/deprecated_subject_data.csv`, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Archive fetch failed: ${response.status}`);
  const rows = parseArchive(await response.text());
  if (rows.length !== 941) throw new Error('Pinned archive row count changed');
  const importedAt = new Date().toISOString();
  const result = { dryRun: args.dryRun !== false, sourceRows: rows.length, imported: 0, existing: 0, missing: [] as number[], fields: 0 };
  for (let i = 0; i < rows.length; i += 20) {
    const part = await ctx.runMutation(anyApi.backfill.batch, { rows: rows.slice(i, i + 20), importedAt, dryRun: result.dryRun });
    result.imported += part.imported; result.existing += part.existing; result.fields += part.fields; result.missing.push(...part.missing);
  }
  return result;
}});
