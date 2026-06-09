import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useDashboardData } from '../../src/hooks/useDashboardData';
import { getSubjectTypeColor } from '../../src/utils/subjectColors';
import { useTheme } from '../../src/utils/theme';
import { useRemoteSvg, pickBestImage } from '../../src/utils/radicalSvg';

// Comprehensive romaji to hiragana conversion
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

  // Process character by character
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

  // Replace n/m with ん
  for (i = 0; i < result.length; i++) {
    if (nmChars.includes(result[i])) {
      result = result.substring(0, i) + 'ん' + result.substring(i + 1);
    }
  }

  // Remove lowercase letters from the END only
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

interface SubjectItem {
  id: number;
  object: 'radical' | 'kanji' | 'vocabulary' | 'kana_vocabulary';
  characters: string | null;
  meanings: { meaning: string; primary: boolean }[];
  readings?: { reading: string; primary: boolean }[];
  level: number;
  srs_stage: number;
  character_images?: any[];
}

export default function SrsSubjectsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { srsStage, stageName, exactStage } = useLocalSearchParams<{
    srsStage: string;
    stageName: string;
    exactStage: string;
  }>();
  const { dashboardData, isLoading } = useDashboardData();
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSubjects, setFilteredSubjects] = useState<SubjectItem[]>([]);

  useEffect(() => {
    if (!dashboardData.subjects || !dashboardData.assignments || !srsStage) return;

    // Get assignments for the SRS stage range
    const stageNumber = parseInt(srsStage);
    let stageFilter: (stage: number) => boolean;
    
    const useExactStage = exactStage === 'true';

    if (useExactStage) {
      stageFilter = (stage) => stage === stageNumber;
    } else {
      // Handle stage ranges for grouped SRS levels
      switch (stageNumber) {
        case 1: // Apprentice - includes stages 1-4
          stageFilter = (stage) => stage >= 1 && stage <= 4;
          break;
        case 5: // Guru - includes stages 5-6
          stageFilter = (stage) => stage >= 5 && stage <= 6;
          break;
        case 7: // Master - stage 7 only
          stageFilter = (stage) => stage === 7;
          break;
        case 8: // Enlightened - stage 8 only
          stageFilter = (stage) => stage === 8;
          break;
        case 9: // Burned - stage 9 only
          stageFilter = (stage) => stage === 9;
          break;
        default:
          stageFilter = (stage) => stage === stageNumber;
      }
    }
    
    const assignmentsForStage = dashboardData.assignments.filter(
      assignment => stageFilter(assignment.data.srs_stage)
    );

    // Create a map of subject_id to actual SRS stage for more accurate display
    const subjectToSrsStage = new Map<number, number>();
    assignmentsForStage.forEach(assignment => {
      subjectToSrsStage.set(assignment.data.subject_id, assignment.data.srs_stage);
    });

    // Map assignments to subjects
    const subjectIds = assignmentsForStage.map(assignment => assignment.data.subject_id);
    const subjectsForStage = dashboardData.subjects
      .filter(subject => subjectIds.includes(subject.id))
      .map(subject => ({
        id: subject.id,
        object: subject.object,
        characters: subject.data.characters,
        meanings: subject.data.meanings,
        readings: subject.data.readings,
        level: subject.data.level,
        srs_stage: subjectToSrsStage.get(subject.id) || stageNumber,
        character_images: subject.data.character_images,
      }))
      .sort((a, b) => {
        // Sort by SRS stage first, then level, then object type, then characters
        if (a.srs_stage !== b.srs_stage) return a.srs_stage - b.srs_stage;
        if (a.level !== b.level) return a.level - b.level;
        
        const objectOrder = { radical: 0, kanji: 1, vocabulary: 2, kana_vocabulary: 3 } as const;
        if (a.object !== b.object) {
          return objectOrder[a.object as keyof typeof objectOrder] - objectOrder[b.object as keyof typeof objectOrder];
        }
        
        const aChar = a.characters || '';
        const bChar = b.characters || '';
        return aChar.localeCompare(bChar);
      });

    setSubjects(subjectsForStage);
  }, [dashboardData.subjects, dashboardData.assignments, exactStage, srsStage]);

  // Filter subjects based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSubjects(subjects);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const kanaQuery = convertToKana(query); // Convert romaji to hiragana
    
    const filtered = subjects.filter(subject => {
      // Search in meanings
      const meaningMatch = subject.meanings.some(meaning => 
        meaning.meaning.toLowerCase().includes(query)
      );

      // Search in readings with both original query and kana-converted query
      const readingMatch = subject.readings?.some(reading => {
        const readingLower = reading.reading.toLowerCase();
        return readingLower.includes(query) || readingLower.includes(kanaQuery);
      }) || false;

      // Search in characters
      const characterMatch = subject.characters?.toLowerCase().includes(query) || 
                           subject.characters?.includes(kanaQuery) || false;

      return meaningMatch || readingMatch || characterMatch;
    });

    setFilteredSubjects(filtered);
  }, [subjects, searchQuery]);

  const getSubjectColor = (object: string) => {
    if (
      object === "radical" ||
      object === "kanji" ||
      object === "vocabulary" ||
      object === "kana_vocabulary"
    ) {
      return getSubjectTypeColor(object);
    }

    return "#666";
  };

  const getSrsStageLabel = (stage: number): string => {
    switch (stage) {
      case 1: return 'Apprentice 1';
      case 2: return 'Apprentice 2';
      case 3: return 'Apprentice 3';
      case 4: return 'Apprentice 4';
      case 5: return 'Guru 1';
      case 6: return 'Guru 2';
      case 7: return 'Master';
      case 8: return 'Enlightened';
      case 9: return 'Burned';
      default: return `Stage ${stage}`;
    }
  };

  const handleSubjectPress = (subjectId: number) => {
    router.push(`/subject/${subjectId}`);
  };


  const SubjectCharacter = ({ item }: { item: SubjectItem }) => {
    const isRadical = item.object === 'radical';
    
    // For radicals, try SVG fallback if no characters
    const bestImg = isRadical && item.character_images?.length 
      ? pickBestImage(item.character_images) 
      : null;
    const svgUrl = bestImg?.type === 'svg' ? bestImg.url : null;
    const svgXml = useRemoteSvg(svgUrl, '#ffffff'); // White color for visibility
    
    // Display logic: characters → SVG → meaning
    if (item.characters) {
      return <Text style={styles.subjectCharacter}>
        {item.characters}
      </Text>;
    }
    
    if (svgXml) {
      return <SvgXml xml={svgXml} width={20} height={20} />;
    }
    
    // Fallback to meaning for radicals without characters or SVG
    const primaryMeaning = item.meanings.find(m => m.primary)?.meaning || item.meanings[0]?.meaning || '?';
    return <Text style={styles.subjectCharacter}>
      {primaryMeaning}
    </Text>;
  };

  const renderSubject = ({ item }: { item: SubjectItem }) => {
    const primaryMeaning = item.meanings.find(m => m.primary)?.meaning || item.meanings[0]?.meaning || '';
    
    return (
      <TouchableOpacity
        style={[styles.subjectCard, { backgroundColor: theme.cardBackground }]}
        onPress={() => handleSubjectPress(item.id)}
      >
        <View 
          style={[
            styles.subjectIcon, 
            { backgroundColor: getSubjectColor(item.object) },
            // Make vocabulary boxes wider based on character length with more padding
            item.object === 'vocabulary' && 
            item.characters && 
            item.characters.length > 1 && 
            { width: 48 + (item.characters.length - 1) * 24 + 8 }
          ]}
        >
          <SubjectCharacter item={item} />
        </View>
        
        <View style={styles.subjectInfo}>
          <Text style={[styles.subjectMeaning, { color: theme.textColor }]}>
            {primaryMeaning}
          </Text>
          <View style={styles.subjectMeta}>
            <Text style={[styles.subjectLevel, { color: theme.textSecondary }]}>
              Level {item.level}
            </Text>
            <Text style={[styles.subjectType, { color: theme.textSecondary }]}>
              {item.object.charAt(0).toUpperCase() + item.object.slice(1)}
            </Text>
          </View>
        </View>
        
        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
      </TouchableOpacity>
    );
  };

  if (isLoading && subjects.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.headerText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.headerText }]}>
            {stageName || `SRS Stage ${srsStage}`}
          </Text>
        </View>
        
        {/* Search Bar - disabled during loading */}
        <View style={[styles.searchContainer, { backgroundColor: theme.backgroundColor }]}>
          <View style={[styles.searchInputContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border, opacity: 0.5 }]}>
            <Ionicons name="search" size={20} color={theme.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: theme.textColor }]}
              placeholder="Search by meaning or reading..."
              placeholderTextColor={theme.textSecondary}
              editable={false}
            />
          </View>
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.secondary} />
          <Text style={[styles.loadingText, { color: theme.textColor }]}>
            Loading subjects...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.headerText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.headerText }]}>
          {stageName || `SRS Stage ${srsStage}`}
        </Text>
        <Text style={[styles.headerSubtitle, { color: theme.headerText }]}>
          {filteredSubjects.length} of {subjects.length} items
        </Text>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.backgroundColor }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Ionicons name="search" size={20} color={theme.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: theme.textColor }]}
            placeholder="Search by meaning or reading..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredSubjects}
        renderItem={renderSubject}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 54,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    top: 54,
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  clearButton: {
    padding: 4,
  },
  listContainer: {
    padding: 16,
  },
  subjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  subjectIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  subjectCharacter: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    fontFamily: 'SourceHanSansJP-Bold',
  },
  subjectInfo: {
    flex: 1,
  },
  subjectMeaning: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  subjectMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  subjectLevel: {
    fontSize: 14,
  },
  subjectType: {
    fontSize: 14,
    textTransform: 'capitalize',
  },
});
