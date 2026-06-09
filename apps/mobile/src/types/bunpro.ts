export type BunproReviewableType = "Grammar" | "Vocab";
export type BunproStatsKey = "grammar" | "vocab";
export type BunproSrsStage =
  | "beginner"
  | "adept"
  | "seasoned"
  | "expert"
  | "master";
export type BunproSpecialSrsStage = "ghost" | "self_study";
export type BunproAnySrsStage = BunproSrsStage | BunproSpecialSrsStage;

export interface BunproJsonApiResource<
  TAttributes extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string;
  type: string;
  attributes: TAttributes;
}

export interface BunproJsonApiCollection<
  TAttributes extends Record<string, unknown> = Record<string, unknown>,
> {
  data: BunproJsonApiResource<TAttributes>[];
  included?: BunproJsonApiResource[];
}

export interface BunproUserAttributes extends Record<string, unknown> {
  id: number;
  username: string;
  level: number;
  xp: number;
  prev_level_xp: number;
  next_level_xp: number;
  time_zone_iana?: string;
  avatar_url?: string | null;
}

export interface BunproUserResponse {
  user: {
    data: BunproJsonApiResource<BunproUserAttributes>;
  };
  active_cosmetics?: BunproJsonApiCollection;
  active_title?: string | null;
}

export interface BunproWeeklyStreakDay {
  day: string;
  val: boolean;
}

export interface BunproBaseStatsFacts {
  days_studied: number;
  last_session: number;
  weekly_streak: BunproWeeklyStreakDay[];
  streak: number;
  grammar_studied: number;
  vocab_studied: number;
  total_badges: number;
}

export interface BunproBadgeAttributes extends Record<string, unknown> {
  id: number;
  title: string;
  category: string;
  rarity: string;
  percent_of_users_earned: number;
  badge_image: string;
}

export interface BunproBaseStatsResponse {
  facts: BunproBaseStatsFacts;
  badges: BunproJsonApiCollection<BunproBadgeAttributes>;
}

export interface BunproJlptLevelProgress {
  beginner: number;
  adept: number;
  seasoned: number;
  expert: number;
  master: number;
  total_count: number;
}

export type BunproJlptProgressBucket = Record<
  "1" | "2" | "3" | "4" | "5",
  BunproJlptLevelProgress
>;

export interface BunproJlptProgressMixedResponse {
  grammar: BunproJlptProgressBucket;
  vocab: BunproJlptProgressBucket;
}

export type BunproForecastSeries = Record<string, number>;

export interface BunproForecastDailyResponse {
  grammar: BunproForecastSeries;
  vocab: BunproForecastSeries;
}

export interface BunproForecastHourlyResponse {
  grammar: BunproForecastSeries;
  vocab: BunproForecastSeries;
}

export type BunproSrsOverviewBuckets = Record<BunproAnySrsStage, number>;

export interface BunproSrsOverviewResponse {
  grammar: BunproSrsOverviewBuckets;
  vocab: BunproSrsOverviewBuckets;
}

export type BunproReviewActivitySeries = Record<string, number>;

export interface BunproReviewActivityResponse {
  grammar: BunproReviewActivitySeries;
  vocab: BunproReviewActivitySeries;
}

export interface BunproDueResponse {
  total_due_grammar: number;
  total_due_vocab: number;
}

export interface BunproDeckSettingAttributes extends Record<string, unknown> {
  id: number;
  user_id: number;
  deck_id: number;
  batch_size: number;
  default_srs_level: number;
  sorting_order: string;
  default_input_type_grammar?: string;
  default_input_type_vocab?: string;
  complete_grammar_count?: number;
  complete_vocab_count?: number;
  daily_goal: number;
  daily_goal_count_grammar: number;
  daily_goal_count_vocab: number;
  is_bookmarked?: boolean;
}

export interface BunproDeckAttributes extends Record<string, unknown> {
  id: number;
  slug: string;
  vocab_count: number;
  grammar_count: number;
  title: string;
  description?: string;
}

export interface BunproQueueResponse {
  data: BunproJsonApiResource<BunproDeckSettingAttributes>[];
  included?: BunproJsonApiResource<BunproDeckAttributes>[];
}

export interface BunproDashboardPayload {
  user: BunproUserResponse;
  baseStats: BunproBaseStatsResponse;
  jlptProgressMixed: BunproJlptProgressMixedResponse;
  forecastDaily: BunproForecastDailyResponse;
  forecastHourly: BunproForecastHourlyResponse;
  srsLevelOverview: BunproSrsOverviewResponse;
  reviewActivity: BunproReviewActivityResponse;
  due: BunproDueResponse;
  queue: BunproQueueResponse;
}

export interface BunproReviewablesSearchOptions {
  include_reviews: boolean;
  include_bookmarks: boolean;
  include_notes: boolean;
  only_bookmarks: boolean;
}

