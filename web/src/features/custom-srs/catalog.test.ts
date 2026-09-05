import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import validationSnapshot from "./catalog-validation.generated.json";
import { CUSTOM_VOCABULARY_PACKS, CUSTOM_VOCABULARY_WORDS } from "./catalog";
import { customSubjectId, customWordUsesKanji } from "./subject-adapter";

function normalized(value: string) {
  return value.normalize("NFKC").trim();
}

function readingKey(value: string) {
  return Array.from(normalized(value), (character) => {
    const codePoint = character.codePointAt(0)!;
    return codePoint >= 0x30a1 && codePoint <= 0x30f6
      ? String.fromCodePoint(codePoint - 0x60)
      : character;
  }).join("");
}

function lexicalWrittenKey(value: string) {
  return normalized(value).replace(/^[おご御](?=\p{Script=Han})/u, "").replace(/する$/u, "");
}

function meaningKey(value: string) {
  return normalized(value).toLocaleLowerCase("en").replace(/[^a-z0-9]+/gu, " ").trim();
}

function componentKanji(value: string) {
  return [...new Set(Array.from(value).filter((character) => character !== "々" && /\p{Script=Han}/u.test(character)))];
}

function contextContainsTarget(sentence: string, word: { characters: string; partsOfSpeech: string[] }) {
  const writtenForms = word.characters.startsWith("御") ? [word.characters, `お${word.characters.slice(1)}`, `ご${word.characters.slice(1)}`] : [word.characters];
  if (writtenForms.some((form) => sentence.includes(form))) return true;
  const grammar = word.partsOfSpeech.join(" ").toLocaleLowerCase("en");
  if (/verb/u.test(grammar)) {
    const stems = writtenForms.map((form) => form.endsWith("する") ? form.slice(0, -2) : form.replace(/[うくぐすつぬぶむる]$/u, ""));
    if (stems.some((stem) => stem.length >= 2 && sentence.includes(stem))) return true;
  }
  if (/(?:\bi|い)[ _-]?adjective\b/u.test(grammar) && word.characters.endsWith("い")) {
    const stems = writtenForms.map((form) => form.slice(0, -1));
    if (stems.some((stem) => stem.length >= 2 && sentence.includes(stem))) return true;
  }
  return false;
}

interface MnemonicFixture {
  id: string;
  reading: string;
  readingMap: string;
  meanings?: string[];
  mnemonic?: string;
}

interface ReadingMnemonicValidationResult {
  id: string;
  valid: boolean;
  error?: string;
}

