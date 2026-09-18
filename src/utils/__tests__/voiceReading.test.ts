import { getJapaneseVoiceContext, latestJapaneseUtterance, resolveVoiceReading, type VoiceReadingLookup } from "../voiceReading";

const lookup: VoiceReadingLookup = {
  wordReadings: {
    猫: ["ねこ"], 今日: ["きょう"], 大人: ["おとな"],
    日本: ["にほん", "にっぽん"], 語: ["ご"], 食べる: ["たべる"],
    生: ["せい", "しょう", "なま"],
  },
  singleKanjiReadings: { 今: ["こん"], 日: ["にち"], 大: ["だい"], 人: ["じん"] },
};

describe("voice reading conversion", () => {
  it.each([
    ["猫", [], "ねこ"],
    ["ネコ", [], "ねこ"],
    ["ﾈｺ", [], "ねこ"],
    ["日本語", ["にほんご"], "にほんご"],
    ["食べる", [], "たべる"],
    ["お猫", [], "おねこ"],
    ["今日", ["こんにち"], "きょう"],
    ["大人", ["だいじん"], "おとな"],
    ["生", [], null],
    ["生", ["しょう"], "しょう"],
    ["薔薇", ["ねこ"], null],
    ["猫".repeat(81), [], null],
  ])("resolves %s without manufacturing the expected answer", (text, expected, result) => {
    expect(resolveVoiceReading(text as string, expected as string[], lookup)).toBe(result);
  });
});


describe("isolated readings and repeated attempts", () => {
  const single = { wordReadings: { 四: ["よん"] }, singleKanjiReadings: { 四: ["し", "よ", "よん"] } };
  it("uses actual isolated kanji readings without adding missing sounds", () => {
    expect(resolveVoiceReading("四", ["し"], single, { allowIsolatedKanjiReadings: true })).toBe("し");
    expect(resolveVoiceReading("四", ["しき"], single, { allowIsolatedKanjiReadings: true })).toBeNull();
    expect(resolveVoiceReading("四", ["し"], single)).toBe("よん");
    expect(resolveVoiceReading("四四", ["しし"], single, { allowIsolatedKanjiReadings: true })).not.toBe("しし");
  });
  it("hints kana, katakana and the subject spelling", () => {
    expect(getJapaneseVoiceContext(["しき", "しき"], "式")).toEqual(["しき", "シキ", "式"]);
  });
  it.each(["つ", "よ"])("separates two attempts at %s only when timing shows a pause", (kana) => {
    expect(latestJapaneseUtterance(kana + kana, [
      { segment: kana, startTimeMillis: 0, endTimeMillis: 200 },
      { segment: kana, startTimeMillis: 1400, endTimeMillis: 1600 },
    ])).toBe(kana);
    expect(latestJapaneseUtterance(kana + kana, [
      { segment: kana, startTimeMillis: 0, endTimeMillis: 200 },
      { segment: kana, startTimeMillis: 210, endTimeMillis: 400 },
    ])).toBe(kana + kana);
    expect(latestJapaneseUtterance(kana + kana)).toBe(kana + kana);
  });
});
