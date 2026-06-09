import { Subject, Assignment } from './api';
import { getJLPTLevel, JLPT_TOTALS, getKanjiForLevel } from '../data/jlptKanji';
import { getJoyoGrade, JOYO_TOTALS, getJoyoGradeName } from '../data/joyoKanji';
import { getFrequencyBracket, FREQUENCY_TOTALS, getFrequencyBracketName } from '../data/frequencyKanji';

export interface ProgressData {
  learned: number;
  total: number;
  percent: number;
}

export interface CategoryData {
  [key: string]: ProgressData;
}

export interface AllProgressData {
  jlpt: CategoryData;
  joyo: CategoryData;
  frequency: CategoryData;
}

// JLPT level data based on real lists (from jlptKanji.ts)
const JLPT_PROGRESS_TOTALS = {
  'N5': JLPT_TOTALS.N5,   // 79
  'N4': JLPT_TOTALS.N4,   // 166
  'N3': JLPT_TOTALS.N3,   // 367
  'N2': JLPT_TOTALS.N2,   // 367
  'N1': JLPT_TOTALS.N1,   // 1232
};

// Use real Joyo grade data from joyoKanji.ts
const JOYO_PROGRESS_TOTALS = JOYO_TOTALS;

// Use real frequency bracket data from frequencyKanji.ts
const FREQUENCY_PROGRESS_TOTALS = FREQUENCY_TOTALS;

/**
 * Calculates progress data for JLPT, Joyo, and frequency categories
 * @param subjects Array of all subjects from WaniKani
 * @param assignments Array of all assignments from WaniKani
 * @param learnedThreshold SRS stage threshold for considering an item "learned" (default: 5 = Guru+)
 * @returns Object containing progress data for all categories
 */
export function calculateProgressData(
  subjects: Subject[],
  assignments: Assignment[],
  learnedThreshold: number = 5
): AllProgressData {
  console.log(`Calculating progress with ${subjects.length} subjects and ${assignments.length} assignments`);
  
  // Initialize progress data with totals
  const progressData: AllProgressData = {
    jlpt: Object.keys(JLPT_PROGRESS_TOTALS).reduce((acc, level) => {
      acc[level] = { learned: 0, total: JLPT_PROGRESS_TOTALS[level as keyof typeof JLPT_PROGRESS_TOTALS], percent: 0 };
      return acc;
    }, {} as CategoryData),
    joyo: Object.keys(JOYO_PROGRESS_TOTALS).reduce((acc, grade) => {
      acc[grade] = { learned: 0, total: JOYO_PROGRESS_TOTALS[grade as keyof typeof JOYO_PROGRESS_TOTALS], percent: 0 };
      return acc;
    }, {} as CategoryData),
    frequency: Object.keys(FREQUENCY_PROGRESS_TOTALS).reduce((acc, bracket) => {
      acc[bracket] = { learned: 0, total: FREQUENCY_PROGRESS_TOTALS[bracket as keyof typeof FREQUENCY_PROGRESS_TOTALS], percent: 0 };
      return acc;
    }, {} as CategoryData),
  };

  // Create assignment lookup for faster access
  const assignmentMap = new Map<number, Assignment>();
  assignments.forEach(assignment => {
    assignmentMap.set(assignment.data.subject_id, assignment);
  });

  // Count learned items
  let totalProcessed = 0;
  let jlptFound = 0;
  let joyoFound = 0;
  let frequencyFound = 0;

  subjects.forEach(subject => {
    // Only process kanji items
    if (subject.object !== 'kanji') return;
    
    totalProcessed++;
    const assignment = assignmentMap.get(subject.id);
    const srsStage = assignment?.data.srs_stage || 0;
    const isLearned = srsStage >= learnedThreshold;

    // JLPT Level Detection
    const jlptLevel = detectJLPTLevel(subject);
    if (jlptLevel && progressData.jlpt[jlptLevel]) {
      jlptFound++;
      if (isLearned) {
        progressData.jlpt[jlptLevel].learned++;
      }
    }

    // Joyo Grade Detection  
    const joyoGrade = detectJoyoGrade(subject);
    if (joyoGrade && progressData.joyo[joyoGrade]) {
      joyoFound++;
      if (isLearned) {
        progressData.joyo[joyoGrade].learned++;
      }
    }

    // Frequency Bracket Detection (approximation based on level)
    const frequencyBracket = detectFrequencyBracket(subject);
    if (frequencyBracket && progressData.frequency[frequencyBracket]) {
      frequencyFound++;
      if (isLearned) {
        progressData.frequency[frequencyBracket].learned++;
      }
    }
  });

  // Calculate percentages
  Object.keys(progressData).forEach(category => {
    Object.keys(progressData[category as keyof AllProgressData]).forEach(level => {
      const data = progressData[category as keyof AllProgressData][level];
      data.percent = data.total > 0 ? Math.round((data.learned / data.total) * 100) : 0;
    });
  });

  console.log(`Progress calculation complete: ${totalProcessed} kanji processed, JLPT: ${jlptFound}, Joyo: ${joyoFound}, Frequency: ${frequencyFound}`);
  
  return progressData;
}

/**
 * Detects JLPT level from subject data using real JLPT kanji lists
 * Uses actual JLPT kanji data for accurate classification
 */
