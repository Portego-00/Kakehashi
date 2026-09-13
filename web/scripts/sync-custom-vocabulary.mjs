import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { toRomaji } from "wanakana";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(scriptDirectory, "..");
const researchRoot = resolve(webRoot, "../research/data");
const packSources = [
  resolve(researchRoot, "kana-vocabulary-packs.json"),
  resolve(researchRoot, "custom-vocab-kana-candidates.json"),
  resolve(researchRoot, "custom-vocab-kana-expansion.json"),
  resolve(researchRoot, "custom-vocab-kanji-candidates.json"),
  resolve(researchRoot, "custom-vocab-kanji-expansion.json"),
];
const vocabularySnapshotSource = resolve(researchRoot, "wanikani-vocabulary-exclusions.snapshot.json");
const kanjiSnapshotSource = resolve(researchRoot, "wanikani-kanji-levels.snapshot.json");
const jmdictSnapshotSource = resolve(researchRoot, "custom-vocab-jmdict-readings.snapshot.json");
const readingHookReviewSource = resolve(researchRoot, "custom-vocab-reading-hook-review.snapshot.json");
const catalogTarget = resolve(webRoot, "src/features/custom-srs/catalog.generated.json");
const validationTarget = resolve(webRoot, "src/features/custom-srs/catalog-validation.generated.json");

const HAN_CHARACTER = /\p{Script=Han}/u;
const KANA_READING = /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u;
const SCRIPT_TYPES = new Set(["hiragana", "katakana", "mixed", "kanji"]);
const MINIMUM_PACKS = 30;
const MINIMUM_WORDS = 500;
const MNEMONIC_TAGS = new Set(["radical", "kanji", "vocabulary", "meaning", "reading", "em", "i", "ja", "a"]);
const MNEMONIC_TAG_PATTERN = /<\s*(\/?)\s*([a-z][\w-]*)\b([^>]*)>/giu;
const SMALL_KANA = new Set(Array.from("ぁぃぅぇぉゃゅょゎゕゖァィゥェォャュョヮヵヶ"));
const ENGLISH_SOUND_WORDS = new Map(Object.entries({
  ah: "a", beer: "biiru", cake: "keiki", cheese: "chiizu", cook: "kuuku", couple: "kappuru", cue: "kyuu", curry: "karii",
  die: "dai", dough: "dou", earphone: "iyahon", eye: "ai", gym: "jimu", ice: "aisu", joe: "jou", juice: "juusu",
  ee: "i", eh: "e", key: "kii", knee: "nii", leader: "riidaa", lie: "rai", mail: "meiru", new: "nyuu", ohio: "ohayou", ooh: "u", parry: "pari",
  pool: "puuru", queue: "kyuu", ray: "rei", register: "rejisuta", sale: "seiru", sauce: "soosu", say: "sei",
  sew: "sou", shoe: "shuu", soccer: "sakkaa", team: "chiimu", toe: "tou", towel: "taoru", two: "tsuu",
  wah: "wa", yappy: "yapi", you: "yuu",
}));

function fail(message) {
  throw new Error(`Custom vocabulary catalog is invalid: ${message}`);
}

function nonEmptyString(value, path) {
  if (typeof value !== "string" || !value.trim()) fail(`${path} must be a non-empty string`);
  return value.trim();
}

function normalized(value, path = "value") {
  return nonEmptyString(value, path).normalize("NFKC").trim();
}

function readingKey(value) {
  return Array.from(normalized(value), (character) => {
    const codePoint = character.codePointAt(0);
    return codePoint >= 0x30a1 && codePoint <= 0x30f6
      ? String.fromCodePoint(codePoint - 0x60)
      : character;
  }).join("");
}

function lexicalWrittenKey(value) {
  return normalized(value).replace(/^[おご御](?=\p{Script=Han})/u, "").replace(/する$/u, "");
}

function meaningKey(value) {
  return normalized(value).toLocaleLowerCase("en").replace(/[^a-z0-9]+/gu, " ").trim();
}

function englishSoundWord(value) {
  const reviewed = ENGLISH_SOUND_WORDS.get(value);
  if (reviewed) return reviewed;
  return value
    .replace(/^kn/u, "n")
    .replace(/^wr/u, "r")
    .replace(/tion/gu, "shon")
    .replace(/tch/gu, "ch")
    .replace(/dge/gu, "j")
    .replace(/ph/gu, "f")
    .replace(/ck/gu, "k")
    .replace(/qu/gu, "kw")
    .replace(/x/gu, "ks")
    .replace(/c(?=[eiy])/gu, "s")
    .replace(/c/gu, "k")
    .replace(/g(?=[eiy])/gu, "j")
    .replace(/l/gu, "r")
    .replace(/v/gu, "b")
    .replace(/th/gu, "s")
    .replace(/e$/u, "")
    .replace(/y$/u, "i");
}

function englishHookPhonetic(value) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("en")
    .split(/[^a-z]+/u).filter(Boolean).map(englishSoundWord).join("");
}

function kanaHookPhonetic(value) {
  const kana = [...value.matchAll(/[\p{Script=Hiragana}\p{Script=Katakana}ー]+/gu)].map((match) => match[0]).join("");
  return kana ? toRomaji(kana) : "";
}

