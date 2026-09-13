import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PronunciationAudio } from "@/types/wanikani";
import { checkAnswer } from "@/features/core-study/answer-checker";
import { kindsForSubject } from "@/features/core-study/queue";
import { customAssignmentToWaniKani, customSubjectId, customWordToSubject, customWordUsesKanji } from "./subject-adapter";

const audioMock = vi.hoisted(() => vi.fn<() => PronunciationAudio[]>(() => []));
vi.mock("./audio", () => ({ customVocabularyAudio: audioMock }));

const word = {
  id: "pack:メモ",
  characters: "メモ",
  reading: "メモ",
  meanings: ["note", "memo"],
  partsOfSpeech: ["noun"],
  meaningMnemonic: "Make a memo so the note is not forgotten.",
  readingMnemonic: "It is already written in kana.",
  contextSentences: [{ ja: "メモを取ります。", en: "I take a note." }],
};

describe("custom vocabulary subject adapter", () => {
  beforeEach(() => audioMock.mockReset().mockReturnValue([]));

  it("attaches published pronunciation without adding kana reading metadata", () => {
    const audio: PronunciationAudio = {
      url: "https://example.supabase.co/storage/v1/object/public/custom-vocabulary-audio/memo.mp3",
      content_type: "audio/mpeg",
      metadata: { gender: "female", source_id: 15, pronunciation: "メモ", voice_actor_id: 15, voice_actor_name: "Shizuka", voice_description: "AI-generated" },
    };
    audioMock.mockReturnValue([audio]);
    const subject = customWordToSubject(word);
    expect(audioMock).toHaveBeenCalledWith(word.id);
    expect(subject.data.pronunciation_audios).toEqual([audio]);
    expect(subject.data.readings).toBeUndefined();
  });

  it("builds a stable kana-vocabulary subject compatible with the shared answer checker", () => {
    const subject = customWordToSubject(word);
    expect(customSubjectId(word.id)).toBe(customSubjectId(word.id));
    expect(subject).toMatchObject({ object: "kana_vocabulary", data: { characters: "メモ", parts_of_speech: ["noun"] } });
    expect(subject.data.readings).toBeUndefined();
    expect(subject.data.reading_mnemonic).toBeUndefined();
    expect(checkAnswer(subject, "meaning", "memo").status).toBe("correct");
    expect(checkAnswer(subject, "meaning", "メモ")).toMatchObject({ status: "blocked", message: "You entered the reading, but we want the meaning." });
    expect(kindsForSubject(subject)).toEqual(["meaning"]);
  });

  it("builds kanji words as two-sided vocabulary at their required WaniKani level", () => {
    const kanjiWord = {
      ...word,
      id: "levels-1-10:足音",
      characters: "足音",
      reading: "あしおと",
      meanings: ["Footsteps"],
      requiredLevel: 8,
      kanjiLevels: { "足": 4, "音": 8 },
    };

    const subject = customWordToSubject(kanjiWord);

    expect(customWordUsesKanji(kanjiWord)).toBe(true);
    expect(subject).toMatchObject({ object: "vocabulary", data: { level: 8, characters: "足音" } });
    expect(checkAnswer(subject, "reading", "あしおと").status).toBe("correct");
    expect(kindsForSubject(subject)).toEqual(["meaning", "reading"]);
    expect(customAssignmentToWaniKani({
      wordId: kanjiWord.id,
      packId: "levels-1-10",
      stage: 1,
      availableAt: null,
      startedAt: null,
      burnedAt: null,
      updatedAt: "2026-08-31T00:00:00.000Z",
      correctReviews: 0,
      incorrectReviews: 0,
      card: null,
    }, kanjiWord).data.subject_type).toBe("vocabulary");
  });
});
