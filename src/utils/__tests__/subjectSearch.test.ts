import { rankSubjectsByQuery, type SearchableSubjectLike } from "../subjectSearch";

const dokidoki: SearchableSubjectLike = {
  id: 9232,
  object: "kana_vocabulary",
  data: {
    level: 21,
    characters: "ドキドキ",
    meanings: [{ meaning: "Pounding Heart", primary: true }],
  },
};

describe("kana subject search", () => {
  it.each(["Dokidoki", "dokidoki", "DOKIDOKI", "どきどき", "ドキドキ", "doki", "どき", "ドキ"])(
    "finds ドキドキ without a readings field when searching %s",
    (query) => {
      expect(rankSubjectsByQuery([dokidoki], query).map(({ subject }) => subject.id)).toEqual([9232]);
    },
  );

  it.each(["fuwafuwa", "FUWAFUWA", "ふわふわ", "フワフワ"])(
    "still finds hiragana characters when searching %s",
    (query) => {
      const fluffy = { ...dokidoki, data: { ...dokidoki.data, characters: "ふわふわ" } };
      expect(rankSubjectsByQuery([fluffy], query).map(({ subject }) => subject.id)).toEqual([fluffy.id]);
    },
  );

  it.each(["amerika", "あめりか", "アメリカ"])(
    "matches katakana readings when searching %s",
    (query) => {
      const america = {
        ...dokidoki,
        object: "vocabulary",
        data: {
          ...dokidoki.data,
          characters: "亜米利加",
          readings: [{ reading: "アメリカ", primary: true }],
        },
      };
      expect(rankSubjectsByQuery([america], query).map(({ subject }) => subject.id)).toEqual([america.id]);
    },
  );

  it("ranks exact kana matches before longer words", () => {
    const longer = { ...dokidoki, id: 1, data: { ...dokidoki.data, characters: "ドキドキする" } };
    expect(rankSubjectsByQuery([longer, dokidoki], "dokidoki").map(({ subject }) => subject.id)).toEqual([9232, 1]);
  });

  it("still matches the English meaning", () => {
    expect(rankSubjectsByQuery([dokidoki], "pounding heart").map(({ subject }) => subject.id)).toEqual([9232]);
  });

  it("does not turn an incomplete English conversion into a kana match", () => {
    const bag = {
      ...dokidoki,
      data: { ...dokidoki.data, characters: "カバン", meanings: [{ meaning: "Bag", primary: true }] },
    };
    expect(rankSubjectsByQuery([bag], "cat")).toEqual([]);
  });
});
