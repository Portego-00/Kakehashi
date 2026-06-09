import { SRS_COLORS } from "../constants/srsColors";
import type { SrsLevel } from "../types/wanikani";

export const ACTIVE_SRS_STAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const GROUPED_ACTIVE_SRS_STAGES = [1, 5, 7, 8, 9] as const;
export const ALL_SRS_STAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export type SrsStageGroup =
  | "Apprentice"
  | "Guru"
  | "Master"
  | "Enlightened"
  | "Burned";

export type SrsSubjectType = "radical" | "kanji" | "vocabulary";

export type SrsStageBreakdown = {
  stage: number;
  roman: string;
  label: string;
  shortLabel: string;
  group: SrsStageGroup;
  color: string;
  breakdown: Record<SrsSubjectType, number>;
  total: number;
};

type AssignmentLike = {
  data?: {
    srs_stage?: number;
    subject_id?: number;
    subject_type?: string;
    started_at?: string | null;
  };
} | null;

type SubjectLike = {
  id?: number;
  object?: string;
} | null;

type StageMeta = {
  stage: number;
  roman: string;
  label: string;
  shortLabel: string;
  group: SrsStageGroup;
  color: string;
};

const SRS_STAGE_META: StageMeta[] = [
  {
    stage: 1,
    roman: "I",
    label: "Apprentice I",
    shortLabel: "Appr I",
    group: "Apprentice",
    color: SRS_COLORS.apprentice.hex,
  },
  {
    stage: 2,
    roman: "II",
    label: "Apprentice II",
    shortLabel: "Appr II",
    group: "Apprentice",
    color: SRS_COLORS.apprentice.hex,
  },
  {
    stage: 3,
    roman: "III",
    label: "Apprentice III",
    shortLabel: "Appr III",
    group: "Apprentice",
    color: SRS_COLORS.apprentice.hex,
  },
  {
    stage: 4,
    roman: "IV",
    label: "Apprentice IV",
    shortLabel: "Appr IV",
    group: "Apprentice",
    color: SRS_COLORS.apprentice.hex,
  },
  {
    stage: 5,
    roman: "V",
    label: "Guru I",
    shortLabel: "Guru I",
    group: "Guru",
    color: SRS_COLORS.guru.hex,
  },
  {
    stage: 6,
    roman: "VI",
    label: "Guru II",
    shortLabel: "Guru II",
    group: "Guru",
    color: SRS_COLORS.guru.hex,
  },
  {
    stage: 7,
    roman: "VII",
    label: "Master",
    shortLabel: "Master",
    group: "Master",
    color: SRS_COLORS.master.hex,
  },
  {
    stage: 8,
    roman: "VIII",
    label: "Enlightened",
    shortLabel: "Enlight.",
    group: "Enlightened",
    color: SRS_COLORS.enlightened.hex,
  },
  {
    stage: 9,
    roman: "IX",
    label: "Burned",
    shortLabel: "Burned",
    group: "Burned",
    color: SRS_COLORS.burned.hex,
  },
];

const GROUPED_SRS_STAGE_META: StageMeta[] = [
  {
    stage: 1,
    roman: "I",
    label: "Apprentice",
    shortLabel: "Apprentice",
    group: "Apprentice",
    color: SRS_COLORS.apprentice.hex,
  },
  {
    stage: 5,
    roman: "V",
    label: "Guru",
    shortLabel: "Guru",
    group: "Guru",
    color: SRS_COLORS.guru.hex,
  },
  {
    stage: 7,
    roman: "VII",
    label: "Master",
    shortLabel: "Master",
    group: "Master",
    color: SRS_COLORS.master.hex,
  },
  {
    stage: 8,
    roman: "VIII",
    label: "Enlightened",
    shortLabel: "Enlight.",
    group: "Enlightened",
    color: SRS_COLORS.enlightened.hex,
  },
  {
    stage: 9,
    roman: "IX",
    label: "Burned",
    shortLabel: "Burned",
    group: "Burned",
    color: SRS_COLORS.burned.hex,
  },
];

const GROUPED_STAGE_MEMBERS: Record<number, number[]> = {
  1: [1, 2, 3, 4],
  5: [5, 6],
  7: [7],
  8: [8],
  9: [9],
};

function createEmptyBreakdown(): Record<SrsSubjectType, number> {
  return {
    radical: 0,
    kanji: 0,
    vocabulary: 0,
  };
}

function createSeedBreakdown(): SrsStageBreakdown[] {
  return SRS_STAGE_META.map((meta) => ({
    stage: meta.stage,
    roman: meta.roman,
    label: meta.label,
    shortLabel: meta.shortLabel,
    group: meta.group,
    color: meta.color,
    breakdown: createEmptyBreakdown(),
    total: 0,
  }));
}

