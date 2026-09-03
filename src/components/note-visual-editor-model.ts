import type { NoteFormat } from "../utils/note-formatting";
import type {
  NoteVisualEditorRun,
  NoteVisualEditorSelection,
  NoteVisualEditorSubjectType,
  NoteVisualEditorSubjectTypes,
} from "./note-visual-editor-types";

export const NOTE_VISUAL_EDITOR_FORMATS: readonly NoteFormat[] = [
  "bold",
  "italic",
  "underline",
];

const NOTE_VISUAL_EDITOR_SUBJECT_TYPES: readonly NoteVisualEditorSubjectType[] =
  ["radical", "kanji", "vocabulary", "kana_vocabulary"];

export function isNoteVisualEditorFormat(value: unknown): value is NoteFormat {
  return NOTE_VISUAL_EDITOR_FORMATS.some((format) => format === value);
}

export function isNoteVisualEditorSubjectType(
  value: unknown,
): value is NoteVisualEditorSubjectType {
  return NOTE_VISUAL_EDITOR_SUBJECT_TYPES.some(
    (subjectType) => subjectType === value,
  );
}

function normalizeFormats(value: unknown): NoteFormat[] {
  if (!Array.isArray(value)) return [];

  const selectedFormats = new Set(value.filter(isNoteVisualEditorFormat));
  return NOTE_VISUAL_EDITOR_FORMATS.filter((format) =>
    selectedFormats.has(format),
  );
}

function normalizeSubjectId(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) > 0
    ? Number(value)
    : undefined;
}

function appendRun(
  runs: NoteVisualEditorRun[],
  text: string,
  formats: NoteFormat[],
  subjectId?: number,
) {
  if (!text) return;

  const previous = runs[runs.length - 1];
  if (
    previous &&
    previous.subjectId === subjectId &&
    previous.formats.length === formats.length &&
    previous.formats.every((format, index) => format === formats[index])
  ) {
    previous.text += text;
    return;
  }

  runs.push({
    text,
    formats: [...formats],
    ...(subjectId ? { subjectId } : {}),
  });
}

/** Removes invalid fields and merges adjacent runs with identical attributes. */
export function normalizeNoteVisualEditorRuns(
  value: unknown,
): NoteVisualEditorRun[] {
  if (!Array.isArray(value)) return [];

  const normalizedRuns: NoteVisualEditorRun[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;

    const run = candidate as {
      text?: unknown;
      formats?: unknown;
      subjectId?: unknown;
    };
    if (typeof run.text !== "string" || !run.text) continue;

    appendRun(
      normalizedRuns,
      run.text,
      normalizeFormats(run.formats),
      normalizeSubjectId(run.subjectId),
    );
  }

  return normalizedRuns;
}

export function truncateNoteVisualEditorRuns(
  value: unknown,
  maxLength: number | undefined,
): NoteVisualEditorRun[] {
  const runs = normalizeNoteVisualEditorRuns(value);
  if (maxLength === undefined || !Number.isFinite(maxLength) || maxLength < 0) {
    return runs;
  }

  let remaining = Math.floor(maxLength);
  const truncatedRuns: NoteVisualEditorRun[] = [];
  for (const run of runs) {
    if (remaining <= 0) break;
    const text = run.text.slice(0, remaining);
    if (text) truncatedRuns.push({ ...run, text });
    remaining -= text.length;
  }
  return normalizeNoteVisualEditorRuns(truncatedRuns);
}

export function normalizeNoteVisualEditorSubjectTypes(
  value: unknown,
): NoteVisualEditorSubjectTypes {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const normalizedTypes: NoteVisualEditorSubjectTypes = {};
  for (const [subjectId, subjectType] of Object.entries(value)) {
    const numericSubjectId = Number(subjectId);
    if (
      !Number.isInteger(numericSubjectId) ||
      numericSubjectId <= 0 ||
      !isNoteVisualEditorSubjectType(subjectType)
    ) {
      continue;
    }

    normalizedTypes[String(numericSubjectId)] = subjectType;
  }

  return normalizedTypes;
}

export function getNoteVisualEditorText(
  runs: readonly NoteVisualEditorRun[],
): string {
  return runs.map((run) => run.text).join("");
}

export function getNoteVisualEditorRunsSignature(
  runs: readonly NoteVisualEditorRun[],
): string {
  return JSON.stringify(normalizeNoteVisualEditorRuns(runs));
}

