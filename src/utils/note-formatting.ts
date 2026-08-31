export type NoteFormat = "bold" | "italic" | "underline";

export type NoteSelection = {
  start: number;
  end: number;
};

export type NoteSubjectLink = {
  subjectId: number;
  text: string;
};

export type FormattedNoteSegment = {
  text: string;
  formats: NoteFormat[];
  subjectId?: number;
};

type FormatMarker = {
  format: NoteFormat;
  open: string;
  close: string;
};

type NoteFormatRange = {
  format: NoteFormat;
  openStart: number;
  contentStart: number;
  contentEnd: number;
  closeEnd: number;
};

type NoteSubjectLinkRange = {
  subjectId: number;
  openStart: number;
  contentStart: number;
  contentEnd: number;
  closeEnd: number;
};

const FORMAT_MARKERS: Record<NoteFormat, FormatMarker> = {
  bold: { format: "bold", open: "<b>", close: "</b>" },
  italic: { format: "italic", open: "<i>", close: "</i>" },
  underline: { format: "underline", open: "<u>", close: "</u>" },
};

const NOTE_TAG_SOURCE =
  "<\\/?(?:b|i|u)>|<a\\s+href=(?:\"wk:\\/\\/subject\\/\\d+\"|'wk:\\/\\/subject\\/\\d+')\\s*>|<\\/a>";
const NOTE_TAG_PATTERN = new RegExp(NOTE_TAG_SOURCE, "gi");
const NOTE_SUBJECT_LINK_OPEN_PATTERN =
  /^<a\s+href=(?:"wk:\/\/subject\/(\d+)"|'wk:\/\/subject\/(\d+)')\s*>$/i;
const NOTE_SUBJECT_LINK_CLOSE_PATTERN = /^<\/a>$/i;

function createNoteTagPattern(): RegExp {
  return new RegExp(NOTE_TAG_SOURCE, "gi");
}

function parseSubjectLinkId(tag: string): number | null {
  const match = NOTE_SUBJECT_LINK_OPEN_PATTERN.exec(tag);
  if (!match) return null;

  const subjectId = Number(match[1] ?? match[2]);
  return Number.isInteger(subjectId) && subjectId > 0 ? subjectId : null;
}

function createSubjectLinkOpenTag(subjectId: number): string {
  return `<a href="wk://subject/${subjectId}">`;
}

function formatForTag(tag: string): NoteFormat {
  switch (tag.toLocaleLowerCase("en-US").replace(/[</>]/g, "")) {
    case "b":
      return "bold";
    case "i":
      return "italic";
    default:
      return "underline";
  }
}

function appendSegment(
  segments: FormattedNoteSegment[],
  text: string,
  formats: NoteFormat[],
  subjectId?: number,
) {
  if (!text) return;

  const previous = segments[segments.length - 1];
  const formatKey = formats.join(":");
  if (
    previous &&
    previous.formats.join(":") === formatKey &&
    previous.subjectId === subjectId
  ) {
    previous.text += text;
    return;
  }

  segments.push({
    text,
    formats: [...formats],
    ...(subjectId ? { subjectId } : {}),
  });
}

/**
 * Parses the small, deliberately restricted HTML subset used by study notes.
 * Unknown or malformed markup is kept as ordinary text.
 */
