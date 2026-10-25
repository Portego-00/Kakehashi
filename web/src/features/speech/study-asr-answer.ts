import type { Subject } from "@/types/wanikani";
import type { StudyQuestion } from "@/features/study/types";
import type { AsrLanguage } from "./japanese-asr-protocol";

export function studyAsrLanguage(question: StudyQuestion): AsrLanguage {
  return ["meaning", "kana-to-meaning", "listening", "listening-meaning", "audio-vocab"].includes(question.kind) ? "en" : "ja";
}

/** Character questions resolve only an unambiguous catalog reading, never the expected answer. */
export function studyAsrAnswer(question: StudyQuestion, transcript: string, subjects: readonly Subject[]) {
  if (!["kana-to-kanji", "similar-kanji"].includes(question.kind) && !(question.kind === "listening-characters" && question.choices)) return transcript;
  const matches = new Set(subjects.filter(subject => (!question.choices || question.choices.includes(subject.data.characters ?? ""))
    && subject.data.readings?.some(reading => reading.accepted_answer && reading.reading === transcript)).map(subject => subject.data.characters).filter(Boolean));
  return matches.size === 1 ? [...matches][0]! : transcript;
}
