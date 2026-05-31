import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { WaniKaniItemType } from '../types/wanikani';
import { fetchAllPages, getSubjects, Subject } from '../utils/api';
import {
  checkSubjectsCacheHealth,
  repairSubjectsCache,
  type CacheHealthStatus
} from '../utils/cache';
import { fontStyles } from '../utils/fonts';
import { getSubjectTypeColor } from '../utils/subjectColors';
import { useAuthStore } from '../utils/store';
import { useTheme } from '../utils/theme';

interface SearchResult {
  id: number;
  characters: string;
  meaning: string;
  type: WaniKaniItemType;
  level: number;
}

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
}

// Adaptive debounce - longer delay for shorter queries to reduce API calls
function useAdaptiveDebounce(value: string, baseDelay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Longer delay for shorter queries to reduce performance impact
    const delay = value.length <= 1 ? baseDelay * 3 : 
                  value.length <= 2 ? baseDelay * 2 : 
                  baseDelay;
    
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, baseDelay]);

  return debouncedValue;
}

// Comprehensive romaji to hiragana conversion for search queries
function convertToKana(input: string): string {
  const romajiMap: { [key: string]: string } = {
    'a': 'あ', 'ba': 'ば', 'be': 'べ', 'bi': 'び', 'bo': 'ぼ', 'bu': 'ぶ',
    'bya': 'びゃ', 'bye': 'びぇ', 'byi': 'びぃ', 'byo': 'びょ', 'byu': 'びゅ',
    'ca': 'か', 'ce': 'せ', 'cha': 'ちゃ', 'che': 'ちぇ', 'chi': 'ち', 'cho': 'ちょ', 'chu': 'ちゅ',
    'chya': 'ちゃ', 'chye': 'ちぇ', 'chyo': 'ちょ', 'chyu': 'ちゅ',
    'ci': 'き', 'co': 'こ', 'cu': 'く', 'cya': 'ちゃ', 'cye': 'ちぇ', 'cyi': 'ちぃ', 'cyo': 'ちょ', 'cyu': 'ちゅ',
    'da': 'だ', 'de': 'で', 'dha': 'でゃ', 'dhe': 'でぇ', 'dhi': 'でぃ', 'dho': 'でょ', 'dhu': 'でゅ',
    'di': 'ぢ', 'do': 'ど', 'du': 'づ', 'dwa': 'どぁ', 'dwe': 'どぇ', 'dwi': 'どぃ', 'dwo': 'どぉ', 'dwu': 'どぅ',
    'dya': 'ぢゃ', 'dye': 'ぢぇ', 'dyi': 'ぢぃ', 'dyo': 'ぢょ', 'dyu': 'ぢゅ',
    'e': 'え', 'fa': 'ふぁ', 'fe': 'ふぇ', 'fi': 'ふぃ', 'fo': 'ふぉ', 'fu': 'ふ',
    'fwa': 'ふぁ', 'fwe': 'ふぇ', 'fwi': 'ふぃ', 'fwo': 'ふぉ', 'fwu': 'ふぅ',
    'fya': 'ふゃ', 'fye': 'ふぇ', 'fyi': 'ふぃ', 'fyo': 'ふょ', 'fyu': 'ふゅ',
    'ga': 'が', 'ge': 'げ', 'gi': 'ぎ', 'go': 'ご', 'gu': 'ぐ',
    'gwa': 'ぐぁ', 'gwe': 'ぐぇ', 'gwi': 'ぐぃ', 'gwo': 'ぐぉ', 'gwu': 'ぐぅ',
    'gya': 'ぎゃ', 'gye': 'ぎぇ', 'gyi': 'ぎぃ', 'gyo': 'ぎょ', 'gyu': 'ぎゅ',
    'ha': 'は', 'he': 'へ', 'hi': 'ひ', 'ho': 'ほ', 'hu': 'ふ',
    'hya': 'ひゃ', 'hye': 'ひぇ', 'hyi': 'ひぃ', 'hyo': 'ひょ', 'hyu': 'ひゅ',
    'i': 'い', 'ja': 'じゃ', 'je': 'じぇ', 'ji': 'じ', 'jo': 'じょ', 'ju': 'じゅ',
    'jya': 'じゃ', 'jye': 'じぇ', 'jyi': 'じぃ', 'jyo': 'じょ', 'jyu': 'じゅ',
    'ka': 'か', 'ke': 'け', 'ki': 'き', 'ko': 'こ', 'ku': 'く', 'kwa': 'くぁ',
    'kya': 'きゃ', 'kye': 'きぇ', 'kyi': 'きぃ', 'kyo': 'きょ', 'kyu': 'きゅ',
    'la': 'ら', 'lca': 'ゕ', 'lce': 'ゖ', 'le': 'れ', 'li': 'り', 'lka': 'ゕ', 'lke': 'ゖ',
    'lo': 'ろ', 'ltsu': 'っ', 'ltu': 'っ', 'lu': 'る', 'lwe': 'ゎ',
    'lya': 'りゃ', 'lye': 'りぇ', 'lyi': 'りぃ', 'lyo': 'りょ', 'lyu': 'りゅ',
    'ma': 'ま', 'me': 'め', 'mi': 'み', 'mo': 'も', 'mu': 'む',
    'mya': 'みゃ', 'mye': 'みぇ', 'myi': 'みぃ', 'myo': 'みょ', 'myu': 'みゅ',
    'n ': 'ん', 'na': 'な', 'ne': 'ね', 'ni': 'に', 'nn': 'ん', 'no': 'の', 'nu': 'ぬ',
    'nya': 'にゃ', 'nye': 'にぇ', 'nyi': 'にぃ', 'nyo': 'にょ', 'nyu': 'にゅ',
    'o': 'お', 'pa': 'ぱ', 'pe': 'ぺ', 'pi': 'ぴ', 'po': 'ぽ', 'pu': 'ぷ',
    'pya': 'ぴゃ', 'pye': 'ぴぇ', 'pyi': 'ぴぃ', 'pyo': 'ぴょ', 'pyu': 'ぴゅ',
    'qa': 'くぁ', 'qe': 'くぇ', 'qi': 'くぃ', 'qo': 'くぉ', 'qwa': 'くぁ', 'qwe': 'くぇ', 'qwi': 'くぃ', 'qwo': 'くぉ', 'qwu': 'くぅ',
    'qya': 'くゃ', 'qye': 'くぇ', 'qyi': 'くぃ', 'qyo': 'くょ', 'qyu': 'くゅ',
    'ra': 'ら', 're': 'れ', 'ri': 'り', 'ro': 'ろ', 'ru': 'る',
    'rya': 'りゃ', 'rye': 'りぇ', 'ryi': 'りぃ', 'ryo': 'りょ', 'ryu': 'りゅ',
    'sa': 'さ', 'se': 'せ', 'sha': 'しゃ', 'she': 'しぇ', 'shi': 'し', 'sho': 'しょ', 'shu': 'しゅ',
    'shya': 'しゃ', 'shye': 'しぇ', 'shyo': 'しょ', 'shyu': 'しゅ',
    'si': 'し', 'so': 'そ', 'su': 'す', 'swa': 'すぁ', 'swe': 'すぇ', 'swi': 'すぃ', 'swo': 'すぉ', 'swu': 'すぅ',
    'sya': 'しゃ', 'sye': 'しぇ', 'syi': 'しぃ', 'syo': 'しょ', 'syu': 'しゅ',
    'ta': 'た', 'te': 'て', 'tha': 'てゃ', 'the': 'てぇ', 'thi': 'てぃ', 'tho': 'てょ', 'thu': 'てゅ',
    'ti': 'ち', 'to': 'と', 'tsa': 'つぁ', 'tse': 'つぇ', 'tsi': 'つぃ', 'tso': 'つぉ', 'tsu': 'つ', 'tu': 'つ',
    'twa': 'とぁ', 'twe': 'とぇ', 'twi': 'とぃ', 'two': 'とぉ', 'twu': 'とぅ',
    'tya': 'ちゃ', 'tye': 'ちぇ', 'tyi': 'ちぃ', 'tyo': 'ちょ', 'tyu': 'ちゅ',
    'u': 'う', 'va': 'ゔぁ', 've': 'ゔぇ', 'vi': 'ゔぃ', 'vo': 'ゔぉ', 'vu': 'ゔ',
    'vya': 'ゔゃ', 'vye': 'ゔぇ', 'vyi': 'ゔぃ', 'vyo': 'ゔょ', 'vyu': 'ゔゅ',
    'wa': 'わ', 'we': 'うぇ', 'wha': 'うぁ', 'whe': 'うぇ', 'whi': 'うぃ', 'who': 'うぉ', 'whu': 'う',
    'wi': 'うぃ', 'wo': 'を', 'wu': 'う',
    'xa': 'ぁ', 'xca': 'ゕ', 'xce': 'ゖ', 'xe': 'ぇ', 'xi': 'ぃ', 'xka': 'ゕ', 'xke': 'ゖ', 'xn': 'ん',
    'xo': 'ぉ', 'xtu': 'っ', 'xu': 'ぅ', 'xwa': 'ゎ',
    'xya': 'ゃ', 'xye': 'ぇ', 'xyi': 'ぃ', 'xyo': 'ょ', 'xyu': 'ゅ',
    'ya': 'や', 'ye': 'いぇ', 'yi': 'い', 'yo': 'よ', 'yu': 'ゆ',
    'za': 'ざ', 'ze': 'ぜ', 'zi': 'じ', 'zo': 'ぞ', 'zu': 'ず',
    'zya': 'じゃ', 'zye': 'じぇ', 'zyi': 'じぃ', 'zyo': 'じょ', 'zyu': 'じゅ',
    '-': 'ー',
  };

  const consonants = 'bcdfghjklmnpqrstvwxyz';
  const nmChars = 'nm';
  const canFollowN = 'aiueony';

  let result = input.toLowerCase();
  let i = 0;

  // Process character by character.
  while (i < result.length) {
    // Handle sokuon (double consonants) - must be checked before replacements
    if (i > 0) {
      const currentChar = result[i];
      const lastChar = result[i - 1];
      if (currentChar !== 'n' && currentChar === lastChar &&
          consonants.includes(currentChar) && consonants.includes(lastChar)) {
        result = result.substring(0, i - 1) + 'っ' + result.substring(i);
        continue;
      }
    }

    // Test for replacements, trying longer matches first (4, 3, 2, 1)
    let matched = false;
    for (let len = 4; len > 0; len--) {
      if (len > i + 1) {
        continue;
      }
      const startIndex = i - len + 1;
      if (startIndex < 0) {
        continue;
      }
      const text = result.substring(startIndex, i + 1);
      const replacement = romajiMap[text];
      if (replacement) {
        result = result.substring(0, startIndex) + replacement + result.substring(i + 1);
        i = startIndex + replacement.length - 1;
        matched = true;
        break;
      }
    }
    
    if (!matched) {
      i++;
    } else {
      i++;
    }
  }

  // Replace n/m with ん.
  for (i = 0; i < result.length; i++) {
    if (nmChars.includes(result[i])) {
      result = result.substring(0, i) + 'ん' + result.substring(i + 1);
    }
  }

  // Remove lowercase letters from the end only.
  for (i = result.length - 1; i >= 0; i--) {
    const char = result[i];
    if (char >= 'a' && char <= 'z') {
      result = result.substring(0, i);
    } else {
      break;
    }
  }

  return result;
}

