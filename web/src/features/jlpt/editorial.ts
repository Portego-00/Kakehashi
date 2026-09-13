import type { JlptQuestion, JlptQuestionProvenance } from "./types";

export type JlptEditorialCoverageStatus =
  | JlptQuestionProvenance["editorialStatus"]
  | "untracked";

export interface JlptEditorialCoverage {
  records: number;
  semanticItems: number;
  byStatus: Record<
    JlptEditorialCoverageStatus,
    { records: number; semanticItems: number }
  >;
  humanApprovedSemanticItems: number;
  mixedStatusSemanticItems: number;
  mixedVersionSemanticItems: number;
  releaseReady: boolean;
}

export interface JlptEditorialQueueItem {
  semanticKey: string;
  representativeQuestionId: string;
  renderedQuestionIds: string[];
  level: JlptQuestion["level"];
  officialType: JlptQuestion["officialType"];
  contentVersions: number[];
  statuses: JlptEditorialCoverageStatus[];
}

export function jlptQuestionSemanticKey(question: JlptQuestion) {
  return question.provenance?.semanticKey ?? question.id;
}

export function summarizeJlptEditorialCoverage(
  questions: readonly JlptQuestion[],
): JlptEditorialCoverage {
  const statuses: readonly JlptEditorialCoverageStatus[] = [
    "untracked",
    "machine-validated",
    "sampled-ai-review",
    "human-approved",
  ];
  const recordsByStatus = new Map(statuses.map((status) => [status, 0]));
  const semanticKeysByStatus = new Map(
    statuses.map((status) => [status, new Set<string>()]),
  );
  const questionsBySemanticKey = new Map<string, JlptQuestion[]>();

  for (const question of questions) {
    const key = jlptQuestionSemanticKey(question);
    const status = question.provenance?.editorialStatus ?? "untracked";
    questionsBySemanticKey.set(key, [
      ...(questionsBySemanticKey.get(key) ?? []),
      question,
    ]);
    recordsByStatus.set(status, (recordsByStatus.get(status) ?? 0) + 1);
    semanticKeysByStatus.get(status)?.add(key);
  }

  const byStatus = Object.fromEntries(
    statuses.map((status) => [
      status,
      {
        records: recordsByStatus.get(status) ?? 0,
        semanticItems: semanticKeysByStatus.get(status)?.size ?? 0,
      },
    ]),
  ) as JlptEditorialCoverage["byStatus"];
  let humanApprovedSemanticItems = 0;
  let mixedStatusSemanticItems = 0;
  let mixedVersionSemanticItems = 0;
  for (const variants of questionsBySemanticKey.values()) {
    const variantStatuses = new Set(
      variants.map(
        (question) => question.provenance?.editorialStatus ?? "untracked",
      ),
    );
    const contentVersions = new Set(
      variants.map((question) => question.provenance?.contentVersion ?? 0),
    );
    if (variantStatuses.size > 1) mixedStatusSemanticItems += 1;
    if (contentVersions.size > 1) mixedVersionSemanticItems += 1;
    if (
      variantStatuses.size === 1 &&
      variantStatuses.has("human-approved") &&
      contentVersions.size === 1 &&
      !contentVersions.has(0)
    )
      humanApprovedSemanticItems += 1;
  }

  return {
    records: questions.length,
    semanticItems: questionsBySemanticKey.size,
    byStatus,
    humanApprovedSemanticItems,
    mixedStatusSemanticItems,
    mixedVersionSemanticItems,
    releaseReady:
      questionsBySemanticKey.size > 0 &&
      humanApprovedSemanticItems === questionsBySemanticKey.size &&
      mixedStatusSemanticItems === 0 &&
      mixedVersionSemanticItems === 0,
  };
}

export function buildJlptEditorialReviewQueue(
  questions: readonly JlptQuestion[],
): JlptEditorialQueueItem[] {
  const grouped = new Map<string, JlptQuestion[]>();
  for (const question of questions) {
    const key = jlptQuestionSemanticKey(question);
    grouped.set(key, [...(grouped.get(key) ?? []), question]);
  }
  return [...grouped.entries()]
    .map(([semanticKey, variants]) => ({
      semanticKey,
      representativeQuestionId: variants[0].id,
      renderedQuestionIds: variants.map((question) => question.id),
      level: variants[0].level,
      officialType: variants[0].officialType,
      contentVersions: [
        ...new Set(
          variants.map((question) => question.provenance?.contentVersion ?? 0),
        ),
      ].toSorted((left, right) => left - right),
      statuses: [
        ...new Set(
          variants.map(
            (question) => question.provenance?.editorialStatus ?? "untracked",
          ),
        ),
      ].toSorted(),
    }))
    .toSorted(
      (left, right) =>
        left.level.localeCompare(right.level) ||
        left.officialType.localeCompare(right.officialType) ||
        left.semanticKey.localeCompare(right.semanticKey),
    );
}
