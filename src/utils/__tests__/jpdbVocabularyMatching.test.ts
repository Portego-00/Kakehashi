import { getActiveJpdbApiKey } from "../jpdbApi";
import {
  findVocabularyMatchesWithJpdbFirstPass,
  getHighlightSegments,
} from "../textHighlighting";

jest.mock("../jpdbApi", () => ({
  getActiveJpdbApiKey: jest.fn(),
}));

function vocabulary(options: {
  id: number;
  characters: string;
  reading: string;
  meaning: string;
  partOfSpeech: string;
  level?: number;
  secondaryMeanings?: { meaning: string; accepted_answer: boolean }[];
}) {
  return {
    id: options.id,
    object: "vocabulary",
    data: {
      characters: options.characters,
      readings: [{ reading: options.reading, primary: true }],
      meanings: [
        { meaning: options.meaning, primary: true },
        ...(options.secondaryMeanings ?? []).map((meaning) => ({ ...meaning, primary: false })),
      ],
      parts_of_speech: [options.partOfSpeech],
      level: options.level ?? 1,
    },
  };
}

function mockParsedWord(options: {
  surface: string;
  spelling: string;
  reading: string;
  partOfSpeech: string;
  meaning: string;
  additionalMeaningChunks?: string[][];
}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      tokens: [[[0, 0, options.surface.length]]],
      vocabulary: [[
        options.spelling,
        options.reading,
        [options.partOfSpeech],
        [[options.meaning], ...(options.additionalMeaningChunks ?? [])],
      ]],
    }),
  });
}

