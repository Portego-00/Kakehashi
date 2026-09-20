import { internalQueryGeneric as internalQuery, internalMutationGeneric as internalMutation, paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';
import { subjectChanges, type SubjectSnapshot } from '../../../shared/subject-history/model';

export const checkpoint = internalQuery({ args: {}, handler: async ctx => (await ctx.db.query('sync').withIndex('by_key', q => q.eq('key', 'subjects')).unique())?.completedAt ?? null });
export const complete = internalMutation({ args: { time: v.string() }, handler: async (ctx, { time }) => {
  const old = await ctx.db.query('sync').withIndex('by_key', q => q.eq('key', 'subjects')).unique();
  if (old) await ctx.db.patch(old._id, { completedAt: time }); else await ctx.db.insert('sync', { key: 'subjects', completedAt: time });
}});
export const ingest = internalMutation({ args: { subjects: v.array(v.any()), observedAt: v.string() }, handler: async (ctx, { subjects, observedAt }) => {
  for (const snapshot of subjects as SubjectSnapshot[]) {
    const old = await ctx.db.query('subjects').withIndex('by_subject', q => q.eq('subjectId', snapshot.id)).unique();
    if (!old) { await ctx.db.insert('subjects', { subjectId: snapshot.id, snapshot, baselineAt: observedAt }); continue; }
    if (snapshot.data_updated_at < old.snapshot.data_updated_at) continue;
    const changes = subjectChanges(old.snapshot, snapshot);
    if (changes.length) {
      const labels: Record<string, string> = {};
      for (const change of changes.filter(change => change.field.endsWith('_subject_ids'))) {
        for (const id of [...(Array.isArray(change.before) ? change.before : []), ...(Array.isArray(change.after) ? change.after : [])]) {
          const related = await ctx.db.query('subjects').withIndex('by_subject', q => q.eq('subjectId', id)).unique();
          if (related) { const data = related.snapshot.data; labels[String(id)] = [data.characters, data.meanings?.find((m: { primary: boolean }) => m.primary)?.meaning ?? data.slug].filter(Boolean).join(' — '); }
        }
      }
      await ctx.db.insert('changes', { subjectId: snapshot.id, updatedAt: snapshot.data_updated_at, observedAt, changes, labels });
    }
    await ctx.db.patch(old._id, { snapshot });
  }
}});
export const page = internalQuery({ args: { subjectId: v.number(), paginationOpts: paginationOptsValidator }, handler: async (ctx, args) => {
  const subject = await ctx.db.query('subjects').withIndex('by_subject', q => q.eq('subjectId', args.subjectId)).unique();
  const result = await ctx.db.query('changes').withIndex('by_subject', q => q.eq('subjectId', args.subjectId)).order('desc').paginate(args.paginationOpts);
  const archive = result.isDone ? await ctx.db.query('archives').withIndex('by_subject', q => q.eq('subjectId', args.subjectId)).unique() : null;
  const entries = result.page.map(row => ({ id: row._id, updatedAt: row.updatedAt, observedAt: row.observedAt, changes: row.changes, labels: row.labels }));
  return { baselineAt: subject?.baselineAt ?? null, level: subject?.snapshot.data.level ?? null, cursor: result.isDone ? null : result.continueCursor,
    entries: [...entries, ...(archive ? [{ id: archive._id, updatedAt: archive.comparedAt, observedAt: archive.importedAt, changes: archive.changes, labels: {}, source: { ...archive.source, comparedAt: archive.comparedAt } }] : [])] };
}});
