import { z } from "zod";

// Bound both rendered strings and validation work before walking arrays.
export const PACKAGE_LIMITS = {
  subjects: 12000, meanings: 64, readings: 64, alternatives: 32,
  synonyms: 20, examplesPerSubject: 100, examples: 40000,
  metadata: 256, schemaUrl: 1024, meaning: 256, sentence: 4096, usage: 8192,
} as const;
const text = (max: number) => z.string().max(max).refine(value => value.trim().length > 0);
const array = <T extends z.ZodType>(item: T, max: number) => z.preprocess(
  value => Array.isArray(value) && value.length > max ? undefined : value,
  z.array(item).max(max),
);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const status = z.enum(["demo", "draft", "editorial-reviewed"]);
const entrySchema = z.object({
  source: z.object({
    type: z.enum(["radical", "kanji", "vocabulary", "kana_vocabulary"]), word: text(PACKAGE_LIMITS.meaning).nullable(),
    meaningsEn: array(text(PACKAGE_LIMITS.meaning), PACKAGE_LIMITS.meanings).refine(values => values.length > 0),
    readingsJa: array(text(PACKAGE_LIMITS.meaning), PACKAGE_LIMITS.readings),
    level: z.number().int().min(1).max(60), updatedAt: z.string().max(PACKAGE_LIMITS.metadata).nullable(), meaningBasisSha256: hash,
  }).strict(),
  synonymAnswers: z.object({ values: array(text(PACKAGE_LIMITS.meaning), PACKAGE_LIMITS.synonyms), reviewStatus: status }).strict().optional(),
  meaning: z.object({ primary: text(PACKAGE_LIMITS.meaning), alternatives: array(text(PACKAGE_LIMITS.meaning), PACKAGE_LIMITS.alternatives), reviewStatus: status }).strict(),
  examples: array(z.object({
    source: z.object({ ja: text(PACKAGE_LIMITS.sentence), en: text(PACKAGE_LIMITS.sentence) }).strict(), sourceSha256: hash,
    translation: text(PACKAGE_LIMITS.sentence), usage: text(PACKAGE_LIMITS.usage), reviewStatus: status,
  }).strict(), PACKAGE_LIMITS.examplesPerSubject),
}).strict();
const packageSchema = z.object({
  $schema: text(PACKAGE_LIMITS.schemaUrl), schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]), packageId: text(PACKAGE_LIMITS.metadata),
  language: z.string().max(64).regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/), name: text(PACKAGE_LIMITS.metadata), version: text(PACKAGE_LIMITS.metadata),
  generatedAt: z.iso.datetime({ offset: true }),
  purpose: z.enum(["integration-demo", "learning-content"]), scope: z.enum(["display-only", "display-and-synonyms"]),
  subjects: z.record(z.string().regex(/^[1-9][0-9]*$/), entrySchema),
}).strict();
// Validate entries one at a time: malformed catalogs must not accumulate an
// unbounded collection of validation errors before their first failure.
const packageEnvelopeSchema = packageSchema.extend({subjects: z.unknown()});
export type TranslationPackage = z.infer<typeof packageSchema>;
export interface DisplaySubject {
  id: number; object: string; characters: string | null;
  meanings: { meaning: string; primary?: boolean }[];
  readings?: { reading: string; primary?: boolean }[];
}