describe("JPDB vocabulary identity when mapping to WaniKani", () => {
  const originalFetch = global.fetch;
  let testNumber = 0;

  beforeEach(() => {
    // The parser caches by API key and sentence, so repeated homophone examples
    // must get independent responses rather than a previous test's cached parse.
    jest.mocked(getActiveJpdbApiKey).mockResolvedValue(
      `jpdb-vocabulary-matching-${++testNumber}`
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it.each([
    { characters: "楽しい", reading: "たのしい", meaning: "Happy", partOfSpeech: "I-adjective" },
    { characters: "喜ぶ", reading: "よろこぶ", meaning: "To Be Delighted", partOfSpeech: "Godan verb" },
  ])("keeps うれしい instead of selecting unrelated $characters by English meaning", async (subject) => {
    mockParsedWord({
      surface: "うれしい",
      spelling: "うれしい",
      reading: "うれしい",
      partOfSpeech: "adj-i",
      meaning: subject.characters === "楽しい" ? "happy" : "delighted",
    });

    const result = await findVocabularyMatchesWithJpdbFirstPass("うれしい。", [
      vocabulary({ id: 101, ...subject }),
    ]);

    expect(result.vocabularyMatches).toEqual([
      expect.objectContaining({ characters: "うれしい", isWaniKaniSubject: false }),
    ]);
    expect(result.jpdbParsedTokens?.[0].mappedVocabularyId).toBeLessThan(0);
  });

  it("does not replace a kanji dictionary spelling with a different-kanji homophone", async () => {
    mockParsedWord({
      surface: "勤めた",
      spelling: "勤める",
      reading: "つとめる",
      partOfSpeech: "v1",
      meaning: "to work for",
    });

    const result = await findVocabularyMatchesWithJpdbFirstPass("勤めた。", [
      vocabulary({
        id: 102,
        characters: "努める",
        reading: "つとめる",
        meaning: "To Work Hard",
        partOfSpeech: "Ichidan verb",
      }),
    ]);

    expect(result.vocabularyMatches).toEqual([
      expect.objectContaining({ characters: "勤める", isWaniKaniSubject: false }),
    ]);
    expect(result.jpdbParsedTokens?.[0].mappedVocabularyId).toBeLessThan(0);
  });

  it("does not use one shared English word to resolve a kana homophone's sense", async () => {
    mockParsedWord({
      surface: "つとめた",
      spelling: "つとめる",
      reading: "つとめる",
      partOfSpeech: "v1",
      meaning: "to work for",
    });

    const result = await findVocabularyMatchesWithJpdbFirstPass("つとめた。", [
      vocabulary({
        id: 103,
        characters: "努める",
        reading: "つとめる",
        meaning: "To Work Hard",
        partOfSpeech: "Ichidan verb",
      }),
    ]);

    expect(result.vocabularyMatches).toEqual([
      expect.objectContaining({ characters: "つとめる", isWaniKaniSubject: false }),
    ]);
  });

  it("prefers the parsed dictionary spelling over a homophone with a closer English gloss", async () => {
    mockParsedWord({
      surface: "替えた",
      spelling: "替える",
      reading: "かえる",
      partOfSpeech: "v1",
      meaning: "to change",
    });

    const result = await findVocabularyMatchesWithJpdbFirstPass("替えた。", [
      vocabulary({
        id: 108,
        characters: "替える",
        reading: "かえる",
        meaning: "To Replace",
        partOfSpeech: "Ichidan verb",
        level: 22,
      }),
      vocabulary({
        id: 109,
        characters: "変える",
        reading: "かえる",
        meaning: "To Change",
        partOfSpeech: "Ichidan verb",
        level: 15,
      }),
    ]);

    expect(result.vocabularyMatches).toEqual([
      expect.objectContaining({ id: 108, characters: "替える" }),
    ]);
    expect(result.jpdbParsedTokens?.[0].mappedVocabularyId).toBe(108);
  });

  it.each([false, true])("retains ambiguous kana vocabulary regardless of subject order (reverse: %s)", async (reverse) => {
    mockParsedWord({
      surface: "はかる",
      spelling: "はかる",
      reading: "はかる",
      partOfSpeech: "v5r",
      meaning: "to measure",
    });
    const subjects = [
      vocabulary({
        id: 104,
        characters: "測る",
        reading: "はかる",
        meaning: "To Measure",
        partOfSpeech: "Godan verb",
        level: 20,
      }),
      vocabulary({
        id: 105,
        characters: "計る",
        reading: "はかる",
        meaning: "To Measure",
        partOfSpeech: "Godan verb",
        level: 2,
      }),
    ];

    const result = await findVocabularyMatchesWithJpdbFirstPass(
      "はかる。",
      reverse ? subjects.reverse() : subjects
    );

    expect(result.vocabularyMatches).toEqual([
      expect.objectContaining({ characters: "はかる", isWaniKaniSubject: false }),
    ]);
  });

  it("maps a kana word when its reading and complete meaning identify one WaniKani subject", async () => {
    mockParsedWord({
      surface: "うれしい",
      spelling: "うれしい",
      reading: "うれしい",
      partOfSpeech: "adj-i",
      meaning: "happy",
    });

    const result = await findVocabularyMatchesWithJpdbFirstPass("うれしい。", [
      vocabulary({
        id: 106,
        characters: "嬉しい",
        reading: "うれしい",
        meaning: "Happy",
        partOfSpeech: "I-adjective",
      }),
    ]);

    expect(result.vocabularyMatches).toEqual([
      expect.objectContaining({ id: 106, characters: "嬉しい" }),
    ]);
    expect(result.jpdbParsedTokens?.[0].mappedVocabularyId).toBe(106);
  });

  it.each([true, false])("uses secondary shared meanings only when WaniKani accepts them (accepted: %s)", async (accepted) => {
    mockParsedWord({
      surface: "うれしい",
      spelling: "うれしい",
      reading: "うれしい",
      partOfSpeech: "adj-i",
      meaning: "pleased",
      additionalMeaningChunks: [["glad", "delighted"]],
    });

    const result = await findVocabularyMatchesWithJpdbFirstPass("うれしい。", [
      vocabulary({
        id: 110,
        characters: "嬉しい",
        reading: "うれしい",
        meaning: "Happy",
        partOfSpeech: "I-adjective",
        secondaryMeanings: [{ meaning: "Delighted", accepted_answer: accepted }],
      }),
    ]);

    expect(result.vocabularyMatches).toEqual([
      expect.objectContaining(accepted
        ? { id: 110, characters: "嬉しい", meaning: "Happy" }
        : { characters: "うれしい", meaning: "pleased", isWaniKaniSubject: false }),
    ]);
  });

  it("retains the JPDB reading when an identical kanji spelling has a different WaniKani reading", async () => {
    mockParsedWord({
      surface: "生",
      spelling: "生",
      reading: "なま",
      partOfSpeech: "n",
      meaning: "raw",
    });

    const result = await findVocabularyMatchesWithJpdbFirstPass("生。", [
      vocabulary({
        id: 111,
        characters: "生",
        reading: "せい",
        meaning: "Life",
        partOfSpeech: "Noun",
      }),
    ]);

    expect(result.vocabularyMatches).toEqual([
      expect.objectContaining({
        characters: "生",
        readings: [{ reading: "なま", primary: true }],
        isWaniKaniSubject: false,
      }),
    ]);
    expect(result.jpdbParsedTokens?.[0].mappedVocabularyId).toBeLessThan(0);
  });

  it("maps a katakana proper noun when its spelling, reading, and meaning agree", async () => {
    mockParsedWord({
      surface: "アメリカ",
      spelling: "アメリカ",
      reading: "アメリカ",
      partOfSpeech: "n-pr",
      meaning: "America",
    });

    const subject = vocabulary({
      id: 112,
      characters: "アメリカ",
      reading: "アメリカ",
      meaning: "America",
      partOfSpeech: "Proper noun",
    });
    subject.object = "kana_vocabulary";
    const result = await findVocabularyMatchesWithJpdbFirstPass("アメリカ。", [subject]);

    expect(result.vocabularyMatches).toEqual([
      expect.objectContaining({ id: 112, characters: "アメリカ", type: "kana_vocabulary" }),
    ]);
    expect(result.jpdbParsedTokens?.[0].mappedVocabularyId).toBe(112);
  });

  it("maps kana vocabulary without a readings field using its kana characters", async () => {
    mockParsedWord({
      surface: "それ",
      spelling: "其れ",
      reading: "それ",
      partOfSpeech: "pn",
      meaning: "that",
    });

    const result = await findVocabularyMatchesWithJpdbFirstPass("それ。", [{
      id: 113,
      object: "kana_vocabulary",
      data: {
        characters: "それ",
        meanings: [{ meaning: "That", primary: true }],
        parts_of_speech: ["Pronoun"],
        level: 1,
      },
    }]);

    expect(result.vocabularyMatches).toEqual([
      expect.objectContaining({ id: 113, characters: "それ", type: "kana_vocabulary" }),
    ]);
    expect(result.jpdbParsedTokens?.[0].mappedVocabularyId).toBe(113);
  });

  it("matches equivalent katakana and hiragana readings for an exact spelling", async () => {
    mockParsedWord({
      surface: "トランプ",
      spelling: "トランプ",
      reading: "トランプ",
      partOfSpeech: "n",
      meaning: "playing cards",
    });

    const result = await findVocabularyMatchesWithJpdbFirstPass("トランプ。", [
      vocabulary({
        id: 114,
        characters: "トランプ",
        reading: "とらんぷ",
        meaning: "Playing Cards",
        partOfSpeech: "Noun",
      }),
    ]);

    expect(result.vocabularyMatches).toEqual([
      expect.objectContaining({ id: 114, characters: "トランプ" }),
    ]);
    expect(result.jpdbParsedTokens?.[0].mappedVocabularyId).toBe(114);
  });

  it("maps conjugated verbs through the exact dictionary spelling even when English glosses differ", async () => {
    mockParsedWord({
      surface: "食べた",
      spelling: "食べる",
      reading: "たべる",
      partOfSpeech: "v1",
      meaning: "to consume",
    });

    const result = await findVocabularyMatchesWithJpdbFirstPass("食べた。", [
      vocabulary({
        id: 107,
        characters: "食べる",
        reading: "たべる",
        meaning: "To Eat",
        partOfSpeech: "Ichidan verb",
      }),
    ]);

    expect(result.vocabularyMatches).toEqual([
      expect.objectContaining({ id: 107, characters: "食べる" }),
    ]);
    expect(result.jpdbParsedTokens?.[0].mappedVocabularyId).toBe(107);
    expect(getHighlightSegments("食べた。", result.vocabularyMatches)).toContainEqual({
      text: "食べた",
      match: expect.objectContaining({ id: 107 }),
    });
  });
});
