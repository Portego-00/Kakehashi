import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
export default defineSchema({
  subjects: defineTable({ subjectId: v.number(), snapshot: v.any(), baselineAt: v.string() }).index('by_subject', ['subjectId']),
  changes: defineTable({ subjectId: v.number(), updatedAt: v.string(), observedAt: v.string(), changes: v.any(), labels: v.any() }).index('by_subject', ['subjectId']),
  archives: defineTable({ subjectId: v.number(), importedAt: v.string(), comparedAt: v.string(), changes: v.any(), source: v.any() }).index('by_subject', ['subjectId']),
  sync: defineTable({ key: v.string(), completedAt: v.string() }).index('by_key', ['key']),
});
