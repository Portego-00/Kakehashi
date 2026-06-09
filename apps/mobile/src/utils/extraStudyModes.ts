import { type Ionicons } from "@expo/vector-icons";
import { EXTRA_STUDY_SESSION_STORAGE_KEYS } from "./extraStudySessionPersistence";

export type ExtraStudyModeId =
  | "recent-lessons"
  | "random-test"
  | "reading-test"
  | "hiragana-vocab-meaning"
  | "kana-kanji-test"
  | "listening-practice"
  | "context-sentence-practice"
  | "writing-practice"
  | "crossword"
  | "wordle"
  | "custom-review"
  | "custom-lessons"
  | "subject-lists"
  | "asr-reading-debug";

export type ExtraStudyModeDefinition = {
  id: ExtraStudyModeId;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconText?: string;
  route: string;
  hiddenByDefault?: boolean;
  requiresUsername?: string;
};

export const EXTRA_STUDY_MODE_DEFINITIONS: ExtraStudyModeDefinition[] = [
  {
    id: "recent-lessons",
    title: "Recent Lessons",
    subtitle: "Practice your recently unlocked items",
    icon: "time",
    route: "/recent-lessons-review",
  },
  {
    id: "random-test",
    title: "Random Test",
    subtitle: "Test yourself on any learned items",
    icon: "dice",
    route: "/test-config",
  },
  {
    id: "reading-test",
    title: "Vocab Reading",
    subtitle: "English to Kana reading practice",
    icon: "language",
    route: "/meaning-reading-config",
  },
  {
    id: "hiragana-vocab-meaning",
    title: "Hiragana Vocab",
    subtitle: "Read hiragana prompts and answer in English",
    icon: "text",
    iconText: "あ",
    route: "/hiragana-vocab-meaning-config",
  },
  {
    id: "kana-kanji-test",
    title: "Kana to Kanji",
    subtitle: "Read kana prompts and answer in kanji",
    icon: "swap-horizontal",
    route: "/kana-kanji-config",
  },
  {
    id: "listening-practice",
    title: "Listening Practice",
    subtitle: "Learn from anime context with audio",
    icon: "headset",
    route: "/listening-practice-config",
  },
  {
    id: "context-sentence-practice",
    title: "Context Sentences",
    subtitle: "Fill the missing vocab from sentence context",
    icon: "chatbubble-ellipses",
    route: "/context-sentence-practice-config",
  },
  {
    id: "writing-practice",
    title: "Kanji Writing",
    subtitle: "Practice stroke order by drawing",
    icon: "brush",
    route: "/writing-practice-config",
  },
  {
    id: "crossword",
    title: "Crossword",
    subtitle: "Solve a hiragana crossword from English clues",
    icon: "grid",
    route: "/crossword-config",
  },
  {
    id: "wordle",
    title: "Kana Wordle",
    subtitle: "Guess the target reading in limited tries",
    icon: "game-controller",
    route: "/wordle-config",
    requiresUsername: "Portego",
  },
  {
    id: "custom-review",
    title: "Custom Review",
    subtitle: "Study specific items of your choice",
    icon: "options",
    route: "/custom-review-selection",
  },
  {
    id: "custom-lessons",
    title: "Custom Lessons",
    subtitle: "Learn specific items of your choice",
    icon: "book",
    route: "/custom-lesson-selection",
  },
  {
    id: "subject-lists",
    title: "Subject Lists",
    subtitle: "Manage saved collections for custom study",
    icon: "list",
    route: "/subject-lists",
  },
  {
    id: "asr-reading-debug",
    title: "ASR Reading Debug",
    subtitle: "Inspect Japanese ASR alternatives",
    icon: "mic",
    route: "/asr-reading-debug",
    hiddenByDefault: true,
    requiresUsername: "Portego",
  },
];

export const DEFAULT_HOME_EXTRA_STUDY_MODE_ORDER: ExtraStudyModeId[] =
  EXTRA_STUDY_MODE_DEFINITIONS.filter((mode) => !mode.hiddenByDefault).map(
    (mode) => mode.id,
  );

