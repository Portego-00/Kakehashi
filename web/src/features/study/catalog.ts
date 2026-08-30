import type { LucideIcon } from "lucide-react";
import {
  AudioLines,
  BookOpen,
  BrainCircuit,
  Brush,
  Clock3,
  Dices,
  FileText,
  Grid3X3,
  Languages,
  Library,
  ListChecks,
  MessageSquareText,
  Puzzle,
  Repeat2,
  Search,
} from "lucide-react";
import type { StudyModeId } from "./types";

export type StudyModeGroup = "Quick practice" | "Language skills" | "Games & tools" | "Your library";

export interface StudyModeDefinition {
  id: StudyModeId;
  title: string;
  description: string;
  group: StudyModeGroup;
  icon: LucideIcon;
  accent: "radical" | "kanji" | "vocabulary" | "lesson" | "review";
  resumable: boolean;
  shortcut?: string;
}

export const STUDY_MODES: StudyModeDefinition[] = [
  { id: "recent-lessons", title: "Recent lessons", description: "Revisit newly unlocked subjects while they are still fresh.", group: "Quick practice", icon: Clock3, accent: "lesson", resumable: true, shortcut: "R" },
  { id: "random-test", title: "Random test", description: "Mix meanings and readings across any learned subjects.", group: "Quick practice", icon: Dices, accent: "review", resumable: true },
  { id: "vocab-reading", title: "Vocab reading", description: "See an English meaning and produce its kana reading.", group: "Language skills", icon: Languages, accent: "vocabulary", resumable: true },
  { id: "hiragana-meaning", title: "Hiragana vocab", description: "Read a kana prompt and recall its English meaning.", group: "Language skills", icon: FileText, accent: "vocabulary", resumable: true },
  { id: "similar-kanji", title: "Similar kanji", description: "Pair lookalike kanji with their meanings using Niai or WaniKani groups.", group: "Language skills", icon: Puzzle, accent: "kanji", resumable: true },
  { id: "kana-to-kanji", title: "Kana to kanji", description: "Turn a vocabulary reading back into its written form.", group: "Language skills", icon: Repeat2, accent: "kanji", resumable: true },
  { id: "listening", title: "Listening practice", description: "Study vocabulary in anime scenes or WaniKani audio, by choice or typing.", group: "Language skills", icon: AudioLines, accent: "vocabulary", resumable: true, shortcut: "L" },
  { id: "context-sentences", title: "Context sentences", description: "Restore vocabulary, then inspect the sentence's words and grammar cues.", group: "Language skills", icon: MessageSquareText, accent: "vocabulary", resumable: true },
  { id: "text-analysis", title: "Japanese text", description: "Analyze pasted Japanese with library matches, grammar cues, and translation.", group: "Games & tools", icon: BrainCircuit, accent: "radical", resumable: false },
  { id: "kanji-writing", title: "Kanji writing", description: "Practice guided stroke order or freehand kanji recall.", group: "Language skills", icon: Brush, accent: "kanji", resumable: true },
  { id: "crossword", title: "Crossword", description: "Solve English clues on an intersecting hiragana grid.", group: "Games & tools", icon: Grid3X3, accent: "vocabulary", resumable: true },
  { id: "word-search", title: "Word search", description: "Find kana from kanji clues, or written vocabulary from its reading.", group: "Games & tools", icon: Search, accent: "vocabulary", resumable: true },
  { id: "kana-wordle", title: "Kana Wordle", description: "Find a vocabulary reading using positional kana clues.", group: "Games & tools", icon: ListChecks, accent: "vocabulary", resumable: true },
  { id: "custom-review", title: "Custom review", description: "Select exactly which subjects to quiz and how to quiz them.", group: "Your library", icon: ListChecks, accent: "review", resumable: true },
  { id: "custom-lessons", title: "Custom lessons", description: "Build a focused lesson batch from any available subjects.", group: "Your library", icon: BookOpen, accent: "lesson", resumable: true },
  { id: "subject-lists", title: "Subject lists", description: "Create reusable collections for lessons, reviews, and games.", group: "Your library", icon: Library, accent: "radical", resumable: false },
];

export const STUDY_MODE_IDS = new Set<StudyModeId>(STUDY_MODES.map((mode) => mode.id));

export function isStudyModeId(value: string): value is StudyModeId {
  return STUDY_MODE_IDS.has(value as StudyModeId);
}

export function getStudyMode(id: StudyModeId) {
  return STUDY_MODES.find((mode) => mode.id === id)!;
}
