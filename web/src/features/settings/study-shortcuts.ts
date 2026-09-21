export const DEFAULT_STUDY_SHORTCUTS = {
  progress: "Enter", replayAudio: "r", markCorrect: "2", markIncorrect: "1",
  details: "d", skip: "k", addSynonym: "s", hint: "h", alternatives: "a", undo: "u",
};
export type StudyShortcutAction = keyof typeof DEFAULT_STUDY_SHORTCUTS;
export type StudyShortcuts = Record<StudyShortcutAction, string>;
export const STUDY_SHORTCUT_LABELS: Record<StudyShortcutAction, string> = {
  progress: "Reveal / continue", replayAudio: "Replay audio", markCorrect: "Mark correct", markIncorrect: "Mark incorrect",
  details: "Toggle details", skip: "Skip item", addSynonym: "Add synonym", hint: "Bunpro hint", alternatives: "Bunpro alternate answers", undo: "Bunpro undo answer",
};
export function validShortcutKey(key: string) {
  return key.length === 1 || ["Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key);
}
export function normalizeStudyShortcuts(value: unknown): StudyShortcuts {
  const result = { ...DEFAULT_STUDY_SHORTCUTS };
  if (!value || typeof value !== "object") return result;
  for (const action of Object.keys(result) as StudyShortcutAction[]) {
    const key = (value as Record<string, unknown>)[action];
    if (typeof key === "string" && validShortcutKey(key)) result[action] = key.length === 1 ? key.toLowerCase() : key;
  }
  // Invalid imported maps must never make an action unreachable.
  if (new Set(Object.values(result)).size !== Object.keys(result).length) return { ...DEFAULT_STUDY_SHORTCUTS };
  return result;
}
export function shortcutLabel(key: string) { return key === " " ? "Space" : key.length === 1 ? key.toUpperCase() : key; }
export function studyShortcutAction(key: string, shortcuts: StudyShortcuts = DEFAULT_STUDY_SHORTCUTS): StudyShortcutAction | undefined {
  const normalized = key.length === 1 ? key.toLowerCase() : key;
  const match = (Object.keys(shortcuts) as StudyShortcutAction[]).find((action) => shortcuts[action] === normalized);
  if (match) return match;
  // Retain familiar aliases unless their action was customized.
  if (normalized === "c" && shortcuts.markCorrect === "2") return "markCorrect";
  if (normalized === "x" && shortcuts.markIncorrect === "1") return "markIncorrect";
  if (normalized === " " && shortcuts.replayAudio === "r") return "replayAudio";
}