export function parseFormattedNote(note: string): FormattedNoteSegment[] {
  if (!note) return [];

  const segments: FormattedNoteSegment[] = [];
  const activeFormats: NoteFormat[] = [];
  let activeSubjectId: number | undefined;
  const openTags: {
    kind: "format" | "subjectLink";
    format?: NoteFormat;
    subjectId?: number;
    sourceIndex: number;
    segmentIndex: number;
    parentFormats: NoteFormat[];
    parentSubjectId?: number;
  }[] = [];
  let cursor = 0;

  NOTE_TAG_PATTERN.lastIndex = 0;
  let match = NOTE_TAG_PATTERN.exec(note);
  while (match) {
    appendSegment(
      segments,
      note.slice(cursor, match.index),
      activeFormats,
      activeSubjectId,
    );

    const tag = match[0];
    const isClosingTag = tag.startsWith("</");
    const currentOpenTag = openTags[openTags.length - 1];
    const subjectId = parseSubjectLinkId(tag);
    const isSubjectLinkClose = NOTE_SUBJECT_LINK_CLOSE_PATTERN.test(tag);

    if (subjectId) {
      if (activeSubjectId) {
        appendSegment(segments, tag, activeFormats, activeSubjectId);
      } else {
        openTags.push({
          kind: "subjectLink",
          subjectId,
          sourceIndex: match.index,
          segmentIndex: segments.length,
          parentFormats: [...activeFormats],
          parentSubjectId: activeSubjectId,
        });
        activeSubjectId = subjectId;
      }
    } else if (isSubjectLinkClose) {
      if (currentOpenTag?.kind === "subjectLink") {
        openTags.pop();
        activeSubjectId = currentOpenTag.parentSubjectId;
      } else {
        appendSegment(segments, tag, activeFormats, activeSubjectId);
      }
    } else {
      const format = formatForTag(tag);
      if (!isClosingTag) {
        openTags.push({
          kind: "format",
          format,
          sourceIndex: match.index,
          segmentIndex: segments.length,
          parentFormats: [...activeFormats],
          parentSubjectId: activeSubjectId,
        });
        activeFormats.push(format);
      } else if (
        currentOpenTag?.kind === "format" &&
        currentOpenTag.format === format
      ) {
        openTags.pop();
        activeFormats.pop();
      } else {
        appendSegment(segments, tag, activeFormats, activeSubjectId);
      }
    }

    cursor = match.index + tag.length;
    match = NOTE_TAG_PATTERN.exec(note);
  }

  appendSegment(segments, note.slice(cursor), activeFormats, activeSubjectId);

  // If an opening tag was never closed, restore it and everything after it as
  // literal text instead of silently hiding part of the note.
  const firstUnclosedTag = openTags[0];
  if (firstUnclosedTag) {
    segments.splice(firstUnclosedTag.segmentIndex);
    appendSegment(
      segments,
      note.slice(firstUnclosedTag.sourceIndex),
      firstUnclosedTag.parentFormats,
      firstUnclosedTag.parentSubjectId,
    );
  }

  return segments;
}

function clampSelection(note: string, selection: NoteSelection): NoteSelection {
  const start = Math.max(0, Math.min(selection.start, note.length));
  const end = Math.max(start, Math.min(selection.end, note.length));
  return { start, end };
}

function getNoteFormatRanges(note: string): NoteFormatRange[] {
  const ranges: NoteFormatRange[] = [];
  const openTags: {
    format: NoteFormat;
    openStart: number;
    contentStart: number;
  }[] = [];

  for (const match of note.matchAll(/<\/?(?:b|i|u)>/gi)) {
    const tag = match[0];
    const format = formatForTag(tag);
    const isClosingTag = tag.startsWith("</");
    const currentOpenTag = openTags[openTags.length - 1];

    if (!isClosingTag) {
      openTags.push({
        format,
        openStart: match.index,
        contentStart: match.index + tag.length,
      });
    } else if (currentOpenTag?.format === format) {
      openTags.pop();
      ranges.push({
        ...currentOpenTag,
        contentEnd: match.index,
        closeEnd: match.index + tag.length,
      });
    }
  }

  return ranges;
}

function containsOnlyNoteTags(text: string): boolean {
  return text.replace(createNoteTagPattern(), "").length === 0;
}

function getNoteSubjectLinkRanges(note: string): NoteSubjectLinkRange[] {
  const ranges: NoteSubjectLinkRange[] = [];
  const openTags: {
    subjectId: number;
    openStart: number;
    contentStart: number;
  }[] = [];

  for (const match of note.matchAll(createNoteTagPattern())) {
    const tag = match[0];
    const subjectId = parseSubjectLinkId(tag);

    if (subjectId) {
      openTags.push({
        subjectId,
        openStart: match.index,
        contentStart: match.index + tag.length,
      });
      continue;
    }

    if (!NOTE_SUBJECT_LINK_CLOSE_PATTERN.test(tag)) continue;

    const currentOpenTag = openTags.pop();
    if (!currentOpenTag) continue;

    ranges.push({
      ...currentOpenTag,
      contentEnd: match.index,
      closeEnd: match.index + tag.length,
    });
  }

  return ranges;
}