// Check if subject matches the search query.
function subjectMatchesQuery(subject: Subject, query: string, kanaQuery: string): boolean {
  const lowerQuery = query.toLowerCase();
  
  // 1. Check if Japanese characters start with the original query (for Japanese input)
  if (subject.data.characters && subject.data.characters.startsWith(query)) {
    return true;
  }
  
  // 2. Check if any meaning starts with the lowercased query (for English input)
  for (const meaning of subject.data.meanings) {
    if (meaning.meaning.toLowerCase().startsWith(lowerQuery)) {
      return true;
    }
  }
  
  // 3. Check if any reading starts with the kana-converted query (for romaji input)
  if (subject.data.readings && kanaQuery.length > 0) {
    for (const reading of subject.data.readings) {
      if (reading.reading.startsWith(kanaQuery)) {
        return true;
      }
    }
  }
  
  return false;
}

// Basic kana to romaji conversion for reverse matching
function convertKanaToRomaji(kana: string): string {
  const kanaToRomajiMap: { [key: string]: string } = {
    'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
    'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
    'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
    'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
    'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
    'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
    'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
    'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
    'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
    'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
    'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
    'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
    'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
    'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
    'わ': 'wa', 'を': 'wo', 'ん': 'n'
  };

  let result = kana;
  for (const [kanaChar, romaji] of Object.entries(kanaToRomajiMap)) {
    result = result.replace(new RegExp(kanaChar, 'g'), romaji);
  }
  return result;
}