export const RESUMABLE_EXTRA_STUDY_MODE_SESSION_KEYS: Partial<
  Record<ExtraStudyModeId, string>
> = {
  "random-test": EXTRA_STUDY_SESSION_STORAGE_KEYS.RANDOM_TEST,
  "reading-test": EXTRA_STUDY_SESSION_STORAGE_KEYS.MEANING_READING,
  "hiragana-vocab-meaning":
    EXTRA_STUDY_SESSION_STORAGE_KEYS.HIRAGANA_VOCAB_MEANING,
  "kana-kanji-test": EXTRA_STUDY_SESSION_STORAGE_KEYS.KANA_KANJI,
  "listening-practice": EXTRA_STUDY_SESSION_STORAGE_KEYS.LISTENING_PRACTICE,
  "context-sentence-practice":
    EXTRA_STUDY_SESSION_STORAGE_KEYS.CONTEXT_SENTENCE_PRACTICE,
  "writing-practice": EXTRA_STUDY_SESSION_STORAGE_KEYS.WRITING_PRACTICE,
  crossword: EXTRA_STUDY_SESSION_STORAGE_KEYS.CROSSWORD,
  wordle: EXTRA_STUDY_SESSION_STORAGE_KEYS.WORDLE,
  "custom-review": EXTRA_STUDY_SESSION_STORAGE_KEYS.CUSTOM_REVIEW,
};

export const RESUMABLE_EXTRA_STUDY_MODE_SESSION_ENTRIES = Object.entries(
  RESUMABLE_EXTRA_STUDY_MODE_SESSION_KEYS,
) as [ExtraStudyModeId, string][];

const VALID_EXTRA_STUDY_MODE_IDS = new Set<ExtraStudyModeId>(
  EXTRA_STUDY_MODE_DEFINITIONS.map((mode) => mode.id),
);

function normalizeModeIdList(
  value: unknown,
  allowedModeIds: Set<ExtraStudyModeId>,
): ExtraStudyModeId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique: ExtraStudyModeId[] = [];

  value.forEach((entry) => {
    if (!isExtraStudyModeId(entry)) {
      return;
    }

    if (!allowedModeIds.has(entry)) {
      return;
    }

    if (!unique.includes(entry)) {
      unique.push(entry);
    }
  });

  return unique;
}

export function isExtraStudyModeId(value: unknown): value is ExtraStudyModeId {
  return (
    typeof value === "string" &&
    VALID_EXTRA_STUDY_MODE_IDS.has(value as ExtraStudyModeId)
  );
}

export function getAvailableExtraStudyModes(
  username?: string | null,
): ExtraStudyModeDefinition[] {
  const normalizedUsername = username?.trim().toLowerCase() ?? "";

  return EXTRA_STUDY_MODE_DEFINITIONS.filter((mode) => {
    if (!mode.requiresUsername) {
      return true;
    }

    return mode.requiresUsername.trim().toLowerCase() === normalizedUsername;
  });
}

export function normalizeHomeExtraStudyHiddenModeIds(
  value: unknown,
): ExtraStudyModeId[] {
  return normalizeModeIdList(value, VALID_EXTRA_STUDY_MODE_IDS);
}

export function normalizeHomeExtraStudyModeOrder(
  value: unknown,
  availableModes: ExtraStudyModeDefinition[],
  hiddenModeIds: unknown = [],
): ExtraStudyModeId[] {
  const availableModeIds = availableModes.map((mode) => mode.id);
  const allowed = new Set<ExtraStudyModeId>(availableModeIds);
  const hiddenModeIdSet = new Set(
    normalizeModeIdList(hiddenModeIds, allowed),
  );
  const defaultVisibleModes = availableModes
    .filter((mode) => !mode.hiddenByDefault && !hiddenModeIdSet.has(mode.id))
    .map((mode) => mode.id);

  const unique = normalizeModeIdList(value, allowed).filter(
    (modeId) => !hiddenModeIdSet.has(modeId),
  );

  defaultVisibleModes.forEach((modeId) => {
    if (!unique.includes(modeId)) {
      unique.push(modeId);
    }
  });

  return unique;
}
