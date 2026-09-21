import type { Subject } from "@/types/wanikani";
import { srsStageLabel } from "@/components/SrsStageIcon";
import { resultMistakes, type ReviewResultItem } from "@/features/core-study/review-results";

export type SessionResult = {
  id: string;
  source: "bunpro" | "wanikani";
  kind: string;
  title: string;
  meaning: string;
  correct: boolean;
  href?: string;
  subject?: Subject;
  reading?: string;
  sentence?: { before: string; answer: string; after: string };
  translation?: string;
  audioUrls?: string[];
  stage?: string;
  previousStage?: string;
};
export type SessionResultsData = { items: SessionResult[]; durationMs: number; pendingCount: number; error?: string };
export function wanikaniSessionResults(items: ReviewResultItem[]): SessionResult[] {
  return items.map(item => ({
    id: `wanikani:${item.assignmentId}`, source: "wanikani", kind: item.subject.object.replace("_", " "),
    title: item.subject.data.characters || item.subject.data.slug,
    meaning: item.subject.data.meanings.find(meaning => meaning.primary)?.meaning ?? item.subject.data.meanings[0]?.meaning ?? "",
    reading: item.subject.data.readings?.filter(reading => reading.primary).map(reading => reading.reading).join("・"),
    correct: resultMistakes(item) === 0, href: `/subjects/${item.subject.id}`, subject: item.subject,
    stage: item.endingStage === undefined ? undefined : srsStageLabel(item.endingStage),
  }));
}