// Compare original fields directly. Hashes are verified by the offline exporter,
// not treated as signatures or used in place of checking the current catalog.
export function parseTranslationPackage(value: unknown): TranslationPackage | null {
  const result = packageEnvelopeSchema.safeParse(value);
  if (!result.success) return null;
  const rawSubjects = result.data.subjects;
  if (!rawSubjects || typeof rawSubjects !== "object" || Array.isArray(rawSubjects)) return null;
  const ids = Object.keys(rawSubjects);
  if (!ids.length || ids.length > PACKAGE_LIMITS.subjects) return null;
  const subjects: TranslationPackage["subjects"] = {};
  let totalExamples = 0;
  for (const id of ids) {
    if (!/^[1-9][0-9]*$/.test(id)) return null;
    const parsed = entrySchema.safeParse((rawSubjects as Record<string, unknown>)[id]);
    if (!parsed.success) return null;
    const entry = parsed.data;
    if (result.data.schemaVersion < 3 && (result.data.scope !== "display-only" || entry.synonymAnswers)) return null;
    if (entry.source.type !== "radical" && entry.source.word === null) return null;
    if (result.data.schemaVersion === 1 && entry.source.type === "radical") return null;
    if (entry.source.type === "radical" && (entry.examples.length || entry.source.readingsJa.length)) return null;
    totalExamples += entry.examples.length;
    if (totalExamples > PACKAGE_LIMITS.examples) return null;
    const seen = new Set<string>();
    for (const example of entry.examples) {
      const key = JSON.stringify([example.source.ja, example.source.en]);
      if (seen.has(key)) return null;
      seen.add(key);
    }
    subjects[id] = entry;
  }
  return {...result.data, subjects};
}
function sameStrings(a: string[], b: string[]) {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}
function matchingEntry(packet: TranslationPackage | null, subject: DisplaySubject) {
  const entry = packet?.subjects[String(subject.id)];
  if (!entry || subject.id <= 0 || entry.source.type !== subject.object ||
    entry.source.word !== subject.characters ||
    !sameStrings(entry.source.meaningsEn, subject.meanings.map(m => m.meaning)) ||
    !sameStrings(entry.source.readingsJa, (subject.readings ?? []).map(r => r.reading))) return null;
  return entry;
}
export function resolveTranslatedMeaning(packet: TranslationPackage | null, subject: DisplaySubject) {
  const entry = matchingEntry(packet, subject);
  return entry?.meaning.reviewStatus === "editorial-reviewed" ? entry.meaning : null;
}
export function resolveSynonymAnswers(packet: TranslationPackage | null, subject: DisplaySubject) {
  if (packet?.language !== "tr" || packet?.schemaVersion !== 3 || packet.scope !== "display-and-synonyms") return null;
  const entry = matchingEntry(packet, subject);
  return entry?.synonymAnswers?.reviewStatus === "editorial-reviewed" ? entry.synonymAnswers.values : null;
}
export function resolveTranslatedSentence(packet: TranslationPackage | null, subject: DisplaySubject, source: {ja: string; en: string}) {
  const entry = matchingEntry(packet, subject);
  return entry?.examples.find(e => e.reviewStatus === "editorial-reviewed" &&
    e.source.ja === source.ja && e.source.en === source.en) ?? null;
}

export const MAX_PACKAGE_BYTES = 20 * 1024 * 1024;
export function parsePackageText(value: string): TranslationPackage {
  if (value.length > MAX_PACKAGE_BYTES) throw new Error("Translation files must be 20 MB or smaller.");
  let bytes = 0;
  for (const character of value) {
    const code = character.codePointAt(0)!;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    if (bytes > MAX_PACKAGE_BYTES) break;
  }
  if (value.length > MAX_PACKAGE_BYTES || bytes > MAX_PACKAGE_BYTES)
    throw new Error("Translation files must be 20 MB or smaller.");
  let decoded: unknown;
  try { decoded = JSON.parse(value.replace(/^\uFEFF/, "")); }
  catch { throw new Error("The file is not valid JSON."); }
  const packet = parseTranslationPackage(decoded);
  if (!packet) throw new Error("Unsupported or incomplete package. Your current content is unchanged.");
  return packet;
}
export function packageSummary(packet: TranslationPackage) {
  const counts = {radical: 0, kanji: 0, vocabulary: 0, kana_vocabulary: 0, sentences: 0};
  const levels = new Set<number>();
  for (const entry of Object.values(packet.subjects)) {
    if (entry.meaning.reviewStatus === "editorial-reviewed") counts[entry.source.type]++;
    counts.sentences += entry.examples.filter(e => e.reviewStatus === "editorial-reviewed").length;
    levels.add(entry.source.level);
  }
  return {...counts, levels: [...levels].sort((a, b) => a - b)};
}