function intersectFormats(runs: readonly NoteVisualEditorRun[]): NoteFormat[] {
  const [first, ...rest] = runs;
  if (!first) return [];

  return first.formats.filter((format) =>
    rest.every((run) => run.formats.includes(format)),
  );
}

/**
 * Describes a selection using visible UTF-16 offsets, matching browser and
 * React Native selection offsets. An entirely linked selection reports the
 * whole link label so a picker can be prefilled from a caret inside the link.
 */
export function describeNoteVisualEditorSelection(
  value: unknown,
  rawStart: number,
  rawEnd: number,
  collapsedFormats: readonly NoteFormat[] = [],
  collapsedSubjectId?: number,
): NoteVisualEditorSelection {
  const runs = normalizeNoteVisualEditorRuns(value);
  const text = getNoteVisualEditorText(runs);
  const start = Math.max(0, Math.min(rawStart, text.length));
  const end = Math.max(start, Math.min(rawEnd, text.length));

  if (start === end) {
    const subjectId = normalizeSubjectId(collapsedSubjectId);
    if (!subjectId) {
      return {
        text: "",
        formats: normalizeFormats(collapsedFormats),
      };
    }

    let cursor = 0;
    let containingRunIndex = -1;
    for (let index = 0; index < runs.length; index += 1) {
      const run = runs[index];
      const runStart = cursor;
      const runEnd = cursor + run.text.length;
      const containsCaret = start >= runStart && start <= runEnd;
      if (run.subjectId === subjectId && containsCaret) {
        containingRunIndex = index;
        break;
      }
      cursor = runEnd;
    }

    let linkText = "";
    if (containingRunIndex >= 0) {
      let linkStartIndex = containingRunIndex;
      let linkEndIndex = containingRunIndex;
      while (
        linkStartIndex > 0 &&
        runs[linkStartIndex - 1].subjectId === subjectId
      ) {
        linkStartIndex -= 1;
      }
      while (
        linkEndIndex + 1 < runs.length &&
        runs[linkEndIndex + 1].subjectId === subjectId
      ) {
        linkEndIndex += 1;
      }
      linkText = runs
        .slice(linkStartIndex, linkEndIndex + 1)
        .map((run) => run.text)
        .join("");
    }

    return {
      text: linkText,
      formats: normalizeFormats(collapsedFormats),
      ...(linkText ? { subjectId } : {}),
    };
  }

  const selectedRuns: NoteVisualEditorRun[] = [];
  let cursor = 0;
  for (const run of runs) {
    const runStart = cursor;
    const runEnd = cursor + run.text.length;
    const overlapStart = Math.max(start, runStart);
    const overlapEnd = Math.min(end, runEnd);
    if (overlapStart < overlapEnd) {
      selectedRuns.push({
        ...run,
        text: run.text.slice(overlapStart - runStart, overlapEnd - runStart),
      });
    }
    cursor = runEnd;
  }

  const linkedSubjectIds = new Set(
    selectedRuns.map((run) => run.subjectId).filter(Boolean),
  );
  const everyRunIsLinked = selectedRuns.every((run) => Boolean(run.subjectId));
  const subjectId =
    everyRunIsLinked && linkedSubjectIds.size === 1
      ? selectedRuns[0]?.subjectId
      : undefined;

  let selectionText = text.slice(start, end);
  if (subjectId) {
    let selectedRunCursor = 0;
    let sourceRunIndex = 0;
    while (sourceRunIndex < runs.length) {
      const runEnd = selectedRunCursor + runs[sourceRunIndex].text.length;
      if (start < runEnd) break;
      selectedRunCursor = runEnd;
      sourceRunIndex += 1;
    }
    let linkStartIndex = sourceRunIndex;
    let linkEndIndex = sourceRunIndex;
    while (
      linkStartIndex > 0 &&
      runs[linkStartIndex - 1].subjectId === subjectId
    ) {
      linkStartIndex -= 1;
    }
    while (
      linkEndIndex + 1 < runs.length &&
      runs[linkEndIndex + 1].subjectId === subjectId
    ) {
      linkEndIndex += 1;
    }
    selectionText = runs
      .slice(linkStartIndex, linkEndIndex + 1)
      .map((run) => run.text)
      .join("");
  }

  return {
    text: selectionText,
    formats: intersectFormats(selectedRuns),
    ...(subjectId ? { subjectId } : {}),
  };
}
