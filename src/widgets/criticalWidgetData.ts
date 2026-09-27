import type { WaniKaniItemType } from "../types/wanikani";

export type CriticalWidgetItem = {
  characters: string | null;
  meaning: string;
  percentage: number;
  reading?: string;
  type?: WaniKaniItemType;
};

type ReviewStatistic = {
  data: { subject_id: number; percentage_correct: number; hidden?: boolean };
};

type Subject = {
  id: number;
  object: WaniKaniItemType;
  data: {
    characters: string | null;
    hidden_at?: string | null;
    meanings: { meaning: string; primary: boolean }[];
    readings?: { reading: string; primary: boolean }[];
  };
};

// Start at the Critical Items screen's default threshold, widening only when
// no displayable items qualify. Never include items at or above 90% accuracy.
export function buildCriticalWidgetSnapshot(
  statistics: ReviewStatistic[],
  subjects: Subject[],
) {
  const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));
  const items: CriticalWidgetItem[] = [];
  for (const { data } of statistics) {
    const subject = subjectsById.get(data.subject_id);
    if (
      !subject || data.hidden || subject.data.hidden_at ||
      !Number.isFinite(data.percentage_correct) ||
      data.percentage_correct < 0 || data.percentage_correct >= 90
    ) {
      continue;
    }
    items.push({
      characters: subject.data.characters,
      meaning: (subject.data.meanings.find((meaning) => meaning.primary) ??
        subject.data.meanings[0])?.meaning ?? "Unknown meaning",
      reading: (subject.data.readings?.find((reading) => reading.primary) ??
        subject.data.readings?.[0])?.reading ?? "",
      type: subject.object,
      percentage: data.percentage_correct,
    });
  }
  items.sort((a, b) => a.percentage - b.percentage);
  const threshold = [75, 80, 85, 90].find(
    (limit) => items.some((item) => item.percentage < limit),
  ) ?? 90;
  const selectedItems = items.filter((item) => item.percentage < threshold);
  return {
    criticalCount: selectedItems.length,
    criticalItems: selectedItems.slice(0, 3),
    topCriticalItem: selectedItems[0] ?? null,
  };
}