export interface BunproReviewablesSearchRequest {
  query: string;
  options: BunproReviewablesSearchOptions;
  is_searching_grammar: boolean;
  is_searching_vocab: boolean;
}

export interface BunproGrammarPointAttributes extends Record<string, unknown> {
  id: number;
  title: string;
  slug: string;
  lesson_id?: number | null;
  lesson_count?: string | null;
  meaning?: string | null;
  furigana?: string | null;
  level?: string | null;
  part_of_speech?: string | null;
  part_of_speech_translation?: string | null;
  register?: string | null;
  register_translation?: string | null;
  word_type?: string | null;
  word_type_translation?: string | null;
  polite_structure?: string | null;
  casual_structure?: string | null;
  discourse_link?: string | null;
  metadata?: string | null;
  nuance?: string | null;
  nuance_translation?: string | null;
}

export interface BunproVocabAttributes extends Record<string, unknown> {
  id: number;
  title: string;
  slug: string;
  meaning?: string | null;
  furigana?: string | null;
  kana?: string | null;
  pitch_accent_stress?: string | null;
  jmdict_data?: Record<string, unknown> | null;
  jmdict_pos?: string[] | null;
  accepted_answers?: string | null;
  wrong_answers?: string | null;
  nuance?: string | null;
  nuance_translation?: string | null;
  jlpt_level?: string | null;
}

export interface BunproReviewablesSearchResponse {
  query: string;
  options: BunproReviewablesSearchOptions;
  is_searching_grammar: boolean;
  is_searching_vocab: boolean;
  grammar_points: BunproJsonApiCollection<BunproGrammarPointAttributes>;
  vocabs: BunproJsonApiCollection<BunproVocabAttributes>;
}

export type BunproReviewableKind = "vocab" | "grammar";

export interface BunproStudyQuestionAttributes extends Record<string, unknown> {
  id: number;
  content: string;
  answer?: string | null;
  kanji_answer?: string | null;
  level?: string | null;
  translation?: string | null;
  nuance_translation?: string | null;
  sentence_order?: number | null;
  male_audio_url?: string | null;
  female_audio_url?: string | null;
}

export interface BunproReviewableRelationships extends Record<string, unknown> {
  study_questions?: {
    data?: { id: string; type: string }[];
  };
}

export interface BunproReviewableDataResource<
  TAttributes extends Record<string, unknown>,
> extends BunproJsonApiResource<TAttributes> {
  relationships?: BunproReviewableRelationships;
}

export interface BunproReviewableDetailsResponse<
  TAttributes extends Record<string, unknown>,
> {
  data: BunproReviewableDataResource<TAttributes>;
  included?: BunproJsonApiResource<BunproStudyQuestionAttributes>[];
}

export type BunproLearnReviewableTuple = ["GrammarPoint" | "Vocab", number];

export type BunproLearnReviewableRequestItem = {
  reviewable_type: "grammar_point" | "vocab";
  reviewable_id: number;
};

export interface BunproLearnContentItem {
  data: BunproReviewableDataResource<
    BunproGrammarPointAttributes | BunproVocabAttributes
  >;
  included?: BunproJsonApiResource[];
}

export interface BunproLearnIndexResponse {
  deck?: BunproJsonApiResource<BunproDeckAttributes> | null;
  content: BunproLearnContentItem[];
}

export type BunproReviewOnlyFilter = "GrammarPoint" | "Vocab" | "Vocabulary" | string;

export interface BunproReviewAttributes extends Record<string, unknown> {
  id: number;
  reviewable_id: number;
  reviewable_type: string;
  default_input_type?: string | null;
  accuracy?: number | null;
  streak?: number | null;
  times_studied?: number | null;
  next_review?: string | null;
}

export interface BunproReviewRelationships extends Record<string, unknown> {
  study_question?: {
    data?: { id: string; type: string };
  };
  reviewable?: {
    data?: { id: string; type: string };
  };
}

export interface BunproReviewDataResource
  extends BunproJsonApiResource<BunproReviewAttributes> {
  relationships?: BunproReviewRelationships;
}

export interface BunproReviewQueueItem {
  data: BunproReviewDataResource;
  included?: BunproJsonApiResource[];
}

export interface BunproReviewQuizIndexResponse {
  review_session_id: number;
  pending_wrapup: BunproReviewQueueItem[];
  pending_attempt: BunproReviewQueueItem[];
  total_pending_attempt_count: number;
  total_pending_wrapup_count: number;
}

export interface BunproReviewUpdateRequest {
  review_session_id: number;
  correct: boolean;
  fsrs_input: unknown | null;
  loaded_review_ids: number[] | null;
  loaded_ghost_review_ids: number[] | null;
  loaded_self_study_review_ids: number[] | null;
  deck_id: number | null;
  only_review?: string | null;
}

export type BunproReviewUpdateResponse = Record<string, unknown>;