function detectJLPTLevel(subject: Subject): string | null {
  // Extract the kanji character from the subject
  const kanji = subject.data.characters;
  
  if (!kanji) return null;
  
  // Use the real JLPT lookup table
  return getJLPTLevel(kanji);
}

/**
 * Detects Joyo grade from subject data using real Joyo kanji lists
 * Uses actual Joyo kanji data for accurate classification
 */
function detectJoyoGrade(subject: Subject): string | null {
  // Extract the kanji character from the subject
  const kanji = subject.data.characters;
  
  if (!kanji) return null;
  
  // Use the real Joyo lookup table
  return getJoyoGrade(kanji);
}

/**
 * Detects frequency bracket from subject data using real frequency kanji lists
 * Uses actual frequency kanji data for accurate classification
 */
function detectFrequencyBracket(subject: Subject): string | null {
  // Extract the kanji character from the subject
  const kanji = subject.data.characters;
  
  if (!kanji) return null;
  
  // Use the real frequency lookup table
  return getFrequencyBracket(kanji);
}

/**
 * Gets a human-readable label for different categories and levels
 */
export function getCategoryLabel(category: keyof AllProgressData, key: string): string {
  switch (category) {
    case 'jlpt':
      return key; // Key is already in format "N5", "N4", etc.
    case 'joyo':
      return getJoyoGradeName(key as keyof typeof JOYO_PROGRESS_TOTALS);
    case 'frequency':
      return getFrequencyBracketName(key as keyof typeof FREQUENCY_PROGRESS_TOTALS);
    default:
      return key;
  }
}

/**
 * Gets a description for each category
 */
export function getCategoryDescription(category: keyof AllProgressData): string {
  switch (category) {
    case 'jlpt':
      return 'Japanese Language Proficiency Test levels';
    case 'joyo':
      return 'Educational kanji by school grade';
    case 'frequency':
      return 'Most common kanji by usage frequency';
    default:
      return '';
  }
}

/**
 * Gets the progress color based on percentage
 */
export function getProgressColor(percent: number): string {
  if (percent >= 80) return '#4CAF50'; // Green
  if (percent >= 60) return '#FF9800'; // Orange
  if (percent >= 40) return '#FFC107'; // Yellow
  return '#F44336'; // Red
}

/**
 * Gets detailed kanji progress for a specific JLPT level
 * Similar to what wkstats.com shows - individual kanji with their status
 */
export interface KanjiProgress {
  kanji: string;
  learned: boolean;
  srsStage: number;
  wanikaniLevel?: number;
  inWanikani: boolean;
}

export function getDetailedJLPTProgress(
  jlptLevel: keyof typeof JLPT_PROGRESS_TOTALS,
  subjects: Subject[],
  assignments: Assignment[],
  learnedThreshold: number = 5
): KanjiProgress[] {
  // Get all kanji for this JLPT level
  const jlptKanji = getKanjiForLevel(jlptLevel);
  
  // Create assignment lookup for faster access
  const assignmentMap = new Map<number, Assignment>();
  assignments.forEach(assignment => {
    assignmentMap.set(assignment.data.subject_id, assignment);
  });

  // Create subject lookup by kanji character
  const kanjiSubjectMap = new Map<string, Subject>();
  subjects.forEach(subject => {
    if (subject.object === 'kanji' && subject.data.characters) {
      kanjiSubjectMap.set(subject.data.characters, subject);
    }
  });

  // Map each JLPT kanji to its progress
  return jlptKanji.map(kanji => {
    const subject = kanjiSubjectMap.get(kanji);
    
    if (!subject) {
      // Kanji not in WaniKani
      return {
        kanji,
        learned: false,
        srsStage: 0,
        inWanikani: false,
      };
    }

    const assignment = assignmentMap.get(subject.id);
    const srsStage = assignment?.data.srs_stage || 0;
    const isLearned = srsStage >= learnedThreshold;

    return {
      kanji,
      learned: isLearned,
      srsStage,
      wanikaniLevel: subject.data.level,
      inWanikani: true,
    };
  });
}

/**
 * Gets summary statistics for detailed progress
 */
export interface JLPTLevelSummary {
  level: keyof typeof JLPT_PROGRESS_TOTALS;
  totalKanji: number;
  learnedKanji: number;
  inWanikaniKanji: number;
  notInWanikaniKanji: number;
  percent: number;
  wanikaniCoverage: number; // Percentage of JLPT kanji covered by WaniKani
}

export function getJLPTLevelSummary(
  jlptLevel: keyof typeof JLPT_PROGRESS_TOTALS,
  subjects: Subject[],
  assignments: Assignment[],
  learnedThreshold: number = 5
): JLPTLevelSummary {
  const detailedProgress = getDetailedJLPTProgress(jlptLevel, subjects, assignments, learnedThreshold);
  
  const totalKanji = detailedProgress.length;
  const learnedKanji = detailedProgress.filter(k => k.learned).length;
  const inWanikaniKanji = detailedProgress.filter(k => k.inWanikani).length;
  const notInWanikaniKanji = totalKanji - inWanikaniKanji;
  
  return {
    level: jlptLevel,
    totalKanji,
    learnedKanji,
    inWanikaniKanji,
    notInWanikaniKanji,
    percent: totalKanji > 0 ? Math.round((learnedKanji / totalKanji) * 100) : 0,
    wanikaniCoverage: totalKanji > 0 ? Math.round((inWanikaniKanji / totalKanji) * 100) : 0,
  };
}