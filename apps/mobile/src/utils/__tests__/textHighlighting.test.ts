import {
  findVocabularyMatches,
  findVocabularyMatchesWithJpdbFirstPass,
  getVerbInflectionLabelsForMatch,
  getHighlightSegments,
} from "../textHighlighting";

type MockSubject = {
  id: number;
  object: "vocabulary" | "kana_vocabulary" | "kanji";
  data: {
    characters: string;
    level: number;
    meanings: { meaning: string; primary?: boolean }[];
    readings?: { reading: string; primary?: boolean }[];
    parts_of_speech?: string[] | null;
  };
};

function createVocabularySubject(options: {
  id: number;
  characters: string;
  meaning: string;
  partsOfSpeech?: string[] | null;
  readings?: string[];
}): MockSubject {
  return {
    id: options.id,
    object: "vocabulary",
    data: {
      characters: options.characters,
      level: 6,
      meanings: [{ meaning: options.meaning, primary: true }],
      readings:
        options.readings?.map((reading, index) => ({
          reading,
          primary: index === 0,
        })) || [{ reading: "dummy", primary: true }],
      parts_of_speech: options.partsOfSpeech ?? null,
    },
  };
}

function createKanjiSubject(options: {
  id: number;
  characters: string;
  meaning: string;
}): MockSubject {
  return {
    id: options.id,
    object: "kanji",
    data: {
      characters: options.characters,
      level: 1,
      meanings: [{ meaning: options.meaning, primary: true }],
      readings: [{ reading: "dummy", primary: true }],
    },
  };
}

