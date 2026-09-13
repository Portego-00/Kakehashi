import { CUSTOM_VOCABULARY_PACKS } from "@/features/custom-srs/catalog";
import { completeCustomLesson, createCustomSrsState, enrollCustomVocabularyPack } from "@/features/custom-srs/model";
import { customSrsStorageKey, saveCustomSrsState } from "@/features/custom-srs/storage";
import { createListRepository, listStorageKey } from "@/features/subjects/lists";
import { getModeDefaultFilters } from "@/features/study/mode-config";
import { loadModeState, saveModeState, loadStudyConfig, saveStudyConfig } from "@/features/study/storage";
import type { StudyDataset } from "@/features/study/types";
import type { ImmersionExample } from "@/features/study/immersion-kit";
import examples from "./study-examples.generated.json";
import { DEMO_USERNAME } from "./runtime";
import { DEMO_SUBJECTS } from "./wanikani";

type DemoExample = ImmersionExample & { source: string };
const listeningExamples = examples as Record<string, DemoExample[]>;

export function demoImmersionExamples(characters: string, sources: string[]): ImmersionExample[] {
  if (sources.includes("!")) return [];
  return (listeningExamples[characters] ?? []).filter((example) => sources.length === 0 || sources.includes("*") || sources.includes(example.source));
}

export function demoListeningDataset(dataset: StudyDataset): StudyDataset {
  return { ...dataset, subjects: dataset.subjects.filter((subject) => subject.data.characters && listeningExamples[subject.data.characters]?.length) };
}

/** Seed once per browser. A subsequent demo visit keeps the visitor's edits. */
export function seedDemoStudy() {
  if (typeof window === "undefined") return;
  const storage = window.localStorage;
  const now = new Date();
  const timestamp = now.toISOString();
  if (!storage.getItem(listStorageKey(DEMO_USERNAME))) {
    const everyday = new Set(["日本", "学校", "先生", "友達", "食べる", "飲む", "読む", "水", "猫", "犬", "本", "電車"]);
    createListRepository(storage, DEMO_USERNAME).replace([
      { id: "demo-everyday", name: "Everyday Japanese", subjectIds: DEMO_SUBJECTS.filter((subject) => subject.object === "vocabulary" && everyday.has(subject.data.characters ?? "")).map((subject) => subject.id), createdAt: timestamp, updatedAt: timestamp },
      { id: "demo-level-21", name: "Level 21 practice", subjectIds: DEMO_SUBJECTS.filter((subject) => subject.data.level === 21).slice(0, 20).map((subject) => subject.id), createdAt: timestamp, updatedAt: timestamp },
    ]);
  }
  if (loadModeState(DEMO_USERNAME, "text-analysis", "draft") === null) {
    saveModeState(DEMO_USERNAME, "text-analysis", "draft", "毎日、学校で日本語を勉強します。友達と図書館で本を読みます。");
  }
  if (!loadStudyConfig(DEMO_USERNAME, "listening")) {
    saveStudyConfig(DEMO_USERNAME, "listening", { ...getModeDefaultFilters("listening", 21), animeSources: ["*"], srsGroups: ["apprentice", "guru", "master", "enlightened", "burned"] });
  }
  for (const mode of ["custom-review", "custom-lessons"] as const) {
    if (!loadStudyConfig(DEMO_USERNAME, mode)) {
      const selectedSubjectIds = DEMO_SUBJECTS.filter((subject) => subject.object === "vocabulary" && subject.data.context_sentences?.length).slice(0, 10).map((subject) => subject.id);
      saveStudyConfig(DEMO_USERNAME, mode, { ...getModeDefaultFilters(mode, 21), selectedSubjectIds });
    }
  }
  if (!storage.getItem(customSrsStorageKey(DEMO_USERNAME))) {
    const pack = CUSTOM_VOCABULARY_PACKS.find((item) => item.words.length >= 8 && item.words.every((word) => (word.requiredLevel ?? 1) <= 21));
    if (pack) {
      const yesterday = new Date(now.getTime() - 86_400_000);
      let state = enrollCustomVocabularyPack(createCustomSrsState(yesterday), pack, yesterday);
      for (const word of pack.words.slice(0, 4)) state = completeCustomLesson(state, word.id, yesterday);
      saveCustomSrsState(storage, DEMO_USERNAME, state);
    }
  }
}