function consonantKey(value) {
  return value
    .replace(/sh/gu, "S").replace(/ch/gu, "C").replace(/ts/gu, "T")
    .replace(/ky/gu, "K").replace(/ny/gu, "N").replace(/ry/gu, "R")
    .replace(/gy/gu, "G").replace(/by/gu, "B").replace(/py/gu, "P")
    .replace(/my/gu, "M").replace(/hy/gu, "H").replace(/j/gu, "J")
    .replace(/z/gu, "s").replace(/v/gu, "b").replace(/f/gu, "h").replace(/l/gu, "r")
    .replace(/[^a-zA-Z]/gu, "").replace(/[aeiouyw]/gu, "").replace(/(.)\1+/gu, "$1");
}

function vowelGlideKey(value) {
  return value.replace(/[^aeiouyw]/gu, "");
}

function isSubsequence(expected, actual) {
  let expectedIndex = 0;
  for (const unit of actual) if (unit === expected[expectedIndex]) expectedIndex += 1;
  return expectedIndex === expected.length;
}

function readingHooks(mnemonic) {
  return [...mnemonic.matchAll(/<reading>([^<]+)<\/reading>/gu)].map((match) => match[1]);
}

function learnerHookCoversReading(hooks, reading) {
  const expectedPhonetic = toRomaji(reading);
  const candidates = hooks.flatMap((hook) => [englishHookPhonetic(hook), kanaHookPhonetic(hook)]).filter(Boolean);
  const expectedConsonants = consonantKey(expectedPhonetic);
  if (expectedConsonants) return candidates.some((candidate) => isSubsequence(expectedConsonants, consonantKey(candidate)));
  const expectedVowels = vowelGlideKey(expectedPhonetic);
  return Boolean(expectedVowels) && candidates.some((candidate) => isSubsequence(expectedVowels, vowelGlideKey(candidate)));
}

function readingHookFingerprint(id, reading, hooks) {
  return JSON.stringify({ id, reading, hooks });
}

function validateReadingHookReviews(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schemaVersion !== 1 || !Array.isArray(value.entries)) fail("reading-hook review snapshot is invalid");
  const reviews = new Map();
  for (const [index, entry] of value.entries.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) fail(`reading-hook review entry ${index} is invalid`);
    const id = nonEmptyString(entry.id, `reading-hook review entry ${index}.id`);
    const reading = normalized(entry.reading, `reading-hook review entry ${index}.reading`);
    if (!Array.isArray(entry.hooks) || !entry.hooks.length || entry.hooks.some((hook) => typeof hook !== "string" || !hook.trim())) fail(`reading-hook review entry ${id}.hooks is invalid`);
    if (reviews.has(id)) fail(`reading-hook review snapshot contains duplicate id ${id}`);
    reviews.set(id, readingHookFingerprint(id, reading, entry.hooks));
  }
  return reviews;
}

function validateMeaningPayoff(mnemonic, meanings, path) {
  const accepted = new Set(meanings.map(meaningKey));
  const payoffs = [...mnemonic.matchAll(/<vocabulary>([^<]+)<\/vocabulary>/gu)].map((match) => meaningKey(match[1]));
  if (!payoffs.length || payoffs.some((payoff) => !accepted.has(payoff))) fail(`${path} must tag an exact accepted meaning in every <vocabulary> cue`);
}

function contextContainsTarget(sentence, written, partsOfSpeech) {
  const writtenForms = written.startsWith("御") ? [written, `お${written.slice(1)}`, `ご${written.slice(1)}`] : [written];
  if (writtenForms.some((form) => sentence.includes(form))) return true;
  const grammar = partsOfSpeech.join(" ").toLocaleLowerCase("en");
  if (/verb/u.test(grammar)) {
    const stems = writtenForms.map((form) => form.endsWith("する") ? form.slice(0, -2) : form.replace(/[うくぐすつぬぶむる]$/u, ""));
    if (stems.some((stem) => stem.length >= 2 && sentence.includes(stem))) return true;
  }
  if (/(?:\bi|い)[ _-]?adjective\b/u.test(grammar) && written.endsWith("い")) {
    const stems = writtenForms.map((form) => form.slice(0, -1));
    if (stems.some((stem) => stem.length >= 2 && sentence.includes(stem))) return true;
  }
  return false;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value)), "utf8").digest("hex");
}

