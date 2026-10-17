import type { BurnedItem, CriticalItem, UnlockItem, WaniKaniItemType } from "../types/wanikani";

// Process recent unlocks
export const buildRecentUnlocks = (
  assignments: any[],
  subjectsById: Record<number, any>
): UnlockItem[] => {
  const items = assignments
    .filter((a) => a.data.unlocked_at)
    .map((assignment): UnlockItem | null => {
      const subject = subjectsById[assignment.data.subject_id];
      if (!subject) return null;

      return {
        id: subject.id,
        characters: subject.data.characters,
        meaning: subject.data.meanings[0].meaning,
        source: subject,
        type: subject.object as WaniKaniItemType,
        dateUnlocked: assignment.data.unlocked_at,
      };
    })
    .filter((item): item is UnlockItem => item !== null)
    .sort(
      (a, b) =>
        new Date(b.dateUnlocked).getTime() -
        new Date(a.dateUnlocked).getTime()
    )
    .slice(0, 10);

  return items;
};

// Process burned items
export const buildBurnedItems = (
  assignments: any[],
  subjectsById: Record<number, any>
): BurnedItem[] => {
  // Calculate date 30 days ago
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const items = assignments
    .filter(
      (a) => a.data.burned_at && new Date(a.data.burned_at) >= thirtyDaysAgo
    )
    .map((assignment): BurnedItem | null => {
      const subject = subjectsById[assignment.data.subject_id];
      if (!subject) return null;

      return {
        id: subject.id,
        characters: subject.data.characters,
        meaning: subject.data.meanings[0].meaning,
        source: subject,
        type: subject.object as WaniKaniItemType,
        dateBurned: assignment.data.burned_at,
      };
    })
    .filter((item): item is BurnedItem => item !== null)
    .sort(
      (a, b) =>
        new Date(b.dateBurned).getTime() - new Date(a.dateBurned).getTime()
    )
    .slice(0, 10);

  return items;
};

// Process critical items
export const buildCriticalItems = (
  reviewStats: any[],
  subjectsById: Record<number, any>
): CriticalItem[] => {
  const items = reviewStats
    .map((stat): CriticalItem | null => {
      const subject = subjectsById[stat.data.subject_id];
      if (!subject) return null;

      return {
        id: subject.id,
        characters: subject.data.characters,
        meaning: subject.data.meanings[0].meaning,
        source: subject,
        type: subject.object as WaniKaniItemType,
        percentage: stat.data.percentage_correct,
      };
    })
    .filter((item): item is CriticalItem => item !== null)
    .sort((a, b) => a.percentage - b.percentage)
    .slice(0, 10);

  return items;
};