function findSubjectLinkRange(
  note: string,
  selection: NoteSelection,
): NoteSubjectLinkRange | undefined {
  return getNoteSubjectLinkRanges(note)
    .filter((range) => {
      const selectionIncludesRange =
        selection.start === range.openStart && selection.end === range.closeEnd;
      const rangeContainsSelection =
        selection.start >= range.contentStart &&
        selection.end <= range.contentEnd;

      return selectionIncludesRange || rangeContainsSelection;
    })
    .sort(
      (left, right) =>
        left.closeEnd - left.openStart - (right.closeEnd - right.openStart),
    )[0];
}

function expandSelectionAcrossNoteMarkup(
  note: string,
  selection: NoteSelection,
): NoteSelection {
  const ranges = [
    ...getNoteFormatRanges(note),
    ...getNoteSubjectLinkRanges(note),
  ];
  const expandedSelection = { ...selection };
  let didExpand = true;

  while (didExpand) {
    didExpand = false;

    for (const range of ranges) {
      const isCaret = expandedSelection.start === expandedSelection.end;
      const crossesTagAtCaret =
        isCaret &&
        ((expandedSelection.start > range.openStart &&
          expandedSelection.start < range.contentStart) ||
          (expandedSelection.start > range.contentEnd &&
            expandedSelection.start < range.closeEnd));
      const overlapsRange =
        !isCaret &&
        expandedSelection.start < range.closeEnd &&
        expandedSelection.end > range.openStart;
      const staysInsideContent =
        expandedSelection.start >= range.contentStart &&
        expandedSelection.end <= range.contentEnd;
      const containsWholeRange =
        expandedSelection.start <= range.openStart &&
        expandedSelection.end >= range.closeEnd;

      if (
        !crossesTagAtCaret &&
        (!overlapsRange || staysInsideContent || containsWholeRange)
      ) {
        continue;
      }

      const nextStart = Math.min(expandedSelection.start, range.openStart);
      const nextEnd = Math.max(expandedSelection.end, range.closeEnd);
      if (
        nextStart !== expandedSelection.start ||
        nextEnd !== expandedSelection.end
      ) {
        expandedSelection.start = nextStart;
        expandedSelection.end = nextEnd;
        didExpand = true;
      }
    }
  }

  return expandedSelection;
}

function stripSubjectLinkTags(text: string): string {
  const tagRanges = getNoteSubjectLinkRanges(text)
    .flatMap((range) => [
      { start: range.openStart, end: range.contentStart },
      { start: range.contentEnd, end: range.closeEnd },
    ])
    .sort((left, right) => right.start - left.start);

  return tagRanges.reduce(
    (result, range) =>
      result.slice(0, range.start) + result.slice(range.end),
    text,
  );
}

function findExactFormatRange(
  note: string,
  selection: NoteSelection,
  format: NoteFormat,
): NoteFormatRange | undefined {
  const matchingRanges = getNoteFormatRanges(note)
    .filter((range) => {
      if (range.format !== format) return false;

      const selectionIncludesRange =
        selection.start === range.openStart && selection.end === range.closeEnd;
      const rangeContainsSelection =
        selection.start >= range.contentStart &&
        selection.end <= range.contentEnd &&
        containsOnlyNoteTags(
          note.slice(range.contentStart, selection.start),
        ) &&
        containsOnlyNoteTags(note.slice(selection.end, range.contentEnd));

      return selectionIncludesRange || rangeContainsSelection;
    })
    .sort(
      (left, right) =>
        left.closeEnd - left.openStart - (right.closeEnd - right.openStart),
    );

  return matchingRanges[0];
}

export function selectionHasNoteFormat(
  note: string,
  selection: NoteSelection,
  format: NoteFormat,
): boolean {
  const { start, end } = clampSelection(note, selection);
  return Boolean(findExactFormatRange(note, { start, end }, format));
}

export function getNoteSubjectLinkAtSelection(
  note: string,
  selection: NoteSelection,
): NoteSubjectLink | null {
  const clampedSelection = clampSelection(note, selection);
  const range = findSubjectLinkRange(note, clampedSelection);
  if (!range) return null;

  const linkedText = note.slice(range.contentStart, range.contentEnd);
  return {
    subjectId: range.subjectId,
    text: parseFormattedNote(linkedText)
      .map((segment) => segment.text)
      .join(""),
  };
}