function sha256Text(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function nonMnemonicWord(word) {
  return Object.fromEntries(Object.entries(word).filter(([key]) => !["meaningMnemonic", "readingMnemonic", "readingMap", "jmdictPriorityTags"].includes(key)));
}

function packMetadata(packs) {
  return packs.map((pack) => ({
    id: pack.id,
    title: pack.title,
    description: pack.description,
    script: pack.script,
    levelRange: pack.levelRange ?? null,
    wordIds: pack.words.map((word) => word.id),
  }));
}

function validateMnemonicMarkup(value, path) {
  const openTags = [];
  let cursor = 0;
  for (const match of value.matchAll(MNEMONIC_TAG_PATTERN)) {
    if (/[<>]/u.test(value.slice(cursor, match.index))) fail(`${path} contains unsupported mnemonic markup`);
    cursor = match.index + match[0].length;
    const [, closing, rawTag, rawAttributes] = match;
    const tag = rawTag.toLowerCase();
    if (!MNEMONIC_TAGS.has(tag)) fail(`${path} contains unsupported <${tag}> markup`);
    const attributes = rawAttributes.trim();
    if (closing) {
      if (attributes) fail(`${path} has attributes on closing </${tag}>`);
      const active = openTags.at(-1);
      if (active?.tag !== tag) fail(`${path} closes </${tag}> while <${active?.tag ?? "nothing"}> is open`);
      const content = value.slice(active.contentStart, match.index).replace(MNEMONIC_TAG_PATTERN, "").trim();
      if (!content) fail(`${path} has an empty <${tag}> cue`);
      if (/[*_`]/u.test(content)) fail(`${path} must not contain Markdown emphasis inside <${tag}>`);
      openTags.pop();
      continue;
    }
    if (/\/\s*$/u.test(attributes)) fail(`${path} must not use self-closing <${tag}> markup`);
    if (tag === "a") validateMnemonicLinkAttributes(attributes, path);
    else if (attributes) fail(`${path} must not add attributes to <${tag}>`);
    openTags.push({ tag, contentStart: match.index + match[0].length });
  }
  if (/[<>]/u.test(value.slice(cursor))) fail(`${path} contains unsupported mnemonic markup`);
  if (openTags.length) fail(`${path} has an unclosed <${openTags.at(-1).tag}> tag`);
}

function validateMnemonicLinkAttributes(value, path) {
  const attributes = new Map();
  const attributePattern = /\s*([a-z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/giu;
  let cursor = 0;
  for (const match of value.matchAll(attributePattern)) {
    if (value.slice(cursor, match.index).trim()) fail(`${path} has malformed link attributes`);
    cursor = match.index + match[0].length;
    const name = match[1].toLowerCase();
    if (!["href", "target", "rel"].includes(name) || attributes.has(name)) fail(`${path} has an unsupported or duplicate link attribute`);
    attributes.set(name, match[2] ?? match[3]);
  }
  if (value.slice(cursor).trim()) fail(`${path} has malformed link attributes`);
  const href = attributes.get("href");
  if (!href) fail(`${path} link is missing href`);
  try {
    const url = new URL(href);
    if (!["http:", "https:"].includes(url.protocol)) fail(`${path} link must use HTTP or HTTPS`);
  } catch {
    fail(`${path} link has an invalid href`);
  }
  if (attributes.has("target") && attributes.get("target") !== "_blank") fail(`${path} link target must be _blank`);
}

function coverageUnits(value, path) {
  const units = [];
  for (const character of Array.from(normalized(value, path))) {
    if (SMALL_KANA.has(character)) {
      const previous = units.at(-1);
      if (!previous || /[っッんンー]/u.test(previous)) fail(`${path} has detached small kana ${character}`);
      units[units.length - 1] = `${previous}${character}`;
    } else {
      units.push(character);
    }
  }
  return units;
}

function firstMismatchIndex(expected, actual) {
  const length = Math.max(expected.length, actual.length);
  for (let index = 0; index < length; index += 1) {
    if (expected[index] !== actual[index]) return index;
  }
  return -1;
}

function validateReadingMap(readingMap, reading, wordId) {
  const path = `${wordId}.readingMap`;
  const map = normalized(readingMap, path);
  if (/[<>]/u.test(map)) fail(`${path} is hidden audit data and must not contain mnemonic markup`);
  const groups = map.split(/\s*[・+]\s*/u);
  if (groups.some((group) => !group)) fail(`${path} has an empty coverage group`);
  if (groups.some((group) => !KANA_READING.test(group))) fail(`${path} groups must contain only kana and ー`);
  const mappedReading = groups.join("");
  if (normalized(mappedReading, `${path} mapped reading`) !== reading) fail(`${path} must concatenate to ${reading}`);
  const expectedUnits = coverageUnits(reading, `${wordId}.reading`);
  const mappedUnits = groups.flatMap((group) => coverageUnits(group, `${path} group`));
  if (JSON.stringify(mappedUnits) !== JSON.stringify(expectedUnits)) {
    const mismatchIndex = firstMismatchIndex(expectedUnits, mappedUnits);
    fail(`${path} for ${reading} has coverage units ${JSON.stringify(mappedUnits)}; expected ${JSON.stringify(expectedUnits)}; first mismatch at index ${mismatchIndex}`);
  }
}

function validateStoryMnemonic(mnemonic, path, {
  requireReadingCue = false,
  requireMeaningCue = true,
  reading,
  wordId,
  readingHookReviews = new Map(),
  usedReadingHookReviews,
} = {}) {
  validateMnemonicMarkup(mnemonic, path);
  if (requireMeaningCue && !/<vocabulary>[^<]+<\/vocabulary>/u.test(mnemonic)) fail(`${path} must highlight the meaning payoff with <vocabulary>`);
  if (requireReadingCue && !/<reading>[^<]+<\/reading>/u.test(mnemonic)) fail(`${path} must highlight a pronounceable sound hook with <reading>`);
  const hooks = readingHooks(mnemonic);
  const soundHook = hooks[0] ?? "";
  if (requireReadingCue && reading && !learnerHookCoversReading(hooks, reading)) {
    const fingerprint = readingHookFingerprint(wordId, reading, hooks);
    if (readingHookReviews.get(wordId) !== fingerprint) fail(`${path} reading hooks ${JSON.stringify(hooks)} do not cover the complete reading ${reading}`);
    usedReadingHookReviews?.add(wordId);
  }
  if (reading?.includes("ちょう") && /\bCHOW\b/iu.test(soundHook)) fail(`${path} uses CHOW for ちょう, but CHOW cues ちゃう`);
  if (reading === "かれは" && /彼は/u.test(mnemonic)) fail(`${path} must not treat particle は in 彼は as spoken は`);
  if (/Reading map:/iu.test(mnemonic)) fail(`${path} must not expose audit-only reading maps to learners`);
  if (/\b(?:say|read|pronounce)\s+(?:it|this|the\s+word)\b|\b(?:kana|mora|syllable)\s+(?:map|sequence|chunk)|\b\d+\s+beats?\b/iu.test(mnemonic)) fail(`${path} is a pronunciation drill, not a story mnemonic`);
  const sentenceCount = mnemonic.split(/[.!?。！？]+/u).map((sentence) => sentence.replace(/<[^>]+>/gu, "").trim()).filter(Boolean).length;
  if (sentenceCount < 2) fail(`${path} needs a concrete story plus a usage or meaning clarification`);
}

function topLevelPacks(value, source) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && Array.isArray(value.packs)) return value.packs;
  fail(`${source} must be a pack array or an object with a packs array`);
}

function validateVocabularySnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("WaniKani vocabulary snapshot must be an object");
  if (value.apiRevision !== "20170710") fail("WaniKani vocabulary snapshot has the wrong API revision");
  if (!Array.isArray(value.subjects) || value.subjects.length < 6_000) fail("WaniKani vocabulary snapshot is incomplete");
  if (value.totalCount !== value.subjects.length) fail("WaniKani vocabulary snapshot count does not match its subjects");

  const ids = new Set();
  const writtenForms = new Set();
  const lexicalWrittenForms = new Map();
  const readingForms = new Set();
  const subjectsByReading = new Map();
  for (const [index, subject] of value.subjects.entries()) {
    if (!subject || typeof subject !== "object" || Array.isArray(subject)) fail(`vocabulary snapshot subject ${index} must be an object`);
    if (!Number.isInteger(subject.id) || subject.id < 1 || ids.has(subject.id)) fail(`vocabulary snapshot subject ${index} has an invalid or duplicate id`);
    ids.add(subject.id);
    if (!["vocabulary", "kana_vocabulary"].includes(subject.object)) fail(`vocabulary snapshot subject ${subject.id} has an invalid type`);
    const written = normalized(subject.characters, `vocabulary snapshot subject ${subject.id}.characters`);
    writtenForms.add(written);
    const lexicalKey = lexicalWrittenKey(written);
    const lexicalBucket = lexicalWrittenForms.get(lexicalKey) ?? [];
    lexicalBucket.push(written);
    lexicalWrittenForms.set(lexicalKey, lexicalBucket);
    if (!Array.isArray(subject.readings)) fail(`vocabulary snapshot subject ${subject.id}.readings must be an array`);
    if (!Array.isArray(subject.meanings) || !subject.meanings.length || subject.meanings.some((meaning) => typeof meaning !== "string" || !meaning.trim())) fail(`vocabulary snapshot subject ${subject.id}.meanings must contain accepted meanings`);
    for (const reading of subject.readings) {
      const key = readingKey(reading);
      readingForms.add(key);
      const bucket = subjectsByReading.get(key) ?? [];
      bucket.push({ id: subject.id, characters: written, meanings: subject.meanings.map(meaningKey) });
      subjectsByReading.set(key, bucket);
    }
  }
  if (writtenForms.size !== value.subjects.length) fail("WaniKani vocabulary snapshot contains duplicate written forms");
  return { snapshot: value, writtenForms, lexicalWrittenForms, readingForms, subjectsByReading };
}

function validateKanjiSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("WaniKani kanji snapshot must be an object");
  if (value.apiRevision !== "20170710") fail("WaniKani kanji snapshot has the wrong API revision");
  if (!Array.isArray(value.subjects) || value.subjects.length < 2_000) fail("WaniKani kanji snapshot is incomplete");
  if (value.totalCount !== value.subjects.length) fail("WaniKani kanji snapshot count does not match its subjects");

  const ids = new Set();
  const visibleLevels = new Map();
  const visibleSubjects = new Map();
  for (const [index, subject] of value.subjects.entries()) {
    if (!subject || typeof subject !== "object" || Array.isArray(subject)) fail(`kanji snapshot subject ${index} must be an object`);
    if (!Number.isInteger(subject.id) || subject.id < 1 || ids.has(subject.id)) fail(`kanji snapshot subject ${index} has an invalid or duplicate id`);
    ids.add(subject.id);
    const character = normalized(subject.characters, `kanji snapshot subject ${subject.id}.characters`);
    if (!HAN_CHARACTER.test(character)) fail(`kanji snapshot subject ${subject.id} is not a Han character`);
    if (!Number.isInteger(subject.level) || subject.level < 1 || subject.level > 60) fail(`kanji snapshot subject ${subject.id} has an invalid level`);
    if (!Array.isArray(subject.meanings) || !subject.meanings.length || subject.meanings.some((meaning) => typeof meaning !== "string" || !meaning.trim())) fail(`kanji snapshot subject ${subject.id}.meanings must contain accepted meanings`);
    if (subject.hiddenAt === null) {
      if (visibleLevels.has(character)) fail(`WaniKani kanji snapshot contains duplicate visible kanji ${character}`);
      visibleLevels.set(character, subject.level);
      visibleSubjects.set(character, { level: subject.level, meanings: subject.meanings.map(meaningKey) });
    }
  }
  return { snapshot: value, visibleLevels, visibleSubjects };
}

function validateJmdictSnapshot(value, sourcePacks, vocabularySnapshotText, vocabulary) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("JMdict reading snapshot must be an object");
  if (value.schemaVersion !== 2) fail("JMdict reading snapshot has an unsupported schema version");
  if (value.source?.name !== "JMdict English XML distribution" || value.source?.url !== "https://www.edrdg.org/pub/Nihongo/JMdict_e.gz") fail("JMdict reading snapshot must identify the official JMdict English distribution");
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value.source?.jmdictCreatedDate ?? "")) fail("JMdict reading snapshot is missing its source date");
  if (!/^[a-f0-9]{64}$/u.test(value.source?.compressedSha256 ?? "")) fail("JMdict reading snapshot is missing its source SHA-256");

  const wanikaniEvidence = value.wanikaniVocabularyExclusion;
  if (!wanikaniEvidence || typeof wanikaniEvidence !== "object" || Array.isArray(wanikaniEvidence)) fail("JMdict reading snapshot is missing WaniKani entry-family exclusion evidence");
  if (wanikaniEvidence.snapshotSha256 !== sha256Text(vocabularySnapshotText)) fail("JMdict reading snapshot was not checked against the current WaniKani vocabulary snapshot");
  if (wanikaniEvidence.dataUpdatedAt !== vocabulary.snapshot.dataUpdatedAt || wanikaniEvidence.subjectCount !== vocabulary.snapshot.totalCount) fail("JMdict reading snapshot has stale WaniKani vocabulary metadata");
  if (!Number.isInteger(wanikaniEvidence.readingPairCount) || wanikaniEvidence.readingPairCount < vocabulary.snapshot.totalCount) fail("JMdict reading snapshot has incomplete WaniKani reading-pair evidence");
  if (wanikaniEvidence.resolvedReadingPairCount + wanikaniEvidence.unmatchedReadingPairCount + wanikaniEvidence.ambiguousReadingPairCount !== wanikaniEvidence.readingPairCount) fail("JMdict reading snapshot WaniKani pair counts are inconsistent");
  if (wanikaniEvidence.sameEntryCollisionCount !== 0 || wanikaniEvidence.ambiguousPotentialCollisionCount !== 0) fail("JMdict reading snapshot contains a WaniKani entry-family collision");

  const words = sourcePacks.flatMap((pack) => pack.words);
  const verification = value.verification;
  if (!verification || verification.expectedWordCount !== words.length || verification.resolvedWordCount !== words.length) fail(`JMdict reading snapshot must resolve all ${words.length} source words`);
  if (verification.unresolvedWordCount !== 0 || verification.ambiguousWordCount !== 0 || verification.uniqueIdCount !== words.length) fail("JMdict reading snapshot contains unresolved, ambiguous, or duplicate mappings");
  if (value.catalog?.packCount !== sourcePacks.length || value.catalog?.wordCount !== words.length) fail("JMdict reading snapshot catalog counts do not match the source catalogs");
  const expectedPackHash = sha256(packMetadata(sourcePacks));
  if (value.catalog?.packMetadataSha256 !== expectedPackHash) fail("JMdict reading snapshot pack metadata hash does not match the source catalogs");
  if (!Array.isArray(value.entries) || value.entries.length !== words.length) fail(`JMdict reading snapshot must contain ${words.length} evidence entries`);

  const evidenceById = new Map();
  for (const [index, entry] of value.entries.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) fail(`JMdict reading snapshot entry ${index} must be an object`);
    const id = nonEmptyString(entry.id, `JMdict reading snapshot entry ${index}.id`);
    if (evidenceById.has(id)) fail(`JMdict reading snapshot contains duplicate id ${id}`);
    evidenceById.set(id, entry);
  }

  const requiredEvidenceFlags = [
    "readingElementFound",
    "writtenFormVerified",
    "readingPairVerified",
    "reRestrVerified",
    "reNokanjiVerified",
    "stagkVerified",
    "stagrVerified",
    "applicableSenseVerified",
  ];
  for (const word of words) {
    const entry = evidenceById.get(word.id);
    if (!entry) fail(`JMdict reading snapshot is missing ${word.id}`);
    if (entry.characters !== word.characters || entry.reading !== word.reading) fail(`JMdict reading snapshot form or reading changed for ${word.id}`);
    const expectedMatchMode = word.characters === word.reading ? "kana-reading-form" : "written-reading-pair";
    if (entry.matchMode !== expectedMatchMode) fail(`JMdict reading snapshot has the wrong match mode for ${word.id}`);
    if (!Number.isInteger(entry.jmdictEntSeq) || entry.jmdictEntSeq < 1) fail(`JMdict reading snapshot has an invalid JMdict entry for ${word.id}`);
    if (requiredEvidenceFlags.some((flag) => entry[flag] !== true)) fail(`JMdict reading snapshot has incomplete pair or sense evidence for ${word.id}`);
    if (!Array.isArray(entry.applicableSenseIndexes) || !entry.applicableSenseIndexes.length || entry.applicableSenseIndexes.some((senseIndex) => !Number.isInteger(senseIndex) || senseIndex < 1)) fail(`JMdict reading snapshot has invalid applicable senses for ${word.id}`);
    const expectedNonMnemonicHash = sha256(nonMnemonicWord(word));
    if (entry.nonMnemonicSha256 !== expectedNonMnemonicHash) fail(`${word.id} changed outside mnemonic or mnemonic-audit fields since its JMdict verification`);
    evidenceById.delete(word.id);
  }
  if (evidenceById.size) fail(`JMdict reading snapshot contains unknown ids: ${[...evidenceById.keys()].join(", ")}`);

  return value;
}

function validateLevelRange(pack, packId) {
  if (!pack.levelRange || typeof pack.levelRange !== "object" || Array.isArray(pack.levelRange)) fail(`${packId}.levelRange is required for kanji packs`);
  const { min, max } = pack.levelRange;
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max > 60 || min > max) fail(`${packId}.levelRange must be within levels 1–60`);
  if ((min - 1) % 5 !== 0 || max !== min + 4) fail(`${packId}.levelRange must be an exact five-level band (1–5, 6–10, …, 56–60)`);
  return { min, max };
}

function validateKanjiMeaningMnemonic(mnemonic, wordId, componentKanji, componentOccurrences, visibleKanji) {
  const path = `${wordId}.meaningMnemonic`;
  validateMnemonicMarkup(mnemonic, path);
  const paragraphs = mnemonic.split(/\n\s*\n/u).map((paragraph) => paragraph.trim()).filter(Boolean);
  if (paragraphs.length < 2) fail(`${path} needs a composition bridge followed by a separate usage or nuance paragraph`);
  const firstParagraph = paragraphs[0];
  const componentCues = [...firstParagraph.matchAll(/<kanji>([^<]+)<\/kanji>/gu)].map((match) => match[1]);
  const cueComponents = componentCues.length === componentOccurrences.length
    ? componentOccurrences
    : componentCues.length === componentKanji.length
      ? componentKanji
      : null;
  if (!cueComponents) fail(`${path} must give ordered <kanji> composition cues for every distinct component or written occurrence (${componentOccurrences.join(" + ")})`);
  for (const [index, component] of cueComponents.entries()) {
    const acceptedMeanings = visibleKanji.get(component)?.meanings ?? [];
    if (!acceptedMeanings.includes(meaningKey(componentCues[index]))) fail(`${path} cue ${index + 1} for ${component} must use an accepted WaniKani component meaning`);
  }
  if (!/<vocabulary>[^<]+<\/vocabulary>/u.test(firstParagraph)) fail(`${path} must land its composition bridge on a <vocabulary> meaning payoff in the first paragraph`);
  const usageText = paragraphs.slice(1).join(" ").replace(MNEMONIC_TAG_PATTERN, "").trim();
  if (usageText.length < 24) fail(`${path} usage or nuance paragraph is too thin`);
}

function validatePacks(value, vocabulary, kanji, readingHookReviews) {
  if (!Array.isArray(value) || value.length < MINIMUM_PACKS) fail(`at least ${MINIMUM_PACKS} packs are required`);
  const packIds = new Set();
  const wordIds = new Set();
  const writtenForms = new Set();
  const usedReadingHookReviews = new Set();
  const contextJapanese = new Set();
  const contextEnglish = new Set();

  for (const [packIndex, pack] of value.entries()) {
    if (!pack || typeof pack !== "object" || Array.isArray(pack)) fail(`pack ${packIndex} must be an object`);
    const packId = nonEmptyString(pack.id, `pack ${packIndex}.id`);
    if (packIds.has(packId)) fail(`duplicate pack id ${packId}`);
    packIds.add(packId);
    nonEmptyString(pack.title, `${packId}.title`);
    nonEmptyString(pack.description, `${packId}.description`);
    if (!SCRIPT_TYPES.has(pack.script)) fail(`${packId}.script is invalid`);
    const levelRange = pack.script === "kanji" ? validateLevelRange(pack, packId) : null;
    if (pack.script !== "kanji" && pack.levelRange !== undefined) fail(`${packId}.levelRange is only valid for kanji packs`);
    if (!Array.isArray(pack.words) || pack.words.length < 1) fail(`${packId} has no words`);

    for (const [wordIndex, word] of pack.words.entries()) {
      const path = `${packId}.words[${wordIndex}]`;
      if (!word || typeof word !== "object" || Array.isArray(word)) fail(`${path} must be an object`);
      const wordId = nonEmptyString(word.id, `${path}.id`);
      if (wordIds.has(wordId)) fail(`duplicate word id ${wordId}`);
      wordIds.add(wordId);
      const written = normalized(word.characters, `${wordId}.characters`);
      const reading = normalized(word.reading, `${wordId}.reading`);
      if (writtenForms.has(written)) fail(`duplicate written form ${written}`);
      writtenForms.add(written);
      if (vocabulary.writtenForms.has(written)) fail(`WaniKani already teaches ${written}`);
      const writtenVariants = vocabulary.lexicalWrittenForms.get(lexicalWrittenKey(written))?.filter((candidate) => candidate !== written) ?? [];
      if (writtenVariants.length) fail(`WaniKani already teaches a lexical variant of ${written}: ${writtenVariants.join(", ")}`);
      if (!KANA_READING.test(reading)) fail(`${wordId}.reading must contain kana`);
      const candidateMeanings = new Set(Array.isArray(word.meanings) ? word.meanings.map(meaningKey) : []);
      const sameLexeme = (vocabulary.subjectsByReading.get(readingKey(reading)) ?? []).find((subject) => subject.characters !== written && subject.meanings.some((meaning) => candidateMeanings.has(meaning)));
      if (sameLexeme) fail(`WaniKani already teaches a same-reading, same-meaning form of ${written}: ${sameLexeme.characters} (subject ${sameLexeme.id})`);

      const componentOccurrences = Array.from(written).filter((character) => character !== "々" && HAN_CHARACTER.test(character));
      const componentKanji = [...new Set(componentOccurrences)];
      if (pack.script === "kanji") {
        if (!componentKanji.length) fail(`${wordId} must contain kanji`);
        if (!Number.isInteger(word.requiredLevel) || word.requiredLevel < 1 || word.requiredLevel > 60) fail(`${wordId}.requiredLevel is invalid`);
        if (!word.kanjiLevels || typeof word.kanjiLevels !== "object" || Array.isArray(word.kanjiLevels)) fail(`${wordId}.kanjiLevels is invalid`);
        const mappedKanji = Object.keys(word.kanjiLevels);
        if (mappedKanji.length !== componentKanji.length || componentKanji.some((character) => !mappedKanji.includes(character))) fail(`${wordId}.kanjiLevels must map every component kanji exactly once`);
        const levels = componentKanji.map((character) => {
          const liveLevel = kanji.visibleLevels.get(character);
          if (!liveLevel) fail(`${wordId} uses ${character}, which is absent or hidden in WaniKani`);
          if (word.kanjiLevels[character] !== liveLevel) fail(`${wordId}.kanjiLevels has the wrong live level for ${character}`);
          return liveLevel;
        });
        const requiredLevel = Math.max(...levels);
        if (word.requiredLevel !== requiredLevel) fail(`${wordId}.requiredLevel must equal its highest component-kanji level (${requiredLevel})`);
        if (requiredLevel < levelRange.min || requiredLevel > levelRange.max) fail(`${wordId} is outside ${packId}'s level range`);
      } else {
        if (componentKanji.length) fail(`${wordId} contains kanji but is not in a kanji pack`);
        if (reading !== written) fail(`${wordId} reading must match its visible kana`);
        if (vocabulary.readingForms.has(readingKey(reading))) fail(`WaniKani already teaches a vocabulary reading for ${written}`);
        if (word.requiredLevel !== undefined || word.kanjiLevels !== undefined) fail(`${wordId} has kanji-only metadata`);
      }

      for (const field of ["meanings", "partsOfSpeech"]) {
        if (!Array.isArray(word[field]) || !word[field].length || word[field].some((item) => typeof item !== "string" || !item.trim())) fail(`${wordId}.${field} is invalid`);
      }
      const meaningMnemonic = nonEmptyString(word.meaningMnemonic, `${wordId}.meaningMnemonic`);
      validateMeaningPayoff(meaningMnemonic, word.meanings, `${wordId}.meaningMnemonic`);
      const readingMap = nonEmptyString(word.readingMap, `${wordId}.readingMap`);
      validateReadingMap(readingMap, reading, wordId);
      if (pack.script === "kanji") {
        validateKanjiMeaningMnemonic(meaningMnemonic, wordId, componentKanji, componentOccurrences, kanji.visibleSubjects);
        const readingMnemonic = nonEmptyString(word.readingMnemonic, `${wordId}.readingMnemonic`);
        validateMeaningPayoff(readingMnemonic, word.meanings, `${wordId}.readingMnemonic`);
        validateStoryMnemonic(readingMnemonic, `${wordId}.readingMnemonic`, {
          requireReadingCue: true,
          reading,
          wordId,
          readingHookReviews,
          usedReadingHookReviews,
        });
      } else {
        if (word.readingMnemonic !== undefined) fail(`${wordId}.readingMnemonic must be omitted for kana vocabulary`);
        validateStoryMnemonic(meaningMnemonic, `${wordId}.meaningMnemonic`, {
          requireReadingCue: true,
          reading,
          wordId,
          readingHookReviews,
          usedReadingHookReviews,
        });
      }
      if (!Array.isArray(word.contextSentences) || word.contextSentences.length < 2 || word.contextSentences.length > 3 || word.contextSentences.some((sentence) => !sentence || typeof sentence !== "object" || !String(sentence.ja ?? "").trim() || !String(sentence.en ?? "").trim())) fail(`${wordId}.contextSentences must contain two or three bilingual examples`);
      const wordJapanese = new Set();
      const wordEnglish = new Set();
      for (const [sentenceIndex, sentence] of word.contextSentences.entries()) {
        const sentencePath = `${wordId}.contextSentences[${sentenceIndex}]`;
        const japanese = normalized(sentence.ja, `${sentencePath}.ja`);
        const english = normalized(sentence.en, `${sentencePath}.en`).toLocaleLowerCase("en");
        if (!contextContainsTarget(japanese, written, word.partsOfSpeech)) fail(`${sentencePath}.ja must contain ${written} or a valid inflection`);
        if (wordJapanese.has(japanese) || wordEnglish.has(english)) fail(`${wordId}.contextSentences contains a duplicate example`);
        if (contextJapanese.has(japanese)) fail(`${sentencePath}.ja duplicates another catalog example`);
        if (contextEnglish.has(english)) fail(`${sentencePath}.en duplicates another catalog example`);
        wordJapanese.add(japanese);
        wordEnglish.add(english);
        contextJapanese.add(japanese);
        contextEnglish.add(english);
      }
    }
  }

  if (wordIds.size < MINIMUM_WORDS) fail(`at least ${MINIMUM_WORDS} words are required; found ${wordIds.size}`);
  const unusedReviews = [...readingHookReviews.keys()].filter((id) => !usedReadingHookReviews.has(id));
  if (unusedReviews.length) fail(`reading-hook review snapshot contains stale or unnecessary entries: ${unusedReviews.join(", ")}`);
  return value.map((pack) => ({
    id: pack.id,
    title: pack.title,
    description: pack.description,
    script: pack.script,
    ...(pack.levelRange ? { levelRange: pack.levelRange } : {}),
    words: pack.words.map((word) => ({
      id: word.id,
      characters: word.characters,
      reading: word.reading,
      meanings: word.meanings,
      partsOfSpeech: word.partsOfSpeech,
      meaningMnemonic: word.meaningMnemonic,
      ...(word.readingMnemonic ? { readingMnemonic: word.readingMnemonic } : {}),
      contextSentences: word.contextSentences,
      ...(word.requiredLevel ? { requiredLevel: word.requiredLevel, kanjiLevels: word.kanjiLevels } : {}),
    })),
  }));
}

async function runFixtureValidation() {
  let input = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) input += chunk;
  const fixtures = JSON.parse(input);
  if (!Array.isArray(fixtures)) fail("fixture input must be an array");
  const readingHookReviews = validateReadingHookReviews(JSON.parse(await readFile(readingHookReviewSource, "utf8")));
  const results = fixtures.map((fixture, index) => {
    try {
      const id = nonEmptyString(fixture?.id, `fixture ${index}.id`);
      const reading = normalized(fixture?.reading, `fixture ${index}.reading`);
      const readingMap = nonEmptyString(fixture?.readingMap, `fixture ${index}.readingMap`);
      validateReadingMap(readingMap, reading, id);
      if (fixture?.mnemonic !== undefined) {
        const mnemonic = nonEmptyString(fixture.mnemonic, `fixture ${index}.mnemonic`);
        if (fixture.meanings !== undefined) {
          if (!Array.isArray(fixture.meanings) || !fixture.meanings.length || fixture.meanings.some((meaning) => typeof meaning !== "string" || !meaning.trim())) fail(`fixture ${index}.meanings must contain accepted meanings`);
          validateMeaningPayoff(mnemonic, fixture.meanings, `${id}.mnemonic`);
        }
        validateStoryMnemonic(mnemonic, `${id}.mnemonic`, { requireReadingCue: true, reading, wordId: id, readingHookReviews });
      }
      return { id, valid: true };
    } catch (error) {
      return { id: String(fixture?.id ?? index), valid: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  process.stdout.write(`${JSON.stringify(results)}\n`);
}

async function runSync() {
  const [packValues, vocabularySnapshotText, kanjiSnapshotJson, jmdictSnapshotJson, readingHookReviewJson] = await Promise.all([
    Promise.all(packSources.map(async (path) => topLevelPacks(JSON.parse(await readFile(path, "utf8")), path))),
    readFile(vocabularySnapshotSource, "utf8"),
    readFile(kanjiSnapshotSource, "utf8").then(JSON.parse),
    readFile(jmdictSnapshotSource, "utf8").then(JSON.parse),
    readFile(readingHookReviewSource, "utf8").then(JSON.parse),
  ]);
  const sourcePacks = packValues.flat();
  const vocabularySnapshotJson = JSON.parse(vocabularySnapshotText);
  const vocabulary = validateVocabularySnapshot(vocabularySnapshotJson);
  const kanji = validateKanjiSnapshot(kanjiSnapshotJson);
  const readingHookReviews = validateReadingHookReviews(readingHookReviewJson);
  const packs = validatePacks(sourcePacks, vocabulary, kanji, readingHookReviews);
  const jmdict = validateJmdictSnapshot(jmdictSnapshotJson, sourcePacks, vocabularySnapshotText, vocabulary);
  const validationSnapshot = {
    apiRevision: vocabulary.snapshot.apiRevision,
    vocabulary: {
      dataUpdatedAt: vocabulary.snapshot.dataUpdatedAt,
      subjectCount: vocabulary.snapshot.totalCount,
      excludedWrittenForms: [...vocabulary.writtenForms].sort((left, right) => left.localeCompare(right, "ja")),
      excludedReadings: [...vocabulary.readingForms].sort((left, right) => left.localeCompare(right, "ja")),
    },
    kanji: {
      dataUpdatedAt: kanji.snapshot.dataUpdatedAt,
      subjectCount: kanji.snapshot.totalCount,
      visibleSubjectCount: kanji.visibleLevels.size,
      levels: Object.fromEntries([...kanji.visibleLevels].sort(([left], [right]) => left.localeCompare(right, "ja"))),
    },
    jmdict: {
      createdDate: jmdict.source.jmdictCreatedDate,
      compressedSha256: jmdict.source.compressedSha256,
      verifiedPairCount: jmdict.verification.resolvedWordCount,
      wanikaniEntryFamilySubjectCount: jmdict.wanikaniVocabularyExclusion.subjectCount,
      wanikaniSameEntryCollisionCount: jmdict.wanikaniVocabularyExclusion.sameEntryCollisionCount,
    },
  };

  await mkdir(dirname(catalogTarget), { recursive: true });
  await Promise.all([
    writeFile(catalogTarget, `${JSON.stringify(packs, null, 2)}\n`, "utf8"),
    writeFile(validationTarget, `${JSON.stringify(validationSnapshot, null, 2)}\n`, "utf8"),
  ]);

  const wordCount = packs.reduce((total, pack) => total + pack.words.length, 0);
  console.log(`Synced ${packs.length} packs and ${wordCount} words against ${vocabulary.writtenForms.size} WaniKani vocabulary subjects, ${kanji.visibleLevels.size} visible kanji, and ${jmdict.verification.resolvedWordCount} JMdict pairs.`);
}

if (["--validate-mnemonic-fixtures", "--validate-reading-mnemonics"].includes(process.argv[2])) await runFixtureValidation();
else await runSync();
