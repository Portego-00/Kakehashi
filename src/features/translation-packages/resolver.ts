import { z } from "zod";

const text = z.string().refine(value => value.trim().length > 0);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const status = z.enum(["demo", "draft", "editorial-reviewed"]);
const entrySchema = z.object({
  source: z.object({
    type: z.enum(["radical", "kanji", "vocabulary", "kana_vocabulary"]), word: text.nullable(),
    meaningsEn: z.array(text).min(1), readingsJa: z.array(text),
    level: z.number().int().min(1).max(60), updatedAt: z.string().nullable(), meaningBasisSha256: hash,
  }).strict(),
  synonymAnswers: z.object({ values: z.array(text).max(20), reviewStatus: status }).strict().optional(),
  meaning: z.object({ primary: text, alternatives: z.array(text), reviewStatus: status }).strict(),
  examples: z.array(z.object({
    source: z.object({ ja: text, en: text }).strict(), sourceSha256: hash,
    translation: text, usage: text, reviewStatus: status,
  }).strict()),
}).strict();
const packageSchema = z.object({
  $schema: text, schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]), packageId: text,
  language: z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/), name: text, version: text,
  generatedAt: z.iso.datetime({ offset: true }),
  purpose: z.enum(["integration-demo", "learning-content"]), scope: z.enum(["display-only", "display-and-synonyms"]),
  subjects: z.record(z.string().regex(/^[1-9][0-9]*$/), entrySchema),
}).strict();
export type TranslationPackage = z.infer<typeof packageSchema>;
export interface DisplaySubject {
  id: number; object: string; characters: string | null;
  meanings: { meaning: string; primary?: boolean }[];
  readings?: { reading: string; primary?: boolean }[];
}

// Compare original fields directly. Hashes are verified by the offline exporter,
// not treated as signatures or used in place of checking the current catalog.
export function parseTranslationPackage(value: unknown): TranslationPackage | null {
  const result = packageSchema.safeParse(value);
  if (!result.success || !Object.keys(result.data.subjects).length) return null;
  if (Object.keys(result.data.subjects).length > 12000) return null;
  if (result.data.schemaVersion < 3 && (result.data.scope !== "display-only" || Object.values(result.data.subjects).some(entry => entry.synonymAnswers))) return null;
  let totalExamples = 0;
  for (const entry of Object.values(result.data.subjects)) {
    if (entry.source.type !== "radical" && entry.source.word === null) return null;
    if (result.data.schemaVersion === 1 && entry.source.type === "radical") return null;
    if (entry.source.type === "radical" && (entry.examples.length || entry.source.readingsJa.length)) return null;
    totalExamples += entry.examples.length;
    if (entry.examples.length > 100 || totalExamples > 40000) return null;
    const seen = new Set<string>();
    for (const example of entry.examples) {
      const key = JSON.stringify([example.source.ja, example.source.en]);
      if (seen.has(key)) return null;
      seen.add(key);
    }
  }
  return result.data;
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
