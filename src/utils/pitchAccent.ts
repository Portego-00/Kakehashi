import wanikaniPitchAccents from "../../assets/pitch/wanikani_pitch_accents.json";

export type WaniKaniPitchAccentEntry = {
  r: string;
  p: number[];
};

export type PitchAccentTypeLabel =
  | "Heiban"
  | "Atamadaka"
  | "Nakadaka"
  | "Odaka";

const pitchAccentBySubjectId =
  wanikaniPitchAccents as Record<string, unknown>;

const KATAKANA_RANGE = /[\u30A1-\u30F6]/g;
const WAVY_DASHES = /[〜～]/g;
const COMBINING_SMALL_KANA = new Set([
  "ゃ",
  "ゅ",
  "ょ",
  "ぁ",
  "ぃ",
  "ぅ",
  "ぇ",
  "ぉ",
  "ゎ",
  "ゕ",
  "ゖ",
  "ャ",
  "ュ",
  "ョ",
  "ァ",
  "ィ",
  "ゥ",
  "ェ",
  "ォ",
  "ヮ",
  "ヵ",
  "ヶ",
]);

function normalizeReading(reading: string): string {
  return reading
    .trim()
    .replace(WAVY_DASHES, "")
    .replace(KATAKANA_RANGE, (character) =>
      String.fromCharCode(character.charCodeAt(0) - 0x60)
    );
}

function normalizeAccents(rawAccents: unknown): number[] {
  if (!Array.isArray(rawAccents)) {
    return [];
  }

  return Array.from(
    new Set(
      rawAccents
        .map((accent) => Number(accent))
        .filter((accent) => Number.isInteger(accent) && accent >= 0)
    )
  ).sort((a, b) => a - b);
}

function normalizeEntry(rawEntry: unknown): WaniKaniPitchAccentEntry | null {
  if (!rawEntry || typeof rawEntry !== "object") {
    return null;
  }

  const maybeEntry = rawEntry as { r?: unknown; p?: unknown };
  if (typeof maybeEntry.r !== "string") {
    return null;
  }

  const normalizedAccents = normalizeAccents(maybeEntry.p);
  if (normalizedAccents.length === 0) {
    return null;
  }

  return {
    r: maybeEntry.r,
    p: normalizedAccents,
  };
}

export function splitReadingIntoMoras(reading: string): string[] {
  const moras: string[] = [];

  for (const character of Array.from(reading.trim())) {
    if (COMBINING_SMALL_KANA.has(character) && moras.length > 0) {
      moras[moras.length - 1] += character;
      continue;
    }

    moras.push(character);
  }

  return moras;
}

export function getPitchAccentTypeLabel(
  accent: number,
  moraCount: number,
): PitchAccentTypeLabel {
  const clampedAccent = Math.max(0, Math.min(accent, moraCount));

  if (clampedAccent === 0) {
    return "Heiban";
  }

  if (clampedAccent === 1) {
    return "Atamadaka";
  }

  if (clampedAccent >= moraCount) {
    return "Odaka";
  }

  return "Nakadaka";
}

export function formatPitchAccentNotation(
  reading: string,
  accents: number[],
): string[] {
  const moraCount = splitReadingIntoMoras(reading).length;

  if (!reading || moraCount === 0) {
    return accents.map((accent) => String(accent));
  }

  return accents.map(
    (accent) => `${getPitchAccentTypeLabel(accent, moraCount)} (${accent})`,
  );
}

export function getWaniKaniPitchAccents(
  subjectId: number | string,
  candidateReadings: string[] = []
): WaniKaniPitchAccentEntry[] {
  const rawEntry = pitchAccentBySubjectId[String(subjectId)] as
    | {
        r?: unknown;
        p?: unknown;
        rs?: unknown;
      }
    | undefined;

  if (!rawEntry || typeof rawEntry !== "object") {
    return [];
  }

  const entries: WaniKaniPitchAccentEntry[] = [];
  const seenKeys = new Set<string>();

  const maybeMultiEntries = Array.isArray(rawEntry.rs) ? rawEntry.rs : [];
  for (const candidate of maybeMultiEntries) {
    const entry = normalizeEntry(candidate);
    if (!entry) {
      continue;
    }

    const dedupeKey = `${normalizeReading(entry.r)}|${entry.p.join(",")}`;
    if (seenKeys.has(dedupeKey)) {
      continue;
    }

    seenKeys.add(dedupeKey);
    entries.push(entry);
  }

  const legacyEntry = normalizeEntry(rawEntry);
  if (legacyEntry) {
    const dedupeKey = `${normalizeReading(legacyEntry.r)}|${legacyEntry.p.join(",")}`;
    if (!seenKeys.has(dedupeKey)) {
      seenKeys.add(dedupeKey);
      entries.push(legacyEntry);
    }
  }

  if (entries.length === 0) {
    return [];
  }

  if (candidateReadings.length > 0) {
    const normalizedCandidateReadings = new Set(
      candidateReadings
        .filter((reading): reading is string => typeof reading === "string")
        .map((reading) => normalizeReading(reading))
    );

    return entries.filter((entry) =>
      normalizedCandidateReadings.has(normalizeReading(entry.r))
    );
  }

  return entries;
}

export function getWaniKaniPitchAccent(
  subjectId: number | string,
  candidateReadings: string[] = []
): WaniKaniPitchAccentEntry | null {
  const entries = getWaniKaniPitchAccents(subjectId, candidateReadings);
  return entries[0] ?? null;
}
