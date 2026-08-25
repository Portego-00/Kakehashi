export type SubjectType = "radical" | "kanji" | "vocabulary" | "kana_vocabulary";

export interface WKResource<T, TObject extends string = string> {
  id: number;
  object: TObject;
  url: string;
  data_updated_at: string;
  data: T;
}

export interface WKCollection<T> {
  object: "collection";
  url: string;
  pages: { next_url: string | null; previous_url: string | null; per_page: number };
  total_count: number;
  data_updated_at: string | null;
  data: T[];
}

export interface WKUserData {
  username: string;
  level: number;
  profile_url: string;
  started_at: string;
  current_vacation_started_at: string | null;
  preferences: { default_voice_actor_id: number; lessons_autoplay_audio: boolean; lessons_batch_size: number; lessons_presentation_order: string; reviews_autoplay_audio: boolean; reviews_display_srs_indicator: boolean };
  subscription: { active: boolean; type: "free" | "recurring" | "lifetime" | "unknown"; max_level_granted: number; period_ends_at: string | null };
}

export type WKUser = WKResource<WKUserData, "user">;

export interface AssignmentData {
  subject_id: number;
  subject_type: SubjectType;
  srs_stage: number;
  available_at: string | null;
  started_at: string | null;
  unlocked_at: string | null;
  passed_at: string | null;
  burned_at: string | null;
  resurrected_at: string | null;
  hidden: boolean;
  created_at: string;
}
export type Assignment = WKResource<AssignmentData, "assignment">;

export interface SubjectMeaning { meaning: string; primary: boolean; accepted_answer: boolean }
export interface SubjectReading { reading: string; primary: boolean; accepted_answer: boolean; type?: "onyomi" | "kunyomi" | "nanori" }
export interface ContextSentence { en: string; ja: string }
export interface PronunciationAudio { url: string; content_type: string; metadata: { gender: string; source_id: number; pronunciation: string; voice_actor_id: number; voice_actor_name: string; voice_description: string } }
export interface SubjectData {
  level: number;
  lesson_position?: number;
  spaced_repetition_system_id?: number;
  created_at: string;
  slug: string;
  document_url: string;
  hidden_at: string | null;
  characters: string | null;
  meanings: SubjectMeaning[];
  auxiliary_meanings: Array<{ meaning: string; type: "whitelist" | "blacklist" }>;
  meaning_mnemonic?: string;
  meaning_hint?: string;
  readings?: SubjectReading[];
  reading_mnemonic?: string;
  reading_hint?: string;
  component_subject_ids?: number[];
  amalgamation_subject_ids?: number[];
  visually_similar_subject_ids?: number[];
  context_sentences?: ContextSentence[];
  pronunciation_audios?: PronunciationAudio[];
  parts_of_speech?: string[];
}
export type Subject = WKResource<SubjectData, SubjectType>;

export interface ReviewStatisticData {
  subject_id: number;
  subject_type: SubjectType;
  meaning_correct: number;
  meaning_incorrect: number;
  meaning_max_streak: number;
  meaning_current_streak: number;
  reading_correct: number;
  reading_incorrect: number;
  reading_max_streak: number;
  reading_current_streak: number;
  percentage_correct: number;
  hidden: boolean;
  created_at: string;
}
export type ReviewStatistic = WKResource<ReviewStatisticData, "review_statistic">;

export interface SummaryData {
  lessons: Array<{ available_at: string; subject_ids: number[] }>;
  reviews: Array<{ available_at: string; subject_ids: number[] }>;
  next_reviews_at: string | null;
}
export interface WKSummary { object: "report"; url: string; data_updated_at: string; data: SummaryData }

export interface StudyMaterialData { subject_id: number; subject_type: SubjectType; meaning_synonyms: string[]; meaning_note: string | null; reading_note: string | null; hidden: boolean; created_at: string }
export type StudyMaterial = WKResource<StudyMaterialData, "study_material">;

export interface ReviewData {
  assignment_id: number;
  subject_id: number;
  starting_srs_stage: number;
  ending_srs_stage: number;
  incorrect_meaning_answers: number;
  incorrect_reading_answers: number;
  created_at: string;
}
export interface ReviewCreateResponse {
  id: number;
  object: "review";
  url: string;
  data_updated_at: string;
  data: ReviewData;
  resources_updated?: { assignment?: Assignment; review_statistic?: ReviewStatistic };
}