function validateWithProductionGate(fixtures: MnemonicFixture[]) {
  const result = spawnSync(process.execPath, [resolve(process.cwd(), "scripts/sync-custom-vocabulary.mjs"), "--validate-mnemonic-fixtures"], {
    cwd: process.cwd(),
    encoding: "utf8",
    input: JSON.stringify(fixtures),
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Production mnemonic validator failed to run");
  return JSON.parse(result.stdout) as ReadingMnemonicValidationResult[];
}

function productionSourcePacks(includeAuditFields = false) {
  const sourceFiles = [
    "kana-vocabulary-packs.json",
    "custom-vocab-kana-candidates.json",
    "custom-vocab-kana-expansion.json",
    "custom-vocab-kanji-candidates.json",
    "custom-vocab-kanji-expansion.json",
  ];
  return sourceFiles.flatMap((filename) => {
    const value = JSON.parse(readFileSync(resolve(process.cwd(), "../research/data", filename), "utf8")) as unknown;
    const packs = Array.isArray(value) ? value : (value as { packs: unknown[] }).packs;
    return (packs as Array<Record<string, unknown>>).map((pack) => ({
      id: pack.id,
      title: pack.title,
      description: pack.description,
      script: pack.script,
      ...(pack.levelRange ? { levelRange: pack.levelRange } : {}),
      words: (pack.words as Array<Record<string, unknown>>).map((sourceWord) => {
        const word = { ...sourceWord };
        delete word.jmdictPriorityTags;
        if (!includeAuditFields) delete word.readingMap;
        return word;
      }),
    }));
  });
}

describe("custom vocabulary catalog", () => {
  it("ships at least 500 complete words across many variably sized packs", () => {
    expect(CUSTOM_VOCABULARY_PACKS.length).toBeGreaterThanOrEqual(30);
    expect(CUSTOM_VOCABULARY_WORDS.length).toBeGreaterThanOrEqual(500);
    expect(new Set(CUSTOM_VOCABULARY_PACKS.map((pack) => pack.words.length)).size).toBeGreaterThan(1);
    expect(CUSTOM_VOCABULARY_PACKS.some((pack) => pack.words.length !== 16)).toBe(true);
    expect(new Set(CUSTOM_VOCABULARY_PACKS.map((pack) => pack.id)).size).toBe(CUSTOM_VOCABULARY_PACKS.length);
    expect(new Set(CUSTOM_VOCABULARY_WORDS.map((word) => word.id)).size).toBe(CUSTOM_VOCABULARY_WORDS.length);
    expect(new Set(CUSTOM_VOCABULARY_WORDS.map((word) => normalized(word.characters))).size).toBe(CUSTOM_VOCABULARY_WORDS.length);
    expect(new Set(CUSTOM_VOCABULARY_WORDS.map((word) => customSubjectId(word.id))).size).toBe(CUSTOM_VOCABULARY_WORDS.length);
    const contextJapanese = new Set<string>();
    const contextEnglish = new Set<string>();

    const sourceWords = productionSourcePacks(true).flatMap((pack) => pack.words) as Array<Record<string, unknown>>;
    const mnemonicResults = validateWithProductionGate(sourceWords.map((sourceWord) => ({
      id: String(sourceWord.id),
      reading: String(sourceWord.reading),
      readingMap: String(sourceWord.readingMap),
      meanings: sourceWord.meanings as string[],
      mnemonic: String(sourceWord.readingMnemonic ?? sourceWord.meaningMnemonic),
    })));
    expect(mnemonicResults, mnemonicResults.find((result) => !result.valid)?.error).toEqual(
      CUSTOM_VOCABULARY_WORDS.map((word) => ({ id: word.id, valid: true })),
    );

    for (const word of CUSTOM_VOCABULARY_WORDS) {
      if (!customWordUsesKanji(word)) expect(normalized(word.reading)).toBe(normalized(word.characters));
      expect(word.meanings.length).toBeGreaterThan(0);
      expect(word.partsOfSpeech.length).toBeGreaterThan(0);
      expect(word.meaningMnemonic).toMatch(/<vocabulary>[^<]+<\/vocabulary>/);
      expect(customWordUsesKanji(word) ? word.readingMnemonic : word.meaningMnemonic).toMatch(/<reading>[^<]+<\/reading>/);
      if (customWordUsesKanji(word)) {
        expect(word.readingMnemonic).toBeDefined();
        const firstParagraph = word.meaningMnemonic.split(/\n\s*\n/)[0];
        expect(firstParagraph.match(/<kanji>[^<]+<\/kanji>/g)?.length ?? 0, word.characters).toBeGreaterThanOrEqual(componentKanji(word.characters).length);
        expect(word.meaningMnemonic.split(/\n\s*\n/).length, word.characters).toBeGreaterThanOrEqual(2);
      }
      else expect(word.readingMnemonic).toBeUndefined();
      expect(word.meaningMnemonic).not.toContain("Reading map:");
      expect(word.readingMnemonic ?? "").not.toContain("Reading map:");
      expect(word.contextSentences.length, word.characters).toBeGreaterThanOrEqual(2);
      expect(word.contextSentences.length, word.characters).toBeLessThanOrEqual(3);
      expect(new Set(word.contextSentences.map((sentence) => normalized(sentence.ja))).size, word.characters).toBe(word.contextSentences.length);
      expect(new Set(word.contextSentences.map((sentence) => normalized(sentence.en).toLocaleLowerCase("en"))).size, word.characters).toBe(word.contextSentences.length);
      for (const sentence of word.contextSentences) {
        expect(normalized(sentence.ja), `${word.characters}: blank Japanese context`).not.toBe("");
        expect(normalized(sentence.en), `${word.characters}: blank English context`).not.toBe("");
        expect(contextContainsTarget(sentence.ja, word), `${word.characters}: ${sentence.ja}`).toBe(true);
        expect(contextJapanese.has(normalized(sentence.ja)), `duplicate Japanese context: ${sentence.ja}`).toBe(false);
        expect(contextEnglish.has(normalized(sentence.en).toLocaleLowerCase("en")), `duplicate English context: ${sentence.en}`).toBe(false);
        contextJapanese.add(normalized(sentence.ja));
        contextEnglish.add(normalized(sentence.en).toLocaleLowerCase("en"));
      }
    }
  });

  it("matches every production field in the authoritative source catalogs", () => {
    expect(CUSTOM_VOCABULARY_PACKS).toEqual(productionSourcePacks());
  });

  it("keeps exact reading coverage hidden and rejects learner-facing drills", () => {
    const story = "A chef named <reading>KIT</reading> catches a flying letter and <vocabulary>cuts</vocabulary> it in half. This image links the sound to the action.";
    const fixtures: MnemonicFixture[] = [
      { id: "valid-kit", reading: "きって", readingMap: "き・っ・て", meanings: ["Cuts"], mnemonic: story },
      { id: "valid-ohio", reading: "おはよう", readingMap: "お・は・よ・う", meanings: ["Good Morning"], mnemonic: "From <reading>OHIO</reading>, you shout <vocabulary>good morning</vocabulary> through a giant megaphone. Everyone in the state wakes up and shouts it back." },
      { id: "incomplete-yappy", reading: "やっぱり", readingMap: "や・っ・ぱ・り", meanings: ["As Expected"], mnemonic: "A <reading>YAPPY</reading> puppy returns right on schedule. Its return happened <vocabulary>as expected</vocabulary>." },
      { id: "unrelated-zoo", reading: "かな", readingMap: "か・な", meanings: ["Kana"], mnemonic: "A noisy <reading>ZOO</reading> opens a <vocabulary>kana</vocabulary> book. Every animal tries to turn the pages at once." },
      { id: "vowel-only-zoo", reading: "あっ", readingMap: "あ・っ", meanings: ["Surprise"], mnemonic: "A noisy <reading>ZOO</reading> erupts from a tiny box in the kitchen. Everyone gasps in <vocabulary>surprise</vocabulary>." },
      { id: "wrong-meaning-payoff", reading: "かな", readingMap: "か・な", meanings: ["Escalator"], mnemonic: "A <reading>CAN—A</reading> sprouts moving steps in the station. Everyone mistakes the machine for a <vocabulary>staircase</vocabulary>." },
      { id: "masked-wrong-meaning-payoff", reading: "かな", readingMap: "か・な", meanings: ["Kana"], mnemonic: "A <reading>CAN—A</reading> opens a <vocabulary>kana</vocabulary> book beside a moving <vocabulary>staircase</vocabulary>. Every page flies into the air." },
      { id: "invalid-kanji-reading-narrative-payoff", reading: "にゅうしゅ", readingMap: "にゅう・しゅ", meanings: ["Obtain", "Acquire"], mnemonic: "A collector shouts <reading>NEW SHOE!</reading> after opening a locked crate. She can <vocabulary>obtain</vocabulary> the rare shoe, but the story wrongly calls it <vocabulary>received</vocabulary>." },
      { id: "detached-small-kana", reading: "きゃ", readingMap: "き・ゃ" },
      { id: "missing-unit", reading: "かな", readingMap: "か" },
      { id: "added-unit", reading: "かな", readingMap: "か・な・な" },
      { id: "reordered-unit", reading: "かな", readingMap: "な・か" },
      { id: "markup-in-audit-map", reading: "かな", readingMap: "<reading>か・な</reading>" },
      { id: "drill-instead-of-story", reading: "かな", readingMap: "か・な", meanings: ["Kana"], mnemonic: "Say it in 2 beats: <reading>KA-NA</reading>. This means <vocabulary>kana</vocabulary>." },
      { id: "visible-reading-map", reading: "かな", readingMap: "か・な", meanings: ["Kana"], mnemonic: "A <reading>CAN—A</reading> opens into a <vocabulary>kana</vocabulary> book. Reading map: か・な." },
      { id: "missing-sound-hook", reading: "かな", readingMap: "か・な", meanings: ["Kana"], mnemonic: "A can opens into a <vocabulary>kana</vocabulary> book. The pages fly everywhere." },
      { id: "missing-meaning-payoff", reading: "かな", readingMap: "か・な", meanings: ["Kana"], mnemonic: "A <reading>CAN—A</reading> opens into a book. The pages fly everywhere." },
      { id: "not-a-story", reading: "かな", readingMap: "か・な", meanings: ["Kana"], mnemonic: "<reading>CAN—A</reading> means <vocabulary>kana</vocabulary>." },
      { id: "invalid-markup", reading: "かな", readingMap: "か・な", meanings: ["Kana"], mnemonic: "A <reading><kanji>CAN—A</kanji></reading> opens a <vocabulary>kana</vocabulary> book. The pages fly everywhere." },
      { id: "wrong-small-kana-cue", reading: "ちょう", readingMap: "ちょ・う", meanings: ["Summit"], mnemonic: "A dog eats a bowl of <reading>CHOW</reading> on the mountain. It reaches the <vocabulary>summit</vocabulary> after lunch." },
      { id: "false-particle-homophone", reading: "かれは", readingMap: "か・れ・は", meanings: ["Dead Leaf"], mnemonic: "A dry leaf interrupts <reading>彼は（かれは）</reading>. The <vocabulary>dead leaf</vocabulary> falls to the floor." },
    ];
    const results = validateWithProductionGate(fixtures);
    expect(results.slice(0, 2)).toEqual([
      { id: "valid-kit", valid: true },
      { id: "valid-ohio", valid: true },
    ]);
    expect(results.slice(2).every((result) => !result.valid), results.filter((result) => result.valid).map((result) => result.id).join(", ")).toBe(true);
    expect(results.find((result) => result.id === "incomplete-yappy")?.error).toContain("do not cover the complete reading");
    expect(results.find((result) => result.id === "unrelated-zoo")?.error).toContain("do not cover the complete reading");
    expect(results.find((result) => result.id === "vowel-only-zoo")?.error).toContain("do not cover the complete reading");
    expect(results.find((result) => result.id === "wrong-meaning-payoff")?.error).toContain("must tag an exact accepted meaning");
    expect(results.find((result) => result.id === "masked-wrong-meaning-payoff")?.error).toContain("must tag an exact accepted meaning");
    expect(results.find((result) => result.id === "invalid-kanji-reading-narrative-payoff")?.error).toContain("must tag an exact accepted meaning");
  });

  it("accepts only the exact reviewed fingerprint for exceptional reading hooks", () => {
    const base = {
      id: "kana-expansion-sukejuuru",
      reading: "スケジュール",
      readingMap: "ス・ケ・ジュ・ー・ル",
      meanings: ["Schedule"],
    };
    const results = validateWithProductionGate([
      {
        ...base,
        mnemonic: "A giant <reading>SCHEDULE</reading> unrolls across the floor and traps anyone who misses an appointment. Every square records the <vocabulary>schedule</vocabulary> for the week.",
      },
      {
        ...base,
        mnemonic: "A giant <reading>SCHEDULER</reading> unrolls across the floor and traps anyone who misses an appointment. Every square records the <vocabulary>schedule</vocabulary> for the week.",
      },
    ]);
    expect(results[0]).toEqual({ id: base.id, valid: true });
    expect(results[1].valid).toBe(false);
    expect(results[1].error).toContain("do not cover the complete reading");
  });

  it("excludes all ordinary and kana vocabulary in the complete WaniKani snapshot", () => {
    expect(validationSnapshot.apiRevision).toBe("20170710");
    expect(validationSnapshot.vocabulary.subjectCount).toBeGreaterThan(6_000);
    expect(new Set(["御無沙汰", "ご無沙汰"].map(lexicalWrittenKey))).toEqual(new Set(["無沙汰"]));
    const deniedWritten = new Set(validationSnapshot.vocabulary.excludedWrittenForms.map(normalized));
    const deniedLexicalWritten = new Set(validationSnapshot.vocabulary.excludedWrittenForms.map(lexicalWrittenKey));
    const deniedReadings = new Set(validationSnapshot.vocabulary.excludedReadings.map(readingKey));

    for (const word of CUSTOM_VOCABULARY_WORDS) {
      expect(deniedWritten.has(normalized(word.characters)), word.characters).toBe(false);
      expect(deniedLexicalWritten.has(lexicalWrittenKey(word.characters)), word.characters).toBe(false);
      if (!customWordUsesKanji(word)) expect(deniedReadings.has(readingKey(word.reading)), word.characters).toBe(false);
    }
  });

  it("pins accepted WaniKani meanings and excludes same-lexeme spelling variants", () => {
    const snapshot = JSON.parse(readFileSync(resolve(process.cwd(), "../research/data/wanikani-vocabulary-exclusions.snapshot.json"), "utf8")) as {
      totalCount: number;
      subjects: Array<{
        id: number;
        characters: string;
        readings: string[];
        meanings: string[];
      }>;
    };
    expect(snapshot.subjects).toHaveLength(snapshot.totalCount);
    expect(snapshot.subjects.every((subject) => subject.meanings.length > 0)).toBe(true);

    const subjectsByReading = new Map<string, typeof snapshot.subjects>();
    for (const subject of snapshot.subjects) {
      for (const reading of subject.readings) {
        const key = readingKey(reading);
        const bucket = subjectsByReading.get(key) ?? [];
        bucket.push(subject);
        subjectsByReading.set(key, bucket);
      }
    }

    for (const word of CUSTOM_VOCABULARY_WORDS) {
      const candidateMeanings = new Set(word.meanings.map(meaningKey));
      const collision = (subjectsByReading.get(readingKey(word.reading)) ?? []).find((subject) =>
        normalized(subject.characters) !== normalized(word.characters) &&
        subject.meanings.some((meaning) => candidateMeanings.has(meaningKey(meaning))),
      );
      expect(collision, `${word.characters} duplicates WaniKani ${collision?.characters} (#${collision?.id})`).toBeUndefined();
    }
  });

  it("derives every kanji word's ready level from its highest visible WaniKani kanji", () => {
    expect(validationSnapshot.kanji.subjectCount).toBeGreaterThan(2_000);
    expect(validationSnapshot.kanji.visibleSubjectCount).toBeGreaterThan(2_000);
    const levels = validationSnapshot.kanji.levels as Record<string, number>;
    const kanjiPacks = CUSTOM_VOCABULARY_PACKS.filter((pack) => pack.script === "kanji");
    expect(kanjiPacks.length).toBeGreaterThan(0);

    for (const pack of kanjiPacks) {
      expect(pack.levelRange).toBeDefined();
      expect((pack.levelRange!.min - 1) % 5, pack.id).toBe(0);
      expect(pack.levelRange!.max - pack.levelRange!.min, pack.id).toBe(4);
      for (const word of pack.words) {
        const components = componentKanji(word.characters);
        expect(components.length, word.characters).toBeGreaterThan(0);
        expect(Object.keys(word.kanjiLevels ?? {}).sort()).toEqual([...components].sort());
        for (const character of components) expect(word.kanjiLevels?.[character]).toBe(levels[character]);
        expect(word.requiredLevel).toBe(Math.max(...components.map((character) => levels[character])));
        expect(word.requiredLevel).toBeGreaterThanOrEqual(pack.levelRange!.min);
        expect(word.requiredLevel).toBeLessThanOrEqual(pack.levelRange!.max);
      }
    }
  });

  it("uses accepted WaniKani component glosses in every kanji composition mnemonic", () => {
    const snapshot = JSON.parse(readFileSync(resolve(process.cwd(), "../research/data/wanikani-kanji-levels.snapshot.json"), "utf8")) as {
      subjects: Array<{
        characters: string;
        meanings: string[];
        hiddenAt: string | null;
      }>;
    };
    const acceptedMeanings = new Map(snapshot.subjects
      .filter((subject) => subject.hiddenAt === null)
      .map((subject) => [subject.characters, new Set(subject.meanings.map(meaningKey))]));

    for (const word of CUSTOM_VOCABULARY_WORDS.filter(customWordUsesKanji)) {
      const occurrences = Array.from(word.characters).filter((character) => character !== "々" && /\p{Script=Han}/u.test(character));
      const distinct = [...new Set(occurrences)];
      const firstParagraph = word.meaningMnemonic.split(/\n\s*\n/u)[0];
      const cues = [...firstParagraph.matchAll(/<kanji>([^<]+)<\/kanji>/gu)].map((match) => match[1]);
      const cueComponents = cues.length === occurrences.length ? occurrences : cues.length === distinct.length ? distinct : [];
      expect(cueComponents, word.characters).toHaveLength(cues.length);
      for (const [index, component] of cueComponents.entries()) {
        expect(acceptedMeanings.get(component)?.has(meaningKey(cues[index])), `${word.characters}: ${component} cannot use “${cues[index]}”`).toBe(true);
      }
    }
  });
});
