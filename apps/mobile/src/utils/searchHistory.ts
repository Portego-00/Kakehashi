import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OCRHistoryItem {
  id: string;
  timestamp: Date;
  recognizedText: string;
  originalText: string;
  imageUri: string;
  textRegions: string;
  translationLines?: string[];
  vocabularyMatchCount: number;
  kanjiMatchCount: number;
}

export interface VocabularyMatch {
  id: number;
  characters: string;
  meaning: string;
  type: string;
  level: number;
  readings?: { reading: string; primary: boolean }[];
  verbConjugationKind?:
    | "ichidan"
    | "godan"
    | "suru"
    | "kuru"
    | "ru-ambiguous";
  matchCandidates?: string[];
}

export interface KanjiMatch {
  id: number;
  characters: string;
  meaning: string;
  type: string;
  level: number;
  readings?: { reading: string; primary: boolean }[];
}

export interface SpeechHistoryItem {
  id: string;
  timestamp: Date;
  recognizedText: string;
  originalText: string;
  translation?: string;
  vocabularyMatchCount: number;
  kanjiMatchCount: number;
  isEnglishMode: boolean;
  vocabularyMatches: VocabularyMatch[];
  kanjiMatches: KanjiMatch[];
}

export interface TextHistoryItem {
  id: string;
  timestamp: Date;
  inputText: string;
  japaneseText: string;
  translation?: string;
  vocabularyMatchCount: number;
  kanjiMatchCount: number;
  isEnglishMode: boolean;
  vocabularyMatches: VocabularyMatch[];
  kanjiMatches: KanjiMatch[];
}

const OCR_HISTORY_KEY = '@wanikani_ocr_history';
const SPEECH_HISTORY_KEY = '@wanikani_speech_history';
const TEXT_HISTORY_KEY = '@wanikani_text_history';
const MAX_HISTORY_ITEMS = 50;

// OCR History Functions
export async function saveOCRHistory(item: Omit<OCRHistoryItem, 'id' | 'timestamp'>): Promise<void> {
  try {
    const historyJson = await AsyncStorage.getItem(OCR_HISTORY_KEY);
    const history: OCRHistoryItem[] = historyJson ? JSON.parse(historyJson) : [];
    
    // Check for recent duplicate (same recognizedText within last 10 seconds)
    const now = new Date();
    const recentDuplicate = history.find(existingItem => {
      const existingTime = new Date(existingItem.timestamp);
      const timeDiff = now.getTime() - existingTime.getTime();
      return existingItem.recognizedText === item.recognizedText && timeDiff < 10000; // 10 seconds
    });
    
    if (recentDuplicate) {
      return;
    }
    
    const newItem: OCRHistoryItem = {
      ...item,
      id: Date.now().toString(),
      timestamp: now,
    };
    
    // Add to beginning of array
    history.unshift(newItem);
    
    // Keep only the most recent items
    if (history.length > MAX_HISTORY_ITEMS) {
      history.splice(MAX_HISTORY_ITEMS);
    }
    
    await AsyncStorage.setItem(OCR_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Silent failure for history saving
  }
}

export async function getOCRHistory(): Promise<OCRHistoryItem[]> {
  try {
    const historyJson = await AsyncStorage.getItem(OCR_HISTORY_KEY);
    return historyJson ? JSON.parse(historyJson) : [];
  } catch {
    return [];
  }
}

export async function removeOCRHistoryItem(id: string): Promise<void> {
  try {
    const history = await getOCRHistory();
    const filteredHistory = history.filter(item => item.id !== id);
    await AsyncStorage.setItem(OCR_HISTORY_KEY, JSON.stringify(filteredHistory));
  } catch {
    // Silent failure for history removal
  }
}

export async function clearOCRHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(OCR_HISTORY_KEY);
  } catch {
    // Silent failure for history clearing
  }
}

