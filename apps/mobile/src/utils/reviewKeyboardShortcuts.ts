export interface ReviewIncorrectKeyboardShortcutSettings {
  markIncorrect: string;
  markCorrect: string;
  askAgain: string;
  addSynonym: string;
  openDetails: string;
  replayAudio: string;
}

export interface ReviewCorrectKeyboardShortcutSettings {
  advanceOnCorrect: string;
  replayAudio: string;
}

// Legacy combined shape kept for compatibility with older persisted settings.
export interface ReviewKeyboardShortcutSettings
  extends ReviewIncorrectKeyboardShortcutSettings,
    ReviewCorrectKeyboardShortcutSettings {}

export const DEFAULT_REVIEW_INCORRECT_KEYBOARD_SHORTCUTS: ReviewIncorrectKeyboardShortcutSettings =
  {
    markIncorrect: "X",
    markCorrect: "C",
    askAgain: "A",
    addSynonym: "S",
    openDetails: "D",
    replayAudio: "R",
  };

export const DEFAULT_REVIEW_CORRECT_KEYBOARD_SHORTCUTS: ReviewCorrectKeyboardShortcutSettings =
  {
    advanceOnCorrect: "Space",
    replayAudio: "R",
  };

export const DEFAULT_REVIEW_KEYBOARD_SHORTCUTS: ReviewKeyboardShortcutSettings = {
  ...DEFAULT_REVIEW_INCORRECT_KEYBOARD_SHORTCUTS,
  ...DEFAULT_REVIEW_CORRECT_KEYBOARD_SHORTCUTS,
};

const NORMALIZED_KEY_ALIASES: Record<string, string> = {
  " ": "space",
  space: "space",
  spacebar: "space",
  enter: "enter",
  return: "enter",
  tab: "tab",
  esc: "escape",
  escape: "escape",
};

const DISPLAY_LABEL_BY_NORMALIZED_KEY: Record<string, string> = {
  space: "Space",
  enter: "Enter",
  tab: "Tab",
  escape: "Escape",
};

export const normalizeReviewShortcutKey = (
  value: string | null | undefined,
): string => {
  const rawValue = value ?? "";
  if (!rawValue) {
    return "";
  }

  if (rawValue === " " || rawValue === "\u00A0") {
    return "space";
  }

  if (rawValue === "\n" || rawValue === "\r" || rawValue === "\r\n") {
    return "enter";
  }

  if (rawValue === "\t") {
    return "tab";
  }

  const trimmedValue = rawValue.trim();
  if (!trimmedValue) {
    return "";
  }

  const loweredValue = trimmedValue.toLowerCase();
  if (NORMALIZED_KEY_ALIASES[loweredValue]) {
    return NORMALIZED_KEY_ALIASES[loweredValue];
  }

  if (trimmedValue.length === 1) {
    return trimmedValue.toLowerCase();
  }

  return loweredValue;
};

export const doesReviewShortcutMatchKey = (
  key: string | null | undefined,
  shortcut: string | null | undefined,
): boolean => {
  const normalizedKey = normalizeReviewShortcutKey(key);
  const normalizedShortcut = normalizeReviewShortcutKey(shortcut);

  if (!normalizedKey || !normalizedShortcut) {
    return false;
  }

  return normalizedKey === normalizedShortcut;
};

export const sanitizeReviewShortcutInput = (
  value: string | null | undefined,
): string => {
  const normalizedRawKey = normalizeReviewShortcutKey(value);
  if (DISPLAY_LABEL_BY_NORMALIZED_KEY[normalizedRawKey]) {
    return DISPLAY_LABEL_BY_NORMALIZED_KEY[normalizedRawKey];
  }

  const trimmedValue = (value ?? "").trim();
  if (!trimmedValue) {
    return "";
  }

  if (trimmedValue.length === 1) {
    return trimmedValue.toUpperCase();
  }

  const normalizedKey = normalizeReviewShortcutKey(trimmedValue);
  if (DISPLAY_LABEL_BY_NORMALIZED_KEY[normalizedKey]) {
    return DISPLAY_LABEL_BY_NORMALIZED_KEY[normalizedKey];
  }

  return trimmedValue.slice(0, 20);
};

export const formatReviewShortcutLabel = (
  value: string | null | undefined,
): string => {
  const normalizedKey = normalizeReviewShortcutKey(value);
  if (!normalizedKey) {
    return "Off";
  }

  if (DISPLAY_LABEL_BY_NORMALIZED_KEY[normalizedKey]) {
    return DISPLAY_LABEL_BY_NORMALIZED_KEY[normalizedKey];
  }

  if (normalizedKey.length === 1) {
    return normalizedKey.toUpperCase();
  }

  return normalizedKey;
};

export const resolveReviewKeyboardShortcuts = (
  shortcuts: Partial<ReviewKeyboardShortcutSettings> | null | undefined,
): ReviewKeyboardShortcutSettings => {
  return {
    ...DEFAULT_REVIEW_KEYBOARD_SHORTCUTS,
    ...(shortcuts ?? {}),
  };
};

export const resolveReviewIncorrectKeyboardShortcuts = (
  shortcuts:
    | Partial<ReviewIncorrectKeyboardShortcutSettings>
    | null
    | undefined,
): ReviewIncorrectKeyboardShortcutSettings => {
  return {
    ...DEFAULT_REVIEW_INCORRECT_KEYBOARD_SHORTCUTS,
    ...(shortcuts ?? {}),
  };
};

export const resolveReviewCorrectKeyboardShortcuts = (
  shortcuts:
    | Partial<ReviewCorrectKeyboardShortcutSettings>
    | null
    | undefined,
): ReviewCorrectKeyboardShortcutSettings => {
  return {
    ...DEFAULT_REVIEW_CORRECT_KEYBOARD_SHORTCUTS,
    ...(shortcuts ?? {}),
  };
};
