import { describe, expect, it } from "@jest/globals";
import {
  getFilteredPronunciationAudios,
  getUniquePronunciationAudiosByVoiceActor,
  pickPreferredPronunciationAudios,
  pickPreferredPronunciationAudio,
  sortPronunciationAudiosByReadingAndGender,
  type PronunciationAudio,
  type SubjectReading,
} from "../pronunciationAudio";

const everyMonthReadings: SubjectReading[] = [
  {
    reading: "まいつき",
    primary: true,
    accepted_answer: true,
  },
];

const everyMonthAudios: PronunciationAudio[] = [
  {
    url: "female-maitsuki.mp3",
    content_type: "audio/mpeg",
    metadata: {
      gender: "female",
      pronunciation: "まいつき",
      voice_actor_id: 1,
      voice_actor_name: "Kyoko",
    },
  },
  {
    url: "male-maigetsu.mp3",
    content_type: "audio/mpeg",
    metadata: {
      gender: "male",
      pronunciation: "まいげつ",
      voice_actor_id: 2,
      voice_actor_name: "Kenichi",
    },
  },
  {
    url: "male-maitsuki.mp3",
    content_type: "audio/mpeg",
    metadata: {
      gender: "male",
      pronunciation: "まいつき",
      voice_actor_id: 2,
      voice_actor_name: "Kenichi",
    },
  },
];

describe("pronunciationAudio", () => {
  it("filters out audio entries that do not match accepted readings", () => {
    const filtered = getFilteredPronunciationAudios(
      everyMonthAudios,
      everyMonthReadings,
      { preferredContentType: "audio/mpeg" }
    );

    expect(filtered.map((audio) => audio.url)).toEqual([
      "female-maitsuki.mp3",
      "male-maitsuki.mp3",
    ]);
  });

  it("keeps only one entry per voice actor after filtering", () => {
    const uniqueByActor = getUniquePronunciationAudiosByVoiceActor(
      everyMonthAudios,
      everyMonthReadings,
      { preferredContentType: "audio/mpeg" }
    );

    expect(uniqueByActor.map((audio) => audio.url)).toEqual([
      "female-maitsuki.mp3",
      "male-maitsuki.mp3",
    ]);
  });

  it("selects the preferred gender while still honoring reading filters", () => {
    const preferredMale = pickPreferredPronunciationAudio(
      everyMonthAudios,
      everyMonthReadings,
      "male",
      { preferredContentType: "audio/mpeg" }
    );

    expect(preferredMale?.url).toBe("male-maitsuki.mp3");
  });

  it("selects one random reading-matched audio when random mode is enabled", () => {
    const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.9);

    const randomSelection = pickPreferredPronunciationAudios(
      everyMonthAudios,
      everyMonthReadings,
      "random",
      { preferredContentType: "audio/mpeg" }
    );

    expect(randomSelection.map((audio) => audio.url)).toEqual([
      "male-maitsuki.mp3",
    ]);

    randomSpy.mockRestore();
  });

  it("returns both female and male audio when both mode is enabled", () => {
    const bothSelection = pickPreferredPronunciationAudios(
      everyMonthAudios,
      everyMonthReadings,
      "both",
      { preferredContentType: "audio/mpeg" }
    );

    expect(bothSelection.map((audio) => audio.url)).toEqual([
      "female-maitsuki.mp3",
      "male-maitsuki.mp3",
    ]);
  });

  it("falls back to preferred voice when pronunciation metadata is missing", () => {
    const audiosWithoutPronunciation: PronunciationAudio[] = [
      {
        url: "female-no-pronunciation.mp3",
        content_type: "audio/mpeg",
        metadata: {
          gender: "female",
          voice_actor_name: "Kyoko",
        },
      },
      {
        url: "male-no-pronunciation.mp3",
        content_type: "audio/mpeg",
        metadata: {
          gender: "male",
          voice_actor_name: "Kenichi",
        },
      },
    ];

    const preferredMale = pickPreferredPronunciationAudio(
      audiosWithoutPronunciation,
      everyMonthReadings,
      "male",
      { preferredContentType: "audio/mpeg" }
    );

    expect(preferredMale?.url).toBe("male-no-pronunciation.mp3");
  });

  it("orders pronunciation audio by reading order and male-first gender order", () => {
    const readings: SubjectReading[] = [
      { reading: "できあがる", primary: true, accepted_answer: true },
      { reading: "できあがり", primary: false, accepted_answer: true },
    ];

    const audios: PronunciationAudio[] = [
      {
        url: "female-reading-2.mp3",
        content_type: "audio/mpeg",
        metadata: {
          gender: "female",
          pronunciation: "できあがり",
        },
      },
      {
        url: "male-reading-1.mp3",
        content_type: "audio/mpeg",
        metadata: {
          gender: "male",
          pronunciation: "できあがる",
        },
      },
      {
        url: "female-reading-1.mp3",
        content_type: "audio/mpeg",
        metadata: {
          gender: "female",
          pronunciation: "できあがる",
        },
      },
      {
        url: "male-reading-2.mp3",
        content_type: "audio/mpeg",
        metadata: {
          gender: "male",
          pronunciation: "できあがり",
        },
      },
    ];

    const sorted = sortPronunciationAudiosByReadingAndGender(audios, readings);

    expect(sorted.map((audio) => audio.url)).toEqual([
      "male-reading-1.mp3",
      "female-reading-1.mp3",
      "male-reading-2.mp3",
      "female-reading-2.mp3",
    ]);
  });
});