function getSubjectType(objectValue: string | undefined): SrsSubjectType | null {
  const normalized = (objectValue || "").toLowerCase().replace(/[-\s]/g, "_");

  if (normalized === "radical") {
    return "radical";
  }

  if (normalized === "kanji") {
    return "kanji";
  }

  if (normalized === "vocabulary" || normalized === "kana_vocabulary") {
    return "vocabulary";
  }

  return null;
}

export function mapStageToSrsGroupName(stage: number): SrsStageGroup {
  if (stage >= 1 && stage <= 4) {
    return "Apprentice";
  }
  if (stage >= 5 && stage <= 6) {
    return "Guru";
  }
  if (stage === 7) {
    return "Master";
  }
  if (stage === 8) {
    return "Enlightened";
  }
  return "Burned";
}

export function mapStageToSrsGroupStage(stage: number): number {
  if (stage >= 1 && stage <= 4) {
    return 1;
  }
  if (stage >= 5 && stage <= 6) {
    return 5;
  }
  if (stage === 7) {
    return 7;
  }
  if (stage === 8) {
    return 8;
  }
  return 9;
}

export function getSrsStageLabel(stage: number): string {
  const found = SRS_STAGE_META.find((meta) => meta.stage === stage);
  return found?.label ?? `Stage ${stage}`;
}

export function getSrsStageRoman(stage: number): string {
  const found = SRS_STAGE_META.find((meta) => meta.stage === stage);
  return found?.roman ?? String(stage);
}

export function buildSrsStageBreakdown(
  assignments: AssignmentLike[] | null | undefined,
  subjects: SubjectLike[] | null | undefined
): SrsStageBreakdown[] {
  const seeded = createSeedBreakdown();

  if (!assignments || !subjects || assignments.length === 0 || subjects.length === 0) {
    return seeded;
  }

  const subjectTypeById = new Map<number, SrsSubjectType>();
  subjects.forEach((subject) => {
    if (!subject || typeof subject.id !== "number") {
      return;
    }

    const subjectType = getSubjectType(subject.object);
    if (!subjectType) {
      return;
    }

    subjectTypeById.set(subject.id, subjectType);
  });

  assignments.forEach((assignment) => {
    const stage = assignment?.data?.srs_stage;
    const subjectId = assignment?.data?.subject_id;
    const startedAt = assignment?.data?.started_at;

    if (!startedAt || typeof stage !== "number" || typeof subjectId !== "number") {
      return;
    }

    if (stage < 1 || stage > 9) {
      return;
    }

    const subjectType =
      subjectTypeById.get(subjectId) ?? getSubjectType(assignment?.data?.subject_type);
    if (!subjectType) {
      return;
    }

    const index = stage - 1;
    seeded[index].breakdown[subjectType] += 1;
    seeded[index].total += 1;
  });

  return seeded;
}

export function buildSrsStageBreakdownFromLevels(
  levels: SrsLevel[] | null | undefined
): SrsStageBreakdown[] {
  const seeded = createSeedBreakdown();
  if (!levels || levels.length === 0) {
    return seeded;
  }

  const stageByGroup: Record<SrsStageGroup, number> = {
    Apprentice: 1,
    Guru: 5,
    Master: 7,
    Enlightened: 8,
    Burned: 9,
  };

  levels.forEach((level) => {
    const groupName = (level.name || "") as SrsStageGroup;
    const stage = stageByGroup[groupName];

    if (!stage) {
      return;
    }

    const entry = seeded[stage - 1];
    entry.breakdown.radical = level.breakdown.radical;
    entry.breakdown.kanji = level.breakdown.kanji;
    entry.breakdown.vocabulary = level.breakdown.vocabulary;
    entry.total = level.count;
  });

  return seeded;
}

export function groupSrsStageBreakdown(
  stages: SrsStageBreakdown[]
): SrsStageBreakdown[] {
  const byStage = new Map<number, SrsStageBreakdown>();
  stages.forEach((stage) => {
    byStage.set(stage.stage, stage);
  });

  return GROUPED_SRS_STAGE_META.map((meta) => {
    const sourceStages = GROUPED_STAGE_MEMBERS[meta.stage] ?? [meta.stage];
    const breakdown = createEmptyBreakdown();
    let total = 0;

    sourceStages.forEach((stageNumber) => {
      const source = byStage.get(stageNumber);
      if (!source) {
        return;
      }

      breakdown.radical += source.breakdown.radical;
      breakdown.kanji += source.breakdown.kanji;
      breakdown.vocabulary += source.breakdown.vocabulary;
      total += source.total;
    });

    return {
      stage: meta.stage,
      roman: meta.roman,
      label: meta.label,
      shortLabel: meta.shortLabel,
      group: meta.group,
      color: meta.color,
      breakdown,
      total,
    };
  });
}

export function findGroupLevelForStage(
  levels: SrsLevel[],
  stage: number
): SrsLevel | undefined {
  const groupName = mapStageToSrsGroupName(stage);
  return levels.find((level) => level.name === groupName);
}
