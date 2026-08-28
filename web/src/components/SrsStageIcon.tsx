export type SrsLevelName = "Apprentice" | "Guru" | "Master" | "Enlightened" | "Burned";

const STAGES = {
  1: { asset: "apprentice-1", label: "Apprentice I", viewBox: "0 0 390 512" },
  2: { asset: "apprentice-2", label: "Apprentice II", viewBox: "0 0 390 512" },
  3: { asset: "apprentice-3", label: "Apprentice III", viewBox: "0 0 390 512" },
  4: { asset: "apprentice-4", label: "Apprentice IV", viewBox: "0 0 390 512" },
  5: { asset: "guru-1", label: "Guru I", viewBox: "0 0 390 512" },
  6: { asset: "guru-2", label: "Guru II", viewBox: "0 0 390 512" },
  7: { asset: "master", label: "Master", viewBox: "0 0 420 512" },
  8: { asset: "enlightened", label: "Enlightened", viewBox: "0 0 455 512" },
  9: { asset: "burned", label: "Burned", viewBox: "0 0 492 512" },
} as const;

const GROUP_STAGE: Record<SrsLevelName, keyof typeof STAGES> = {
  Apprentice: 1,
  Guru: 5,
  Master: 7,
  Enlightened: 8,
  Burned: 9,
};

export function srsStageLabel(stage: number) {
  return STAGES[stage as keyof typeof STAGES]?.label ?? (stage === 0 ? "Lesson" : `SRS stage ${stage}`);
}

export function SrsStageIcon({ stage, level, size = 22, className, title }: { stage?: number; level?: string; size?: number; className?: string; title?: string }) {
  const normalizedLevel = level ? `${level[0]?.toUpperCase() ?? ""}${level.slice(1).toLowerCase()}` as SrsLevelName : undefined;
  const resolvedStage = normalizedLevel ? GROUP_STAGE[normalizedLevel] : stage;
  const metadata = resolvedStage ? STAGES[resolvedStage as keyof typeof STAGES] : undefined;
  if (!metadata) return null;
  const accessibleTitle = title ?? metadata.label;

  return (
    <svg className={className} width={size} height={size} viewBox={metadata.viewBox} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} focusable="false">
      {title ? <title>{accessibleTitle}</title> : null}
      <use href={`/srs/srs-icons.svg#${metadata.asset}`} />
    </svg>
  );
}