describe("textHighlighting verb inflection matching", () => {
  const originalFetch = global.fetch;
  const originalJpdbPublicKey = process.env.EXPO_PUBLIC_JPDB_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.EXPO_PUBLIC_JPDB_API_KEY = originalJpdbPublicKey;
    jest.restoreAllMocks();
  });

  it("matches 食べた as 食べる vocabulary and avoids kanji-only overlap", () => {
    const sentence = "昨日は魚を食べた。";
    const subjects: MockSubject[] = [
      createVocabularySubject({
        id: 100,
        characters: "食べる",
        meaning: "to eat",
        partsOfSpeech: ["Ichidan verb"],
      }),
      createKanjiSubject({ id: 200, characters: "食", meaning: "eat" }),
    ];

    const { vocabularyMatches, kanjiMatches } = findVocabularyMatches(
      sentence,
      subjects
    );

    expect(vocabularyMatches.map((match) => match.id)).toContain(100);

    const segments = getHighlightSegments(sentence, [
      ...vocabularyMatches,
      ...kanjiMatches,
    ]);

    expect(
      segments.some((segment) => segment.match?.id === 100 && segment.text === "食べた")
    ).toBe(true);
    expect(
      segments.some((segment) => segment.match?.id === 200 && segment.text === "食")
    ).toBe(false);
  });

  it("does not apply conjugation matching to non-verb vocabulary", () => {
    const sentence = "そう思った。";
    const subjects: MockSubject[] = [
      createVocabularySubject({
        id: 101,
        characters: "思い",
        meaning: "thought",
        partsOfSpeech: ["Noun"],
      }),
    ];

    const { vocabularyMatches } = findVocabularyMatches(sentence, subjects);

    expect(vocabularyMatches).toHaveLength(0);
  });

  it("falls back to verb-meaning heuristic when part of speech is missing", () => {
    const sentence = "公園で走った。";
    const subjects: MockSubject[] = [
      createVocabularySubject({
        id: 102,
        characters: "走る",
        meaning: "to run",
        partsOfSpeech: null,
      }),
    ];

    const { vocabularyMatches, kanjiMatches } = findVocabularyMatches(
      sentence,
      subjects
    );

    expect(vocabularyMatches.map((match) => match.id)).toContain(102);

    const segments = getHighlightSegments(sentence, [
      ...vocabularyMatches,
      ...kanjiMatches,
    ]);

    expect(
      segments.some((segment) => segment.match?.id === 102 && segment.text === "走った")
    ).toBe(true);
  });

  it("still recognizes verb-like dictionary forms when POS metadata is missing", () => {
    const sentence = "日本に住む人が資料を調べて、最後に思います。";
    const subjects: MockSubject[] = [
      createVocabularySubject({
        id: 110,
        characters: "住む",
        meaning: "reside",
        partsOfSpeech: null,
        readings: ["すむ"],
      }),
      createVocabularySubject({
        id: 111,
        characters: "調べる",
        meaning: "investigate",
        partsOfSpeech: null,
        readings: ["しらべる"],
      }),
      createVocabularySubject({
        id: 112,
        characters: "思う",
        meaning: "think",
        partsOfSpeech: null,
        readings: ["おもう"],
      }),
      createKanjiSubject({ id: 312, characters: "住", meaning: "reside" }),
      createKanjiSubject({ id: 313, characters: "調", meaning: "investigate" }),
      createKanjiSubject({ id: 314, characters: "思", meaning: "think" }),
    ];

    const { vocabularyMatches, kanjiMatches } = findVocabularyMatches(
      sentence,
      subjects
    );
    const segments = getHighlightSegments(sentence, [
      ...vocabularyMatches,
      ...kanjiMatches,
    ]);

    expect(
      segments.some((segment) => segment.match?.id === 110 && segment.text === "住む")
    ).toBe(true);
    expect(
      segments.some((segment) => segment.match?.id === 111 && segment.text === "調べて")
    ).toBe(true);
    expect(
      segments.some((segment) => segment.match?.id === 112 && segment.text === "思います")
    ).toBe(true);
    expect(
      segments.some((segment) => segment.match?.id === 312 && segment.text === "住")
    ).toBe(false);
    expect(
      segments.some((segment) => segment.match?.id === 313 && segment.text === "調")
    ).toBe(false);
    expect(
      segments.some((segment) => segment.match?.id === 314 && segment.text === "思")
    ).toBe(false);
  });

  it("matches godan conjugations like 書いた and 書ける", () => {
    const sentence = "昨日は日記を書いたので、今は書ける。";
    const subjects: MockSubject[] = [
      createVocabularySubject({
        id: 103,
        characters: "書く",
        meaning: "to write",
        partsOfSpeech: ["Godan verb"],
      }),
    ];

    const { vocabularyMatches, kanjiMatches } = findVocabularyMatches(
      sentence,
      subjects
    );
    const segments = getHighlightSegments(sentence, [
      ...vocabularyMatches,
      ...kanjiMatches,
    ]);

    expect(
      segments.some((segment) => segment.match?.id === 103 && segment.text === "書いた")
    ).toBe(true);
    expect(
      segments.some((segment) => segment.match?.id === 103 && segment.text === "書ける")
    ).toBe(true);
  });

  it("matches suru compounds like 勉強した", () => {
    const sentence = "毎日、図書館で勉強した。";
    const subjects: MockSubject[] = [
      createVocabularySubject({
        id: 104,
        characters: "勉強する",
        meaning: "to study",
        partsOfSpeech: ["Suru verb"],
      }),
    ];

    const { vocabularyMatches, kanjiMatches } = findVocabularyMatches(
      sentence,
      subjects
    );
    const segments = getHighlightSegments(sentence, [
      ...vocabularyMatches,
      ...kanjiMatches,
    ]);

    expect(
      segments.some((segment) => segment.match?.id === 104 && segment.text === "勉強した")
    ).toBe(true);
  });

  it("matches kuru conjugations written with kanji like 来た", () => {
    const sentence = "先生が教室に来た。";
    const subjects: MockSubject[] = [
      createVocabularySubject({
        id: 105,
        characters: "来る",
        meaning: "to come",
        partsOfSpeech: ["Kuru verb"],
      }),
    ];

    const { vocabularyMatches, kanjiMatches } = findVocabularyMatches(
      sentence,
      subjects
    );
    const segments = getHighlightSegments(sentence, [
      ...vocabularyMatches,
      ...kanjiMatches,
    ]);

    expect(
      segments.some((segment) => segment.match?.id === 105 && segment.text === "来た")
    ).toBe(true);
  });

  it("handles the NHK article edge cases for verb highlighting", () => {
    const sentence = `日本に住む外国人の子どもが増えています。NHKが、0歳から14歳までの国のデータを調べてわかりました。専門家は、「これからも外国人の子どもが増えていくと思います」と話しています。`;
    const subjects: MockSubject[] = [
      createVocabularySubject({
        id: 201,
        characters: "住む",
        meaning: "to reside",
        partsOfSpeech: ["Godan verb"],
        readings: ["すむ"],
      }),
      createVocabularySubject({
        id: 202,
        characters: "増える",
        meaning: "to increase",
        partsOfSpeech: ["Ichidan verb"],
        readings: ["ふえる"],
      }),
      createVocabularySubject({
        id: 203,
        characters: "調べる",
        meaning: "to investigate",
        partsOfSpeech: ["Ichidan verb"],
        readings: ["しらべる"],
      }),
      createVocabularySubject({
        id: 204,
        characters: "分かる",
        meaning: "to understand",
        partsOfSpeech: ["Godan verb"],
        readings: ["わかる"],
      }),
      createVocabularySubject({
        id: 205,
        characters: "思う",
        meaning: "to think",
        partsOfSpeech: ["Godan verb"],
        readings: ["おもう"],
      }),
      createVocabularySubject({
        id: 206,
        characters: "する",
        meaning: "to do",
        partsOfSpeech: ["Suru verb"],
        readings: ["する"],
      }),
      createKanjiSubject({ id: 301, characters: "住", meaning: "reside" }),
      createKanjiSubject({ id: 302, characters: "増", meaning: "increase" }),
      createKanjiSubject({ id: 303, characters: "調", meaning: "investigate" }),
      createKanjiSubject({ id: 304, characters: "思", meaning: "think" }),
    ];

    const { vocabularyMatches, kanjiMatches } = findVocabularyMatches(
      sentence,
      subjects
    );
    const segments = getHighlightSegments(sentence, [
      ...vocabularyMatches,
      ...kanjiMatches,
    ]);

    expect(
      segments.some((segment) => segment.match?.id === 201 && segment.text === "住む")
    ).toBe(true);
    expect(
      segments.some(
        (segment) => segment.match?.id === 202 && segment.text === "増えています"
      )
    ).toBe(true);
    expect(
      segments.some(
        (segment) => segment.match?.id === 202 && segment.text === "増えていく"
      )
    ).toBe(true);
    expect(
      segments.some((segment) => segment.match?.id === 202 && segment.text === "増えて")
    ).toBe(false);
    expect(
      segments.some(
        (segment) => segment.match?.id === 203 && segment.text === "調べて"
      )
    ).toBe(true);
    expect(
      segments.some(
        (segment) => segment.match?.id === 204 && segment.text === "わかりました"
      )
    ).toBe(true);
    expect(
      segments.some(
        (segment) => segment.match?.id === 205 && segment.text === "思います"
      )
    ).toBe(true);

    // Regression: avoid highlighting bare した as する inside わかりました.
    expect(
      segments.some((segment) => segment.match?.id === 206 && segment.text === "した")
    ).toBe(false);

    expect(
      segments.some((segment) => segment.match?.id === 301 && segment.text === "住")
    ).toBe(false);
    expect(
      segments.some((segment) => segment.match?.id === 303 && segment.text === "調")
    ).toBe(false);
    expect(
      segments.some((segment) => segment.match?.id === 304 && segment.text === "思")
    ).toBe(false);
  });

  it("returns useful inflection labels for tooltip metadata", () => {
    const sentence = "増えています。思います。";
    const subjects: MockSubject[] = [
      createVocabularySubject({
        id: 207,
        characters: "増える",
        meaning: "to increase",
        partsOfSpeech: ["Ichidan verb"],
        readings: ["ふえる"],
      }),
      createVocabularySubject({
        id: 208,
        characters: "思う",
        meaning: "to think",
        partsOfSpeech: ["Godan verb"],
        readings: ["おもう"],
      }),
    ];

    const { vocabularyMatches, kanjiMatches } = findVocabularyMatches(
      sentence,
      subjects
    );
    const segments = getHighlightSegments(sentence, [
      ...vocabularyMatches,
      ...kanjiMatches,
    ]);

    const teIruSegment = segments.find(
      (segment) => segment.match?.id === 207 && segment.text === "増えています"
    );
    const masuSegment = segments.find(
      (segment) => segment.match?.id === 208 && segment.text === "思います"
    );

    expect(teIruSegment?.match).toBeDefined();
    expect(masuSegment?.match).toBeDefined();

    const teIruLabels = getVerbInflectionLabelsForMatch(
      teIruSegment!.match!,
      teIruSegment!.text
    );
    const masuLabels = getVerbInflectionLabelsForMatch(
      masuSegment!.match!,
      masuSegment!.text
    );

    expect(teIruLabels).toEqual(
      expect.arrayContaining(["Te-iru-form", "Masu-form"])
    );
    expect(masuLabels).toEqual(expect.arrayContaining(["Masu-form"]));
  });

  it("avoids matching 亡くなる inside 少なくなりました while still matching なる", () => {
    const sentence = "日本人の子どもは、10年前より260万人ぐらい少なくなりました。";
    const subjects: MockSubject[] = [
      createVocabularySubject({
        id: 209,
        characters: "亡くなる",
        meaning: "to pass away",
        partsOfSpeech: ["Godan verb"],
        readings: ["なくなる"],
      }),
      createVocabularySubject({
        id: 210,
        characters: "成る",
        meaning: "to become",
        partsOfSpeech: ["Godan verb"],
        readings: ["なる"],
      }),
      createVocabularySubject({
        id: 211,
        characters: "少ない",
        meaning: "few",
        partsOfSpeech: ["I-adjective"],
        readings: ["すくない"],
      }),
      createKanjiSubject({ id: 305, characters: "少", meaning: "few" }),
    ];

    const { vocabularyMatches, kanjiMatches } = findVocabularyMatches(
      sentence,
      subjects
    );
    const segments = getHighlightSegments(sentence, [
      ...vocabularyMatches,
      ...kanjiMatches,
    ]);

    expect(
      segments.some(
        (segment) => segment.match?.id === 209 && segment.text.includes("なくなりました")
      )
    ).toBe(false);
    expect(
      segments.some((segment) => segment.match?.id === 210 && segment.text === "なりました")
    ).toBe(true);
  });

  it("returns stable cached highlight segments on repeated calls", () => {
    const sentence = "日本に住む人が調べて思います。";
    const subjects: MockSubject[] = [
      createVocabularySubject({
        id: 310,
        characters: "住む",
        meaning: "to reside",
        partsOfSpeech: ["Godan verb"],
        readings: ["すむ"],
      }),
      createVocabularySubject({
        id: 311,
        characters: "調べる",
        meaning: "to investigate",
        partsOfSpeech: ["Ichidan verb"],
        readings: ["しらべる"],
      }),
      createVocabularySubject({
        id: 312,
        characters: "思う",
        meaning: "to think",
        partsOfSpeech: ["Godan verb"],
        readings: ["おもう"],
      }),
    ];

    const { vocabularyMatches, kanjiMatches } = findVocabularyMatches(
      sentence,
      subjects
    );

    const first = getHighlightSegments(sentence, [
      ...vocabularyMatches,
      ...kanjiMatches,
    ]);
    const second = getHighlightSegments(sentence, [
      ...vocabularyMatches,
      ...kanjiMatches,
    ]);

    expect(second).toEqual(first);
  });

  it("uses JPDB parse output as first pass and maps parsed verbs to WaniKani vocab", async () => {
    process.env.EXPO_PUBLIC_JPDB_API_KEY = "test-jpdb-key";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tokens: [[[0, 0, 3]]],
        vocabulary: [["食べる", "たべる", ["v1"]]],
      }),
    }) as any;

    const sentence = "食べた。";
    const subjects: MockSubject[] = [
      createVocabularySubject({
        id: 801,
        characters: "食べる",
        meaning: "to eat",
        partsOfSpeech: ["Ichidan verb"],
        readings: ["たべる"],
      }),
      createKanjiSubject({ id: 901, characters: "食", meaning: "eat" }),
    ];

    const { vocabularyMatches, kanjiMatches } =
      await findVocabularyMatchesWithJpdbFirstPass(sentence, subjects);
    const segments = getHighlightSegments(sentence, [
      ...vocabularyMatches,
      ...kanjiMatches,
    ]);

    expect(vocabularyMatches.map((match) => match.id)).toContain(801);
    expect(
      segments.some((segment) => segment.match?.id === 801 && segment.text === "食べた")
    ).toBe(true);

    const inflectedSegment = segments.find(
      (segment) => segment.match?.id === 801 && segment.text === "食べた"
    );
    expect(inflectedSegment?.match).toBeDefined();
    expect(
      getVerbInflectionLabelsForMatch(inflectedSegment!.match!, inflectedSegment!.text)
    ).toEqual(expect.arrayContaining(["Past-form"]));
  });

  it("falls back to heuristic matching when JPDB is not configured", async () => {
    delete process.env.EXPO_PUBLIC_JPDB_API_KEY;

    const sentence = "先生が来た。";
    const subjects: MockSubject[] = [
      createVocabularySubject({
        id: 802,
        characters: "来る",
        meaning: "to come",
        partsOfSpeech: ["Kuru verb"],
        readings: ["くる"],
      }),
    ];

    const { vocabularyMatches } = await findVocabularyMatchesWithJpdbFirstPass(
      sentence,
      subjects
    );

    expect(vocabularyMatches.map((match) => match.id)).toContain(802);
  });

  it("maps kana-only adjective tokens to WaniKani kanji vocabulary when lexical meaning matches", async () => {
    process.env.EXPO_PUBLIC_JPDB_API_KEY = "test-jpdb-key";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tokens: [[[0, 0, 4]]],
        vocabulary: [[
          "さみしい",
          "さみしい",
          ["adj-i"],
          [["lonely"]],
        ]],
      }),
    }) as any;

    const sentence = "さみしいです。";
    const subjects: MockSubject[] = [
      createVocabularySubject({
        id: 910,
        characters: "寂しい",
        meaning: "Lonely",
        partsOfSpeech: ["I-adjective"],
        readings: ["さびしい"],
      }),
    ];

    const { vocabularyMatches, kanjiMatches } =
      await findVocabularyMatchesWithJpdbFirstPass(sentence, subjects);
    const segments = getHighlightSegments(sentence, [
      ...vocabularyMatches,
      ...kanjiMatches,
    ]);

    expect(vocabularyMatches.map((match) => match.id)).toContain(910);
    expect(
      segments.some((segment) => segment.match?.id === 910 && segment.text === "さみしい")
    ).toBe(true);
  });

  it("does not map JPDB adverb どう to unrelated WaniKani homophones like 〜道", async () => {
    process.env.EXPO_PUBLIC_JPDB_API_KEY = "test-jpdb-key";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tokens: [[[0, 0, 2]]],
        vocabulary: [[
          "どう",
          "どう",
          ["adv"],
          [["how"]],
        ]],
      }),
    }) as any;

    const sentence = "どう思う？";
    const subjects: MockSubject[] = [
      createVocabularySubject({
        id: 911,
        characters: "〜道",
        meaning: "Method Of",
        partsOfSpeech: ["Noun"],
        readings: ["どう"],
      }),
    ];

    const { vocabularyMatches } = await findVocabularyMatchesWithJpdbFirstPass(
      sentence,
      subjects
    );

    expect(vocabularyMatches.map((match) => match.id)).not.toContain(911);
    expect(
      vocabularyMatches.some(
        (match) => !match.isWaniKaniSubject && match.characters === "どう"
      )
    ).toBe(true);
  });

  it("keeps katakana proper nouns as JPDB-only when WaniKani has no direct lexical match", async () => {
    process.env.EXPO_PUBLIC_JPDB_API_KEY = "test-jpdb-key";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tokens: [[[0, 0, 4], [1, 4, 1], [2, 5, 5]]],
        vocabulary: [
          [
            "アメリカ",
            "アメリカ",
            ["n"],
            [["(United States of) America", "United States", "US", "USA"]],
          ],
          [
            "と",
            "と",
            ["conj", "prt"],
            [["and"]],
          ],
          [
            "イスラエル",
            "イスラエル",
            ["n"],
            [["Israel"]],
          ],
        ],
      }),
    }) as any;

    const sentence = "アメリカとイスラエル";
    const subjects: MockSubject[] = [
      createVocabularySubject({
        id: 920,
        characters: "トランプ",
        meaning: "Deck Of Cards",
        partsOfSpeech: ["Noun"],
        readings: ["トランプ"],
      }),
      createVocabularySubject({
        id: 921,
        characters: "私",
        meaning: "I",
        partsOfSpeech: ["Pronoun"],
        readings: ["わたし"],
      }),
    ];

    const { vocabularyMatches } = await findVocabularyMatchesWithJpdbFirstPass(
      sentence,
      subjects
    );

    expect(vocabularyMatches.map((match) => match.id)).not.toContain(920);
    expect(vocabularyMatches.map((match) => match.id)).not.toContain(921);
    expect(
      vocabularyMatches.some(
        (match) => !match.isWaniKaniSubject && match.characters === "アメリカ"
      )
    ).toBe(true);
    expect(
      vocabularyMatches.some(
        (match) => !match.isWaniKaniSubject && match.characters === "イスラエル"
      )
    ).toBe(true);
  });

  it("keeps JPDB-only vocabulary tokens even when they are not in WaniKani", async () => {
    process.env.EXPO_PUBLIC_JPDB_API_KEY = "test-jpdb-key";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tokens: [[[0, 0, 4]]],
        vocabulary: [[
          "結希",
          "ゆうい",
          ["n"],
          [["Yui (given name)"]],
        ]],
      }),
    }) as any;

    const sentence = "結希さん";
    const subjects: MockSubject[] = [createKanjiSubject({
      id: 980,
      characters: "結",
      meaning: "tie",
    })];

    const { vocabularyMatches } = await findVocabularyMatchesWithJpdbFirstPass(
      sentence,
      subjects
    );

    expect(vocabularyMatches).toHaveLength(1);
    expect(vocabularyMatches[0].characters).toBe("結希");
    expect(vocabularyMatches[0].isWaniKaniSubject).toBe(false);
    expect(vocabularyMatches[0].id).toBeLessThan(0);
    expect(vocabularyMatches[0].jpdbKanjiComposition).toEqual([
      {
        id: 980,
        characters: "結",
        meaning: "tie",
        level: 1,
      },
    ]);
  });
});