export function selectionHasNoteSubjectLink(
  note: string,
  selection: NoteSelection,
): boolean {
  return getNoteSubjectLinkAtSelection(note, selection) !== null;
}

export function getNoteLinkSearchText(
  note: string,
  selection: NoteSelection,
): string {
  const clampedSelection = clampSelection(note, selection);
  const existingLink = findSubjectLinkRange(note, clampedSelection);
  const expandedSelection = expandSelectionAcrossNoteMarkup(
    note,
    clampedSelection,
  );
  const selectedText = existingLink
    ? note.slice(existingLink.contentStart, existingLink.contentEnd)
    : note.slice(expandedSelection.start, expandedSelection.end);

  return parseFormattedNote(stripSubjectLinkTags(selectedText))
    .map((segment) => segment.text)
    .join("");
}

/** Adds a stable WaniKani subject target while keeping the visible label editable. */
export function setNoteSubjectLink(
  note: string,
  selection: NoteSelection,
  subjectId: number,
  fallbackLabel: string,
): { text: string; selection: NoteSelection } {
  if (!Number.isInteger(subjectId) || subjectId <= 0) {
    return { text: note, selection: clampSelection(note, selection) };
  }

  const clampedSelection = clampSelection(note, selection);
  const existingLink = findSubjectLinkRange(note, clampedSelection);
  const expandedSelection = expandSelectionAcrossNoteMarkup(
    note,
    clampedSelection,
  );
  const replaceStart = existingLink?.openStart ?? expandedSelection.start;
  const replaceEnd = existingLink?.closeEnd ?? expandedSelection.end;
  const currentLabel = existingLink
    ? note.slice(existingLink.contentStart, existingLink.contentEnd)
    : note.slice(expandedSelection.start, expandedSelection.end);
  const label =
    stripSubjectLinkTags(currentLabel) || stripSubjectLinkTags(fallbackLabel);

  if (!label) {
    return { text: note, selection: clampedSelection };
  }

  const openTag = createSubjectLinkOpenTag(subjectId);
  const linkedText = `${openTag}${label}</a>`;

  return {
    text: note.slice(0, replaceStart) + linkedText + note.slice(replaceEnd),
    selection: {
      start: replaceStart + openTag.length,
      end: replaceStart + openTag.length + label.length,
    },
  };
}

export function removeNoteSubjectLink(
  note: string,
  selection: NoteSelection,
): { text: string; selection: NoteSelection } {
  const clampedSelection = clampSelection(note, selection);
  const existingLink = findSubjectLinkRange(note, clampedSelection);
  if (!existingLink) {
    return { text: note, selection: clampedSelection };
  }

  const label = note.slice(existingLink.contentStart, existingLink.contentEnd);
  return {
    text:
      note.slice(0, existingLink.openStart) +
      label +
      note.slice(existingLink.closeEnd),
    selection: {
      start: existingLink.openStart,
      end: existingLink.openStart + label.length,
    },
  };
}

/** Wraps the current selection in a format marker, or removes that format. */
export function toggleNoteFormat(
  note: string,
  selection: NoteSelection,
  format: NoteFormat,
): { text: string; selection: NoteSelection } {
  const clampedSelection = clampSelection(note, selection);
  const { start, end } = expandSelectionAcrossNoteMarkup(
    note,
    clampedSelection,
  );
  const { open, close } = FORMAT_MARKERS[format];
  const selectedText = note.slice(start, end);
  const existingRange = findExactFormatRange(
    note,
    { start, end },
    format,
  );

  if (existingRange) {
    const innerText = note.slice(
      existingRange.contentStart,
      existingRange.contentEnd,
    );
    const selectionIncludesMarkers =
      start === existingRange.openStart && end === existingRange.closeEnd;
    return {
      text:
        note.slice(0, existingRange.openStart) +
        innerText +
        note.slice(existingRange.closeEnd),
      selection: selectionIncludesMarkers
        ? {
            start: existingRange.openStart,
            end: existingRange.openStart + innerText.length,
          }
        : {
            start: start - open.length,
            end: end - open.length,
          },
    };
  }

  const formattedText = open + selectedText + close;
  const nextSelection =
    start === end
      ? { start: start + open.length, end: start + open.length }
      : { start: start + open.length, end: end + open.length };

  return {
    text: note.slice(0, start) + formattedText + note.slice(end),
    selection: nextSelection,
  };
}
