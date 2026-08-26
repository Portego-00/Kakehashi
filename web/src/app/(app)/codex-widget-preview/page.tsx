import { IncompleteLevelsWidget } from "@/features/dashboard/DashboardDataWidgets";
import type { IncompleteLevelRow } from "@/features/dashboard/dashboard-data";
import { SubjectListsWidget } from "@/features/dashboard/SubjectListsWidget";
import type { SubjectList } from "@/features/subjects/lists";
import type { Subject } from "@/types/wanikani";

const lists: SubjectList[] = [{
  id: "preview-list",
  name: "Teddy later",
  subjectIds: Array.from({ length: 25 }, (_, index) => index + 1),
  createdAt: "2026-08-26T00:00:00.000Z",
  updatedAt: "2026-08-26T00:00:00.000Z",
}];

const subjects = ["飲酒", "細かい", "禁句", "果たして"].map((characters, index) => ({
  id: index + 1,
  object: "vocabulary",
  data: { characters, meanings: [] },
})) as Subject[];

const levels: IncompleteLevelRow[] = [20, 12, 4].map((level, index) => ({
  level,
  passed: 60 - index * 15,
  total: 100,
  radical: { passed: 6 - index, total: 10 },
  kanji: { passed: 18 - index * 3, total: 30 },
  vocabulary: { passed: 36 - index * 11, total: 60 },
}));

export default function WidgetPreviewPage() {
  return <main style={{ display: "grid", gap: "1rem", padding: "1rem" }}>
    <div data-preview-widget="subject-lists" style={{ height: "26rem", maxWidth: "44rem" }}>
      <SubjectListsWidget lists={lists} subjects={subjects} syncing={false} syncError="" />
    </div>
    <div data-preview-widget="incomplete-levels" style={{ maxWidth: "72rem" }}>
      <IncompleteLevelsWidget levels={levels} />
    </div>
  </main>;
}
