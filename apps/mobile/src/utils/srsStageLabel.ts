import { getSrsStageLabel } from "./srsBreakdownStages";

function normalizeSrsStage(stage: number | null | undefined): number {
  if (typeof stage !== "number" || !Number.isFinite(stage)) {
    return 0;
  }

  return Math.floor(stage);
}

export function getSrsStageDisplayLabel(
  stage: number | null | undefined
): string {
  const normalizedStage = normalizeSrsStage(stage);

  if (normalizedStage <= 0) {
    return "Not Started";
  }

  return getSrsStageLabel(Math.min(normalizedStage, 9));
}

export function formatLevelWithSrsStage(
  level: number | null | undefined,
  stage: number | null | undefined
): string {
  const normalizedLevel =
    typeof level === "number" && Number.isFinite(level)
      ? Math.max(1, Math.floor(level))
      : 1;

  return `Level ${normalizedLevel} • ${getSrsStageDisplayLabel(stage)}`;
}
