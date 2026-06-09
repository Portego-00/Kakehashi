// WaniKani API Types
export interface CollectionResponse<T> {
  data: T[];
  total_count: number;
  data_updated_at: string;
  pages?: {
    next_url?: string;
    previous_url?: string;
    per_page: number;
  };
}

export interface Assignment {
  id: number;
  subject_id: number;
  subject_type: "radical" | "kanji" | "vocabulary" | "kana_vocabulary";
  srs_stage: number;
  unlocked_at: string | null;
  started_at: string | null;
  passed_at: string | null;
  available_at: string | null;
  burned_at: string | null;
}

export interface Subject {
  id: number;
  object: "radical" | "kanji" | "vocabulary" | "kana_vocabulary";
  data: {
    level?: number;
    characters: string | null;
    meanings: {
      meaning: string;
      primary?: boolean;
      accepted_answer?: boolean;
    }[];
    readings?: {
      reading: string;
      primary?: boolean;
      type?: string;
      accepted_answer?: boolean;
    }[];
    pronunciation_audios?: {
      url: string;
      content_type: string;
      metadata?: {
        voice_actor_name?: string;
      };
    }[];
    character_images?: { url: string }[];
    auxiliary_meanings?: {
      meaning: string;
      type: "whitelist" | "blacklist";
    }[];
    component_subject_ids?: number[];
    amalgamation_subject_ids?: number[];
    visually_similar_subject_ids?: number[];
  };
}

export interface Summary {
  lessons: {
    available_at: string;
    subject_ids: number[];
  }[];
  reviews: {
    available_at: string;
    subject_ids: number[];
  }[];
}

export interface ReviewStatistic {
  id: number;
  subject_id: number;
  percentage_correct: number;
}

export interface Review {
  id: number;
  assignment_id: number;
  subject_id: number;
  starting_srs_stage: number;
  ending_srs_stage: number;
  incorrect_meaning_answers: number;
  incorrect_reading_answers: number;
  created_at: string;
}

export interface LevelProgression {
  id: number;
  level: number;
  abandoned_at: string | null;
  completed_at: string | null;
  created_at: string;
  passed_at: string | null;
  started_at: string | null;
  unlocked_at: string | null;
}

// UI Component Types
export type WaniKaniItemType =
  | "radical"
  | "kanji"
  | "vocabulary"
  | "kana_vocabulary";

export interface SubjectTypeBreakdown {
  radical: number;
  kanji: number;
  vocabulary: number;
  kana_vocabulary: number;
}

export interface UnlockItem {
  id: number;
  characters: string;
  meaning: string;
  type: WaniKaniItemType;
  dateUnlocked: string;
  startedAt?: string | null;
  level?: number;
  reading?: string;
  character_images?: any[];
}

export interface CriticalItem {
  id: number;
  characters: string;
  meaning: string;
  type: WaniKaniItemType;
  percentage: number;
  meaningCorrect?: number;
  meaningIncorrect?: number;
  readingCorrect?: number;
  readingIncorrect?: number;
  reading?: string;
  character_images?: any[];
}

export interface BurnedItem {
  id: number;
  characters: string;
  meaning: string;
  type: WaniKaniItemType;
  dateBurned: string;
  reading?: string;
  character_images?: any[];
}

export interface RecentMistake {
  id: number;
  characters: string;
  meaning: string;
  type: WaniKaniItemType;
  meaningIncorrect: number;
  readingIncorrect: number;
  percentage: number;
  updatedAt: string;
  reading?: string;
  character_images?: any[];
}

/**
 * Represents forecast data for a single day of reviews
 *
 * This interface is used by the ReviewForecast component to display
 * how many reviews are scheduled for each day and hour in the forecast period.
 */
export interface DayForecast {
  /**
   * Name of the day (e.g., "Today", "Tomorrow", or day of week)
   */
  day: string;

  /**
   * Display date in MM/DD format, used for days beyond Tomorrow
   */
  displayDate?: string;

  /**
   * Total number of reviews scheduled for this day
   */
  totalCount: number;

  /**
   * Running total of reviews including this day and all previous days
   */
  cumulativeCount: number;

  /**
   * Breakdown of reviews by subject type for this day
   */
  subjectBreakdown?: SubjectTypeBreakdown;

  /**
   * Breakdown of reviews by hour for this day
   */
  hours?: {
    /** Hour of the day (0-23) */
    hour: number;

    /** Number of reviews scheduled for this specific hour */
    count: number;

    /** Running total of reviews for this day up to and including this hour */
    cumulativeCount: number;

    /** Breakdown of reviews by subject type for this hour */
    subjectBreakdown?: SubjectTypeBreakdown;

    /** Subject IDs being reviewed in this hour (for critical review detection) */
    subjectIds?: number[];
  }[];
}

export interface LevelItem {
  id: number;
  characters: string;
  meanings: string[];
  imageUrl: string | null;
  characterImages?: {
    url: string;
    content_type: string;
    metadata?: {
      inline_styles?: boolean;
      color?: string;
      dimensions?: string;
      style_name?: string;
    };
  }[];
  isPassed: boolean;
  srsStage: number;
  item_type: "radical" | "kanji";
}

export interface SrsLevel {
  name: string;
  count: number;
  color: string;
  icon: string;
  breakdown: {
    radical: number;
    kanji: number;
    vocabulary: number;
  };
}

// Review System Types
export interface ReviewItem {
  id: number;
  assignmentId: number;
  subjectId: number;
  characters: string;
  characterImages?: { url: string }[];
  meanings: { meaning: string; primary: boolean }[];
  readings?: { reading: string; primary: boolean; type?: string }[];
  type: WaniKaniItemType;
}

export interface ReviewQuestion {
  type: "meaning" | "reading";
  reviewItemId: number;
}

export interface ReviewSession {
  currentQuestion: ReviewQuestion | null;
  pendingQuestions: ReviewQuestion[];
  completedItems: {
    itemId: number;
    meaningCorrect: boolean;
    readingCorrect: boolean;
    meaningWrongCount: number;
    readingWrongCount: number;
  }[];
  currentItems: ReviewItem[];
  incorrectAnswers: Map<
    number,
    {
      meaningIncorrect: number;
      readingIncorrect: number;
    }
  >;
}
