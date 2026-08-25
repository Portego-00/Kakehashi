export type NoteFormat = "bold" | "italic" | "underline";

export type NoteSelection = {
  start: number;
  end: number;
};

export type FormattedNoteSegment = {
  text: string;
  formats: NoteFormat[];
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

const FORMAT_MARKERS: Record<NoteFormat, FormatMarker> = {
  bold: { format: "bold", open: "<b>", close: "</b>" },
  italic: { format: "italic", open: "<i>", close: "</i>" },
  underline: { format: "underline", open: "<u>", close: "</u>" },
};

const NOTE_TAG_PATTERN = /<\/?(?:b|i|u)>/gi;

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
) {
  if (!text) return;

  const previous = segments[segments.length - 1];
  const formatKey = formats.join(":");
  if (previous && previous.formats.join(":") === formatKey) {
    previous.text += text;
    return;
  }

  segments.push({ text, formats: [...formats] });
}

/**
 * Parses the small, deliberately restricted HTML subset used by study notes.
 * Unknown or malformed markup is kept as ordinary text.
 */
export function parseFormattedNote(note: string): FormattedNoteSegment[] {
  if (!note) return [];

  const segments: FormattedNoteSegment[] = [];
  const activeFormats: NoteFormat[] = [];
  const openTags: {
    format: NoteFormat;
    sourceIndex: number;
    segmentIndex: number;
    parentFormats: NoteFormat[];
  }[] = [];
  let cursor = 0;

  NOTE_TAG_PATTERN.lastIndex = 0;
  let match = NOTE_TAG_PATTERN.exec(note);
  while (match) {
    appendSegment(
      segments,
      note.slice(cursor, match.index),
      activeFormats,
    );

    const tag = match[0];
    const format = formatForTag(tag);
    const isClosingTag = tag.startsWith("</");
    const currentOpenTag = openTags[openTags.length - 1];

    if (!isClosingTag) {
      openTags.push({
        format,
        sourceIndex: match.index,
        segmentIndex: segments.length,
        parentFormats: [...activeFormats],
      });
      activeFormats.push(format);
    } else if (currentOpenTag?.format === format) {
      openTags.pop();
      activeFormats.pop();
    } else {
      appendSegment(segments, tag, activeFormats);
    }

    cursor = match.index + tag.length;
    match = NOTE_TAG_PATTERN.exec(note);
  }

  appendSegment(segments, note.slice(cursor), activeFormats);

  // If an opening tag was never closed, restore it and everything after it as
  // literal text instead of silently hiding part of the note.
  const firstUnclosedTag = openTags[0];
  if (firstUnclosedTag) {
    segments.splice(firstUnclosedTag.segmentIndex);
    appendSegment(
      segments,
      note.slice(firstUnclosedTag.sourceIndex),
      firstUnclosedTag.parentFormats,
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
  return text.replace(/<\/?(?:b|i|u)>/gi, "").length === 0;
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

/** Wraps the current selection in a format marker, or removes that format. */
export function toggleNoteFormat(
  note: string,
  selection: NoteSelection,
  format: NoteFormat,
): { text: string; selection: NoteSelection } {
  const { start, end } = clampSelection(note, selection);
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
