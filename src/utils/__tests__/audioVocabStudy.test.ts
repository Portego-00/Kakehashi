import { createAudioVocabCard, type AudioVocabSource } from "../audioVocabStudy";

const subject = {
  id: 1,
  object: "vocabulary",
  data: {
    characters: "猫",
    meanings: [{ meaning: "Cat", primary: true, accepted_answer: true }],
    readings: [{ reading: "ねこ", primary: true, accepted_answer: true }],
    pronunciation_audios: [
      {
        url: "https://example.com/neko.mp3",
        content_type: "audio/mpeg",
        metadata: { pronunciation: "ねこ", gender: "female" },
      },
    ],
  },
};

describe("audio vocabulary practice", () => {
  it("defaults an optional source in a saved config to the original recording", () => {
    const config: { audioSource?: AudioVocabSource } = {};
    const card = createAudioVocabCard(subject, undefined, config.audioSource);
    expect(card?.audio?.url).toBe("https://example.com/neko.mp3");
    expect(card?.sentence).toBeUndefined();
  });
  it("uses context sentences without requiring a WaniKani recording and still answers the word's meaning", () => {
    const card = createAudioVocabCard({ ...subject, data: {
      ...subject.data, pronunciation_audios: [], context_sentences: [{ ja: "  ", en: "" }, { ja: "猫がいます。", en: "There is a cat." }],
    } }, "female", "sentence");
    expect(card).toMatchObject({ reading: "ねこ", meanings: ["Cat"], sentence: { ja: "猫がいます。" } });
    expect(card?.audio).toBeUndefined();
    expect(createAudioVocabCard(subject, "female", "sentence")).toBeNull();
  });
  it("requires a vocabulary recording and accepts kana vocabulary without readings", () => {
    expect(createAudioVocabCard({ ...subject, object: "kanji" })).toBeNull();
    expect(
      createAudioVocabCard({
        ...subject,
        data: { ...subject.data, pronunciation_audios: [] },
      }),
    ).toBeNull();
    expect(
      createAudioVocabCard({
        ...subject,
        data: { ...subject.data, hidden_at: "2026-09-01" },
      }),
    ).toBeNull();
    expect(
      createAudioVocabCard({
        ...subject,
        object: "kana_vocabulary",
        data: { ...subject.data, readings: [] },
      }),
    ).toMatchObject({ reading: "ねこ", meanings: ["Cat"] });
  });

  it("uses the selected recording's pronunciation on the answer side", () => {
    const male = {
      url: "https://example.com/male.mp3",
      content_type: "audio/mpeg",
      metadata: { gender: "male", pronunciation: "ねこ" },
    };
    expect(
      createAudioVocabCard(
        {
          ...subject,
          data: {
            ...subject.data,
            pronunciation_audios: [...subject.data.pronunciation_audios, male],
          },
        },
        "male",
      )?.audio,
    ).toBe(male);
  });
});