// Speech History Functions
export async function saveSpeechHistory(item: Omit<SpeechHistoryItem, 'id' | 'timestamp'>): Promise<void> {
  try {
    const historyJson = await AsyncStorage.getItem(SPEECH_HISTORY_KEY);
    const history: SpeechHistoryItem[] = historyJson ? JSON.parse(historyJson) : [];
    
    // Check for recent duplicate (same recognizedText within last 10 seconds)
    const now = new Date();
    const recentDuplicateIndex = history.findIndex(existingItem => {
      const existingTime = new Date(existingItem.timestamp);
      const timeDiff = now.getTime() - existingTime.getTime();
      return existingItem.recognizedText === item.recognizedText && timeDiff < 10000; // 10 seconds
    });
    
    if (recentDuplicateIndex !== -1) {
      const existingItem = history[recentDuplicateIndex];
      
      // If existing item doesn't have translation but new item does, update it
      if (!existingItem.translation && item.translation) {
        history[recentDuplicateIndex] = {
          ...existingItem,
          translation: item.translation,
          // Also update vocabulary/kanji matches in case they changed
          vocabularyMatches: item.vocabularyMatches,
          kanjiMatches: item.kanjiMatches,
          vocabularyMatchCount: item.vocabularyMatchCount,
          kanjiMatchCount: item.kanjiMatchCount,
        };
        await AsyncStorage.setItem(SPEECH_HISTORY_KEY, JSON.stringify(history));
        return;
      }
      
      // Otherwise, skip as duplicate
      return;
    }
    
    const newItem: SpeechHistoryItem = {
      ...item,
      id: Date.now().toString(),
      timestamp: now,
    };
    
    // Add to beginning of array
    history.unshift(newItem);
    
    // Keep only the most recent items
    if (history.length > MAX_HISTORY_ITEMS) {
      history.splice(MAX_HISTORY_ITEMS);
    }
    
    await AsyncStorage.setItem(SPEECH_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Silent failure for history saving
  }
}

export async function getSpeechHistory(): Promise<SpeechHistoryItem[]> {
  try {
    const historyJson = await AsyncStorage.getItem(SPEECH_HISTORY_KEY);
    return historyJson ? JSON.parse(historyJson) : [];
  } catch {
    return [];
  }
}

export async function removeSpeechHistoryItem(id: string): Promise<void> {
  try {
    const history = await getSpeechHistory();
    const filteredHistory = history.filter(item => item.id !== id);
    await AsyncStorage.setItem(SPEECH_HISTORY_KEY, JSON.stringify(filteredHistory));
  } catch {
    // Silent failure for history removal
  }
}

export async function clearSpeechHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SPEECH_HISTORY_KEY);
  } catch {
    // Silent failure for history clearing
  }
}

// Text History Functions
export async function saveTextHistory(item: Omit<TextHistoryItem, 'id' | 'timestamp'>): Promise<void> {
  try {
    const historyJson = await AsyncStorage.getItem(TEXT_HISTORY_KEY);
    const history: TextHistoryItem[] = historyJson ? JSON.parse(historyJson) : [];

    // Check for recent duplicate (same inputText within last 10 seconds)
    const now = new Date();
    const recentDuplicateIndex = history.findIndex(existingItem => {
      const existingTime = new Date(existingItem.timestamp);
      const timeDiff = now.getTime() - existingTime.getTime();
      return existingItem.inputText === item.inputText && timeDiff < 10000; // 10 seconds
    });

    if (recentDuplicateIndex !== -1) {
      const existingItem = history[recentDuplicateIndex];

      // If existing item doesn't have translation but new item does, update it
      if (!existingItem.translation && item.translation) {
        console.log('Updating text history with translation for:', item.inputText);
        history[recentDuplicateIndex] = {
          ...existingItem,
          translation: item.translation,
          vocabularyMatches: item.vocabularyMatches,
          kanjiMatches: item.kanjiMatches,
          vocabularyMatchCount: item.vocabularyMatchCount,
          kanjiMatchCount: item.kanjiMatchCount,
        };
        await AsyncStorage.setItem(TEXT_HISTORY_KEY, JSON.stringify(history));
        return;
      }

      // Otherwise, skip as duplicate
      console.log('Skipping duplicate text history save for:', item.inputText);
      return;
    }

    const newItem: TextHistoryItem = {
      ...item,
      id: Date.now().toString(),
      timestamp: now,
    };

    // Add to beginning of array
    history.unshift(newItem);

    // Keep only the most recent items
    if (history.length > MAX_HISTORY_ITEMS) {
      history.splice(MAX_HISTORY_ITEMS);
    }

    await AsyncStorage.setItem(TEXT_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Error saving text history:', error);
  }
}

export async function getTextHistory(): Promise<TextHistoryItem[]> {
  try {
    const historyJson = await AsyncStorage.getItem(TEXT_HISTORY_KEY);
    return historyJson ? JSON.parse(historyJson) : [];
  } catch (error) {
    console.error('Error getting text history:', error);
    return [];
  }
}

export async function removeTextHistoryItem(id: string): Promise<void> {
  try {
    const history = await getTextHistory();
    const filteredHistory = history.filter(item => item.id !== id);
    await AsyncStorage.setItem(TEXT_HISTORY_KEY, JSON.stringify(filteredHistory));
  } catch (error) {
    console.error('Error removing text history item:', error);
  }
}

export async function clearTextHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TEXT_HISTORY_KEY);
  } catch (error) {
    console.error('Error clearing text history:', error);
  }
}

// Utility function to format timestamp
export function formatHistoryTimestamp(timestamp: Date | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