// Check if subject matches query exactly (for sorting priority)
function subjectMatchesQueryExactly(subject: Subject, query: string, kanaQuery: string): boolean {
  const lowerQuery = query.toLowerCase();
  
  // Check exact meaning matches
  for (const meaning of subject.data.meanings) {
    if (meaning.meaning.toLowerCase() === lowerQuery) {
      return true;
    }
  }
  
  // Check exact reading matches
  if (subject.data.readings) {
    for (const reading of subject.data.readings) {
      if (reading.reading.toLowerCase() === kanaQuery) {
        return true;
      }
    }
  }
  
  // Check exact character match
  if (subject.data.characters && subject.data.characters.toLowerCase() === lowerQuery) {
    return true;
  }
  
  return false;
}

export default function SearchModal({ visible, onClose }: SearchModalProps) {
  const { theme } = useTheme();
  const { apiToken } = useAuthStore();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allSubjects, setAllSubjects] = useState<Subject[] | null>(null);
  const [cacheHealthStatus, setCacheHealthStatus] = useState<CacheHealthStatus | null>(null);
  const [isRepairing, setIsRepairing] = useState(false);

  const debouncedSearchQuery = useAdaptiveDebounce(searchQuery, 300);

  // Load all subjects when modal opens (once per session)
  useEffect(() => {
    if (visible && !allSubjects && apiToken) {
      loadAllSubjects();
    }
  }, [visible, apiToken, allSubjects]);

  // Reset search state when modal opens/closes
  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setSearchResults([]);
      setError(null);
    }
  }, [visible]);

  // Perform search when debounced query changes
  useEffect(() => {
    if (!visible || !allSubjects || !debouncedSearchQuery.trim()) {
      setSearchResults([]);
      setIsLoading(false);
      return;
    }

    performSearch(debouncedSearchQuery.trim());
  }, [debouncedSearchQuery, visible, allSubjects]);

  // Function to fetch all subjects from API (used for cache repair)
  const fetchAllSubjectsFromApi = useCallback(async (token: string) => {
    const initialResponse = await getSubjects(token, {}, { skipCollectionCache: true });
    const completeResponse = await fetchAllPages(initialResponse, token);
    return {
      data: completeResponse.data,
      data_updated_at: completeResponse.data_updated_at
    };
  }, []);

  // Handle cache repair
  const handleRepairCache = useCallback(async () => {
    if (!apiToken) return;

    setIsRepairing(true);
    setError(null);

    try {
      const result = await repairSubjectsCache(apiToken, fetchAllSubjectsFromApi);

      if (result.success) {
        setCacheHealthStatus(result.newStatus || null);

        // Reload subjects after repair
        if (result.action === 'refetched' && result.newStatus?.isHealthy) {
          const response = await getSubjects(apiToken, {}, { skipCollectionCache: true });
          setAllSubjects(response.data);
        }

        Alert.alert(
          'Cache Repaired',
          result.message,
          [{ text: 'OK' }]
        );
      } else {
        setError(`Cache repair failed: ${result.message}`);
        Alert.alert(
          'Repair Failed',
          result.message,
          [{ text: 'OK' }]
        );
      }
    } catch {
      setError('Failed to repair cache. Please try again.');
      Alert.alert(
        'Error',
        'Failed to repair cache. Please try again later.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsRepairing(false);
    }
  }, [apiToken, fetchAllSubjectsFromApi]);

  const loadAllSubjects = useCallback(async () => {
    if (!apiToken) return;

    setIsLoadingSubjects(true);
    setError(null);

    try {
      // First check cache health
      const healthStatus = await checkSubjectsCacheHealth();
      setCacheHealthStatus(healthStatus);

      if (!healthStatus.isHealthy) {

        // Offer to repair automatically if there are critical issues
        const hasCriticalIssues = healthStatus.issues.some(i => i.severity === 'critical');

        if (hasCriticalIssues) {
          Alert.alert(
            'Cache Corrupted',
            'The search cache appears to be corrupted. Would you like to repair it now? This will download fresh data from WaniKani.',
            [
              {
                text: 'Repair Now',
                onPress: () => handleRepairCache(),
              },
              {
                text: 'Try Anyway',
                style: 'cancel',
                onPress: async () => {
                  // Try to load anyway
                  try {
                    const response = await getSubjects(apiToken, {}, { skipCollectionCache: true });
                    setAllSubjects(response.data);
                  } catch {
                    setError('Failed to load subjects. Try repairing the cache.');
                  }
                },
              },
            ]
          );
          setIsLoadingSubjects(false);
          return;
        }
      }

      const response = await getSubjects(apiToken, {}, { skipCollectionCache: true });
      setAllSubjects(response.data);
    } catch {
      setError('Failed to load subjects for search. Please try again.');
    } finally {
      setIsLoadingSubjects(false);
    }
  }, [apiToken, handleRepairCache]);

  const performSearch = useCallback((query: string) => {
    if (!allSubjects) return;

    setIsLoading(true);
    
    // Use setTimeout to avoid blocking the UI
    setTimeout(() => {
      try {
        const kanaQuery = convertToKana(query);
        const maxResults = query.length <= 2 ? 25 : 50; // Fewer results for short queries
        
        const results: SearchResult[] = [];
        
        // For very short queries (1-2 chars), be more selective to improve performance
        const isShortQuery = query.length <= 2;
        
        // Search through all subjects with early termination
        for (let i = 0; i < allSubjects.length && results.length < maxResults; i++) {
          const subject = allSubjects[i];
          
          // Early termination: if we've processed many subjects but found few results,
          // and it's a short query, break early to avoid unnecessary processing
          if (isShortQuery && i > 2000 && results.length < 5) {
            break;
          }
          
          // For short queries, apply stricter matching to reduce false positives
          let matches = false;
          
          if (isShortQuery) {
            // For short queries, prioritize exact matches and character matches
            if (subject.data.characters === query) {
              matches = true;
            } else if (subject.data.characters && subject.data.characters.startsWith(query)) {
              matches = true;
            } else {
              // Check for exact meaning matches only
              for (const meaning of subject.data.meanings) {
                if (meaning.meaning.toLowerCase() === query.toLowerCase()) {
                  matches = true;
                  break;
                }
              }
              
              // Check for exact reading matches
              if (!matches && subject.data.readings && kanaQuery.length > 0) {
                for (const reading of subject.data.readings) {
                  if (reading.reading === kanaQuery) {
                    matches = true;
                    break;
                  }
                }
              }
            }
          } else {
            // For longer queries, use the normal matching logic
            matches = subjectMatchesQuery(subject, query, kanaQuery);
          }
          
          if (matches) {
            results.push({
              id: subject.id,
              characters: subject.data.characters || subject.data.meanings[0]?.meaning || '',
              meaning: subject.data.meanings.find(m => m.primary)?.meaning || 
                      subject.data.meanings[0]?.meaning || '',
              type: subject.object as WaniKaniItemType,
              level: subject.data.level || 1
            });
          }
        }

        // Sort results: exact matches first, then by level (based on Swift implementation)
        results.sort((a, b) => {
          const aMatchesExactly = subjectMatchesQueryExactly(
            allSubjects.find(s => s.id === a.id)!, 
            query, 
            kanaQuery
          );
          const bMatchesExactly = subjectMatchesQueryExactly(
            allSubjects.find(s => s.id === b.id)!, 
            query, 
            kanaQuery
          );
          
          if (aMatchesExactly && !bMatchesExactly) return -1;
          if (!aMatchesExactly && bMatchesExactly) return 1;
          
          // Then sort by level
          if (a.level < b.level) return -1;
          if (a.level > b.level) return 1;
          
          return 0;
        });

        setSearchResults(results);
      } catch {
        setError('Search failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }, 0);
  }, [allSubjects]);

  const handleSubjectPress = useCallback((subjectId: number) => {
    // Close the search modal first, then navigate to subject details
    // This is necessary because React Native modals block navigation
    onClose();
    router.push(`/subject/${subjectId}`);
  }, [onClose, router]);

  const getItemColor = (type: WaniKaniItemType) => {
    return getSubjectTypeColor(type);
  };

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity 
      style={[styles.itemContainer, { backgroundColor: theme.cardBackground }]} 
      activeOpacity={0.7}
      onPress={() => handleSubjectPress(item.id)}
    >
      <View style={[
        styles.itemBox, 
        { backgroundColor: getItemColor(item.type) },
        (item.type === 'vocabulary' || item.type === 'kana_vocabulary') && 
        item.characters && item.characters.length > 1 && 
        { width: 48 + (item.characters.length - 2) * 24 + 16 }
      ]}>
        <Text 
          style={[styles.itemCharacter, fontStyles.japaneseText]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {item.characters || item.meaning}
        </Text>
      </View>
      <View style={styles.itemDetails}>
        <Text style={[styles.itemMeaning, { color: theme.textColor }]}>{item.meaning}</Text>
        <View style={styles.itemMetadata}>
          <Text style={[styles.itemType, { color: theme.textSecondary }]}>{item.type}</Text>
          <Text style={[styles.itemLevel, { color: theme.textLight }]}>Level {item.level}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const flatListData = useMemo(() => searchResults, [searchResults]);

  // Show loading/repairing state if subjects haven't been loaded yet
  if (isLoadingSubjects || isRepairing) {
    return (
      <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
        <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
          <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color={theme.headerText} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.headerText }]}>Search</Text>
          </View>

          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              {isRepairing ? 'Repairing cache...' : 'Loading subjects for search...'}
            </Text>
            {isRepairing && (
              <Text style={[styles.loadingSubtext, { color: theme.textLight }]}>
                This may take a moment
              </Text>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <TouchableOpacity 
            onPress={onClose} 
            style={styles.closeButton}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color={theme.headerText} />
          </TouchableOpacity>
          
          <View style={[styles.searchInputContainer, { backgroundColor: theme.cardBackground }]}>
            <Ionicons name="search" size={20} color={theme.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: theme.textColor }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search kanji, vocabulary, or meanings..."
              placeholderTextColor={theme.textSecondary}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {!allSubjects ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="download-outline" size={64} color={theme.textLight} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Loading search data...
              </Text>
            </View>
          ) : !searchQuery.trim() ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={64} color={theme.textLight} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Search for kanji, vocabulary, or meanings
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.textLight }]}>
                Type Japanese characters or English meanings
              </Text>
            </View>
          ) : isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                Searching...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={48} color={theme.error} />
              <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
              <View style={styles.errorButtonsContainer}>
                <TouchableOpacity
                  style={[styles.retryButton, { backgroundColor: theme.primary }]}
                  onPress={() => loadAllSubjects()}
                  activeOpacity={0.7}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
                {cacheHealthStatus && !cacheHealthStatus.isHealthy && (
                  <TouchableOpacity
                    style={[styles.repairButton, { backgroundColor: '#ff9500' }]}
                    onPress={handleRepairCache}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="build-outline" size={16} color="white" style={styles.repairIcon} />
                    <Text style={styles.retryButtonText}>Repair Cache</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : searchResults.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="file-tray-outline" size={48} color={theme.textLight} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No results found
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.textLight }]}>
                Try searching with different terms
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.resultsHeader}>
                <Text style={[styles.resultsCount, { color: theme.textSecondary }]}>
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                </Text>
              </View>
              <FlashList
                data={flatListData}
                renderItem={renderSearchResult}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginLeft: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: 44,
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  repairButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  repairIcon: {
    marginRight: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  errorButtonsContainer: {
    alignItems: 'center',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 1,
  },
  itemBox: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemCharacter: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  itemDetails: {
    flex: 1,
  },
  itemMeaning: {
    fontSize: 16,
    fontWeight: '500',
  },
  itemMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  itemType: {
    fontSize: 12,
    textTransform: 'capitalize',
    marginRight: 8,
  },
  itemLevel: {
    fontSize: 12,
  },
}); 
