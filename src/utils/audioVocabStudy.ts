import {
  pickPreferredPronunciationAudio,
  type PronunciationAudio,
  type PronunciationAudioVoicePreference,
} from "./pronunciationAudio";

type AudioVocabSubject = {
  id: number;
  object: string;
  data: {
    hidden_at?: string | null;
    characters?: string | null;
    meanings: { meaning: string; primary: boolean; accepted_answer: boolean }[];
    readings?:
      { reading: string; primary: boolean; accepted_answer: boolean }[] | null;
    pronunciation_audios?: PronunciationAudio[] | null;
    context_sentences?: { ja: string; en?: string }[] | null;
  };
};

export interface AudioVocabCard {
  id: string;
  subjectId: number;
  characters: string;
  reading: string;
  meanings: string[];
  audio: PronunciationAudio;
  sentence?: { ja: string; en?: string };
}

export type AudioVocabSource = "word" | "sentence";
export type AudioVocabSentenceCard = Omit<AudioVocabCard, "audio"> & {
  audio?: PronunciationAudio;
  sentence: { ja: string; en?: string };
};

export function createAudioVocabCard(
  subject: AudioVocabSubject,
  voice?: PronunciationAudioVoicePreference,
  source?: "word",
): AudioVocabCard | null;
export function createAudioVocabCard(
  subject: AudioVocabSubject,
  voice: PronunciationAudioVoicePreference | undefined,
  source: AudioVocabSource | undefined,
): AudioVocabCard | AudioVocabSentenceCard | null;

export function createAudioVocabCard(
  subject: AudioVocabSubject,
  voice: PronunciationAudioVoicePreference = "female",
  source: AudioVocabSource = "word",
): AudioVocabCard | AudioVocabSentenceCard | null {
  if (
    (subject.object !== "vocabulary" && subject.object !== "kana_vocabulary") ||
    subject.data.hidden_at ||
    !subject.data.characters
  )
    return null;
  const audio = pickPreferredPronunciationAudio(
    subject.data.pronunciation_audios?.filter(
      (candidate) => candidate.url.trim().length > 0,
    ),
    subject.data.readings,
    voice,
  );
  const meanings = subject.data.meanings
    .filter((meaning) => meaning.primary || meaning.accepted_answer)
    .map((meaning) => meaning.meaning)
    .filter(Boolean);
  const sentence = source === "sentence"
    ? subject.data.context_sentences?.find((candidate) => candidate.ja?.trim())
    : undefined;
  if (!meanings.length || (source === "sentence" ? !sentence : !audio)) return null;
  const reading = subject.data.readings?.find((reading) => reading.primary)?.reading ?? subject.data.characters;
  const common = {
    id: `${subject.id}:audio-vocab`,
    subjectId: subject.id,
    characters: subject.data.characters,
    meanings,
  };
  if (sentence) return { ...common, reading, sentence: { ...sentence, ja: sentence.ja.trim() } };
  if (!audio) return null;
  return {
    ...common,
    reading:
      audio.metadata?.pronunciation ??
      audio.metadata?.pronounciation ??
      reading,
    audio,
  };
}
