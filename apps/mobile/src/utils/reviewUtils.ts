import { Assignment, Subject, WaniKaniItemType } from '../types/wanikani';

// Type definitions for review data
export interface ReviewQuestion {
  type: 'meaning' | 'reading';
  itemId: number;
}

export interface ReviewItem {
  id: number;
  subjectId: number;
  assignmentId: number | null;
  characters: string | null;
  characterImages?: { url: string }[];
  meanings: {
    meaning: string;
    primary?: boolean;
    accepted_answer?: boolean;
  }[];
  readings?: {
    reading: string;
    primary?: boolean;
    accepted_answer?: boolean;
  }[];
  type: WaniKaniItemType;
}

// Define the GroupedReviewItem interface
export interface GroupedReviewItem {
  id: number;
  subjectId: number;
  assignmentId?: number;
  srsStage?: number;
  level?: number;
  characters?: string;
  characterImages?: {
    url: string;
  }[];
  meanings: {
    meaning: string;
    primary: boolean;
    accepted_answer?: boolean;
  }[];
  readings?: {
    reading: string;
    primary: boolean;
    accepted_answer?: boolean;
  }[];
  pronunciationAudios?: {
    url: string;
    content_type: string;
    metadata?: {
      voice_actor_name?: string;
    };
  }[];
  type: WaniKaniItemType;
  meaningQuestion: {
    type: 'meaning';
    itemId: number;
  };
  readingQuestion: {
    type: 'reading';
    itemId: number;
  } | null;
}

/**
 * Prepares review data from subjects and assignments
 */
export function prepareReviewData(
  subjects: Subject[],
  assignments: Assignment[]
): GroupedReviewItem[] {
  return subjects.map((subject, index) => {
    const assignment = assignments.find(a => 
      a.subject_id === subject.id
    );
    
    // Determine if we should include a reading question
    // We only include reading questions for kanji and regular vocabulary
    const shouldHaveReadingQuestion = subject.object === 'kanji' || subject.object === 'vocabulary';
    
    return {
      id: index,
      subjectId: subject.id,
      assignmentId: assignment?.id,
      srsStage: assignment?.srs_stage,
      level: subject.data.level,
      characters: subject.data.characters || '',
      characterImages: subject.data.character_images,
      meanings: subject.data.meanings.map(m => ({
        meaning: m.meaning,
        primary: m.primary ?? false, // Use the actual primary flag from the API
        accepted_answer: m.accepted_answer ?? m.primary ?? false,
      })),
      readings: subject.data.readings?.map(r => ({
        reading: r.reading,
        primary: r.primary ?? false, // Use the actual primary flag from the API
        accepted_answer: r.accepted_answer ?? r.primary ?? false,
      })),
      pronunciationAudios: subject.data.pronunciation_audios,
      type: subject.object as WaniKaniItemType,
      meaningQuestion: {
        type: 'meaning',
        itemId: index
      },
      readingQuestion: shouldHaveReadingQuestion ? {
        type: 'reading',
        itemId: index
      } : null
    };
  });
}

/**
 * Shuffles an array in place
 * @param array Array to shuffle
 * @returns Shuffled array
 */
export const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}; 
