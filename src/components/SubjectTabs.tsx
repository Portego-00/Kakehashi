import { Audio, type AudioSound } from "@/src/utils/expoAvCompat";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";
import AudioSessionManager from "../modules/AudioSessionManager";
import { resolveOfflineVocabularyAudioUri } from "../services/offlineVocabularyAudioService";
import { Subject as ApiSubject } from "../utils/api";
import { fontStyles } from "../utils/fonts";
import { hiraganaToKata } from "../utils/katakanaMadness";
import { pickBestImage, useRemoteSvg } from "../utils/radicalSvg";
import { type SubjectColors, useSubjectColors } from "../utils/subjectColors";
import { useSettingsStore } from "../utils/store";
import { stripWaniKaniMnemonicMarkup } from "../utils/wanikaniMnemonic";

const { width } = Dimensions.get("window");

interface SubjectTabsProps {
  subject: any;
  activeTab?: number;
  onTabChange?: (index: number) => void;
  relatedSubjects?: { [key: number]: ApiSubject };
}

// Component to display a subject component (radical, kanji, etc.)
const SubjectComponent = ({
  id,
  type,
  subjectData,
  subjectColors,
  styles,
}: {
  id: number;
  type: string;
  subjectData?: ApiSubject;
  subjectColors: SubjectColors;
  styles: ReturnType<typeof createStyles>;
}) => {
  // Different background colors based on subject type
  const getBackgroundColor = () => {
    // Get type from the actual subject data if available
    const actualType = subjectData?.object || type;

    switch (actualType) {
      case "radical":
        return subjectColors.radical;
      case "kanji":
        return subjectColors.kanji;
      case "vocabulary":
      case "kana_vocabulary":
        return subjectColors.vocabulary;
      default:
        return "#666666";
    }
  };

  // Use real data if available
  if (subjectData) {
    const characters =
      subjectData.data.characters ||
      (subjectData.object === "radical" && !subjectData.data.characters
        ? subjectData.data.meanings[0].meaning
        : "?");

    const meaning =
      subjectData.data.meanings.find((m) => m.primary)?.meaning ||
      subjectData.data.meanings[0]?.meaning ||
      "Unknown";

    return (
      <View
        style={[styles.relatedItem, { backgroundColor: getBackgroundColor() }]}
      >
        <Text style={[styles.relatedItemCharacter, fontStyles.japaneseText]}>
          {characters}
        </Text>
        <Text style={styles.relatedItemMeaning}>{meaning}</Text>
      </View>
    );
  }

  // Fallback if no data available
  return (
    <View
      style={[styles.relatedItem, { backgroundColor: getBackgroundColor() }]}
    >
      <Text style={[styles.relatedItemCharacter, fontStyles.japaneseText]}>
        {id}
      </Text>
      <Text style={styles.relatedItemMeaning}>Loading...</Text>
    </View>
  );
};

// Component to display the subject tabs
export default function SubjectTabs({
  subject,
  activeTab: externalActiveTab,
  onTabChange,
  relatedSubjects = {},
}: SubjectTabsProps) {
  const subjectColors = useSubjectColors();
  const styles = useMemo(
    () => createStyles(subjectColors),
    [subjectColors]
  );
  // Determine the subject type to know which tabs to show
  const subjectType = subject.object;

  // Get settings
  const { showOnyomiInKatakana } = useSettingsStore();

  // State to track the active tab
  const [internalActiveTabIndex, setInternalActiveTabIndex] = useState(0);

  // Use either the external activeTab (if provided) or the internal state
  const activeTabIndex =
    externalActiveTab !== undefined
      ? externalActiveTab
      : internalActiveTabIndex;

  // Ref for the scroll view
  const scrollViewRef = useRef<ScrollView>(null);

  // Audio for vocabulary pronunciation
  const [sound, setSound] = useState<AudioSound | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Effect to update scroll position when activeTabIndex changes
  useEffect(() => {
    scrollViewRef.current?.scrollTo({
      x: activeTabIndex * width,
      animated: true,
    });
  }, [activeTabIndex]);

  // Get tabs based on subject type
  const getTabs = () => {
    switch (subjectType) {
      case "radical":
        return ["Name & Mnemonic", "Found in Kanji"];
      case "kanji":
        return ["Radicals", "Meaning", "Readings", "Examples"];
      case "vocabulary":
      case "kana_vocabulary":
        return ["Kanji", "Meaning", "Reading", "Context"];
      default:
        return ["Info"];
    }
  };

  // Get the tabs for this subject type
  const tabs = getTabs();
  const radicalImage = useMemo(() => {
    if (
      !Array.isArray(subject.data.character_images) ||
      subject.data.character_images.length === 0
    ) {
      return null;
    }
    return pickBestImage(subject.data.character_images);
  }, [subject.data.character_images]);
  const radicalSvgUrl = radicalImage?.type === "svg" ? radicalImage.url : null;
  const radicalSvgXml = useRemoteSvg(radicalSvgUrl, subjectColors.radical);

  // Handle tab selection
  const handleTabPress = (index: number) => {
    if (onTabChange) {
      onTabChange(index);
    } else {
      setInternalActiveTabIndex(index);
    }
    scrollViewRef.current?.scrollTo({ x: index * width, animated: true });
  };

  // Helper to clean HTML from mnemonic text
  const cleanMnemonicText = (text: string) => {
    if (!text) return "";

    return stripWaniKaniMnemonicMarkup(text);
  };

  // Play audio for vocabulary items
  const playAudio = async () => {
    if (
      !subject.data.pronunciation_audios ||
      subject.data.pronunciation_audios.length === 0
    ) {
      return;
    }

    // Find an MP3 audio file
    const audioFile = subject.data.pronunciation_audios.find(
      (audio: any) => audio.content_type === "audio/mpeg"
    );

    if (!audioFile) return;

    try {
      // Override audio session to use speaker (iOS only) before playing audio
      if (Platform.OS === "ios") {
        try {
          await AudioSessionManager.overrideSpeaker();
          console.log(
            "Audio session overridden to use speaker before subject audio playback"
          );
        } catch (error) {
          console.warn("Failed to override audio session:", error);
        }
      }

      // Stop any previously playing audio
      if (sound) {
        await sound.unloadAsync();
      }

      setIsPlayingAudio(true);

      const cachedAudioUri = await resolveOfflineVocabularyAudioUri(
        subject.id,
        audioFile
      );

      // Create and play the audio
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: cachedAudioUri ?? audioFile.url },
        { shouldPlay: true }
      );

      setSound(newSound);

      // Handle audio completion
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlayingAudio(false);
        }
      });
    } catch (error) {
      console.error("Error playing audio:", error);
      setIsPlayingAudio(false);
    }
  };

  // Process radical character with SVG fallback
  const renderRadicalCharacter = () => {
    if (subject.data.characters) {
      return (
        <Text style={[styles.characterText, fontStyles.japaneseText]}>
          {subject.data.characters}
        </Text>
      );
    }
    if (
      Array.isArray(subject.data.character_images) &&
      subject.data.character_images.length > 0
    ) {
      if (radicalSvgXml) {
        return <SvgXml xml={radicalSvgXml} width={60} height={60} />;
      }
      if (radicalImage?.type === "png") {
        return (
          <Image
            source={{ uri: radicalImage.url }}
            style={styles.radicalImage}
            resizeMode="contain"
          />
        );
      }
    }
    return <Text style={styles.characterPlaceholder}>?</Text>;
  };

  // Render tab content based on subject type and active tab
  const renderTabContent = (tabIndex: number = activeTabIndex) => {
    switch (subjectType) {
      case "radical":
        return renderRadicalTabContent(tabIndex);
      case "kanji":
        return renderKanjiTabContent(tabIndex);
      case "vocabulary":
      case "kana_vocabulary":
        return renderVocabularyTabContent(tabIndex);
      default:
        return (
          <Text style={styles.noContentText}>No information available</Text>
        );
    }
  };

  // For Found in Kanji section
  const renderAmalgamationSubjects = (subjectIds: number[]) => {
    return subjectIds.map((id: number) => (
      <SubjectComponent
        key={id}
        id={id}
        type="kanji"
        subjectData={relatedSubjects[id]}
        subjectColors={subjectColors}
        styles={styles}
      />
    ));
  };

  // For Radicals section
  const renderComponentSubjects = (subjectIds: number[]) => {
    return subjectIds.map((id: number) => (
      <SubjectComponent
        key={id}
        id={id}
        type="radical"
        subjectData={relatedSubjects[id]}
        subjectColors={subjectColors}
        styles={styles}
      />
    ));
  };

  // For Vocabulary Examples section
  const renderVocabularySubjects = (subjectIds: number[]) => {
    return subjectIds.map((id: number) => (
      <SubjectComponent
        key={id}
        id={id}
        type="vocabulary"
        subjectData={relatedSubjects[id]}
        subjectColors={subjectColors}
        styles={styles}
      />
    ));
  };

  // Update renderRadicalTabContent to use the helper function
  const renderRadicalTabContent = (tabIndex: number = activeTabIndex) => {
    if (tabIndex === 0) {
      // Name & Mnemonic tab
      return (
        <View style={styles.tabContent}>
          <View style={styles.characterContainer}>
            {renderRadicalCharacter()}
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Meaning</Text>
            <Text style={styles.meaningText}>
              {subject.data.meanings.find((m: any) => m.primary)?.meaning ||
                subject.data.meanings[0]?.meaning ||
                "No meaning available"}
            </Text>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Mnemonic</Text>
            <Text style={styles.mnemonicText}>
              {cleanMnemonicText(subject.data.meaning_mnemonic) ||
                "No mnemonic available"}
            </Text>
          </View>
        </View>
      );
    } else {
      // Found in Kanji tab
      return (
        <View style={styles.tabContent}>
          <Text style={styles.sectionTitle}>Found in Kanji</Text>

          {subject.data.amalgamation_subject_ids &&
          subject.data.amalgamation_subject_ids.length > 0 ? (
            <>
              <Text style={styles.noteText}>
                This radical is used in the following kanji:
              </Text>
              <View style={styles.relatedItemsGrid}>
                {renderAmalgamationSubjects(
                  subject.data.amalgamation_subject_ids.slice(0, 10)
                )}
              </View>
            </>
          ) : (
            <Text style={styles.noteText}>
              This radical is not used in any kanji yet.
            </Text>
          )}
        </View>
      );
    }
  };

  // Update renderKanjiTabContent to use the helper functions
  const renderKanjiTabContent = (tabIndex: number = activeTabIndex) => {
    switch (tabIndex) {
      case 0: // Radicals tab
        return (
          <View style={styles.tabContent}>
            <View style={styles.characterContainer}>
              <Text
                style={[styles.kanjiCharacterText, fontStyles.japaneseBold]}
              >
                {subject.data.characters}
              </Text>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Radicals</Text>

              {subject.data.component_subject_ids &&
              subject.data.component_subject_ids.length > 0 ? (
                <>
                  <Text style={styles.noteText}>
                    This kanji is composed of the following radicals:
                  </Text>
                  <View style={styles.relatedItemsGrid}>
                    {renderComponentSubjects(
                      subject.data.component_subject_ids
                    )}
                  </View>
                </>
              ) : (
                <Text style={styles.noteText}>
                  This kanji is not composed of any radicals.
                </Text>
              )}
            </View>
          </View>
        );

      case 1: // Meaning tab
        return (
          <View style={styles.tabContent}>
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Meaning</Text>
              <Text style={styles.meaningText}>
                {subject.data.meanings.find((m: any) => m.primary)?.meaning ||
                  subject.data.meanings[0]?.meaning ||
                  "No meaning available"}
              </Text>

              {subject.data.meanings.length > 1 && (
                <View style={styles.alternativeMeanings}>
                  <Text style={styles.altMeaningsLabel}>
                    Alternative Meanings:
                  </Text>
                  <Text style={styles.altMeaningsText}>
                    {subject.data.meanings
                      .filter((m: any) => !m.primary)
                      .map((m: any) => m.meaning)
                      .join(", ")}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Mnemonic</Text>
              <Text style={styles.mnemonicText}>
                {cleanMnemonicText(subject.data.meaning_mnemonic) ||
                  "No mnemonic available"}
              </Text>
            </View>
          </View>
        );

      case 2: // Readings tab
        return (
          <View style={styles.tabContent}>
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Readings</Text>

              {subject.data.readings && subject.data.readings.length > 0 ? (
                <>
                  <View style={styles.readingsContainer}>
                    <Text style={styles.readingTypeLabel}>On&apos;yomi:</Text>
                    <View style={styles.readingBadges}>
                      {subject.data.readings
                        .filter((r: any) => r.type === "onyomi")
                        .map((r: any, index: number) => (
                          <View
                            key={`on-${index}`}
                            style={[
                              styles.readingBadge,
                              r.primary && styles.primaryReadingBadge,
                            ]}
                          >
                            <Text
                              style={[
                                styles.readingBadgeText,
                                r.primary && styles.primaryReadingBadgeText,
                                fontStyles.japaneseText,
                              ]}
                            >
                              {showOnyomiInKatakana
                                ? hiraganaToKata(r.reading)
                                : r.reading}
                            </Text>
                          </View>
                        ))}
                    </View>
                  </View>

                  <View style={styles.readingsContainer}>
                    <Text style={styles.readingTypeLabel}>Kun&apos;yomi:</Text>
                    <View style={styles.readingBadges}>
                      {subject.data.readings
                        .filter((r: any) => r.type === "kunyomi")
                        .map((r: any, index: number) => (
                          <View
                            key={`kun-${index}`}
                            style={[
                              styles.readingBadge,
                              r.primary && styles.primaryReadingBadge,
                            ]}
                          >
                            <Text
                              style={[
                                styles.readingBadgeText,
                                r.primary && styles.primaryReadingBadgeText,
                                fontStyles.japaneseText,
                              ]}
                            >
                              {r.reading}
                            </Text>
                          </View>
                        ))}
                    </View>
                  </View>
                </>
              ) : (
                <Text style={styles.noteText}>
                  No readings available for this kanji.
                </Text>
              )}
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Reading Mnemonic</Text>
              <Text style={styles.mnemonicText}>
                {cleanMnemonicText(subject.data.reading_mnemonic) ||
                  "No reading mnemonic available"}
              </Text>
            </View>
          </View>
        );

      case 3: // Examples tab
        return (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Vocabulary Examples</Text>

            {subject.data.amalgamation_subject_ids &&
            subject.data.amalgamation_subject_ids.length > 0 ? (
              <>
                <Text style={styles.noteText}>
                  This kanji is used in the following vocabulary:
                </Text>
                <View style={styles.relatedItemsGrid}>
                  {renderVocabularySubjects(
                    subject.data.amalgamation_subject_ids.slice(0, 15)
                  )}
                </View>
              </>
            ) : (
              <Text style={styles.noteText}>
                No vocabulary examples available for this kanji yet.
              </Text>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  // Update renderVocabularyTabContent to use the helper function
  const renderVocabularyTabContent = (tabIndex: number = activeTabIndex) => {
    switch (tabIndex) {
      case 0: // Kanji Composition tab
        return (
          <View style={styles.tabContent}>
            <View style={styles.characterContainer}>
              <Text
                style={[styles.vocabCharacterText, fontStyles.japaneseBold]}
              >
                {subject.data.characters}
              </Text>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Composition</Text>

              {subject.data.component_subject_ids &&
              subject.data.component_subject_ids.length > 0 ? (
                <>
                  <Text style={styles.noteText}>
                    This vocabulary is composed of the following kanji:
                  </Text>
                  <View style={styles.relatedItemsGrid}>
                    {renderComponentSubjects(
                      subject.data.component_subject_ids
                    )}
                  </View>
                </>
              ) : (
                <Text style={styles.noteText}>
                  This vocabulary is not composed of any separate kanji.
                </Text>
              )}
            </View>
          </View>
        );

      case 1: // Meaning tab
        return (
          <View style={styles.tabContent}>
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Meaning</Text>
              <Text style={styles.meaningText}>
                {subject.data.meanings.find((m: any) => m.primary)?.meaning ||
                  subject.data.meanings[0]?.meaning ||
                  "No meaning available"}
              </Text>

              {subject.data.meanings.length > 1 && (
                <View style={styles.alternativeMeanings}>
                  <Text style={styles.altMeaningsLabel}>
                    Alternative Meanings:
                  </Text>
                  <Text style={styles.altMeaningsText}>
                    {subject.data.meanings
                      .filter((m: any) => !m.primary)
                      .map((m: any) => m.meaning)
                      .join(", ")}
                  </Text>
                </View>
              )}

              {subject.data.parts_of_speech &&
                subject.data.parts_of_speech.length > 0 && (
                  <View style={styles.partsOfSpeech}>
                    <Text style={styles.posLabel}>Part of Speech:</Text>
                    <Text style={styles.posText}>
                      {subject.data.parts_of_speech.join(", ")}
                    </Text>
                  </View>
                )}
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Mnemonic</Text>
              <Text style={styles.mnemonicText}>
                {cleanMnemonicText(subject.data.meaning_mnemonic) ||
                  "No mnemonic available"}
              </Text>
            </View>
          </View>
        );

      case 2: // Reading tab
        return (
          <View style={styles.tabContent}>
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Reading</Text>

              {subject.data.readings && subject.data.readings.length > 0 ? (
                <>
                  <View style={styles.readingsContainer}>
                    <View style={styles.readingBadges}>
                      {subject.data.readings.map((r: any, index: number) => (
                        <View
                          key={`reading-${index}`}
                          style={[
                            styles.readingBadge,
                            r.primary && styles.primaryReadingBadge,
                          ]}
                        >
                          <Text
                            style={[
                              styles.readingBadgeText,
                              r.primary && styles.primaryReadingBadgeText,
                              fontStyles.japaneseText,
                            ]}
                          >
                            {r.reading}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {subject.data.pronunciation_audios &&
                    subject.data.pronunciation_audios.length > 0 && (
                      <TouchableOpacity
                        style={styles.audioButton}
                        onPress={playAudio}
                        disabled={isPlayingAudio}
                      >
                        <Text style={styles.audioButtonText}>
                          {isPlayingAudio ? "Playing Audio..." : "Play Audio"}
                        </Text>
                      </TouchableOpacity>
                    )}
                </>
              ) : (
                <Text style={styles.noteText}>
                  No readings available for this vocabulary.
                </Text>
              )}
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Reading Mnemonic</Text>
              <Text style={styles.mnemonicText}>
                {cleanMnemonicText(subject.data.reading_mnemonic) ||
                  "No reading mnemonic available"}
              </Text>
            </View>
          </View>
        );

      case 3: // Context tab
        return (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Context Sentences</Text>

            {subject.data.context_sentences &&
            subject.data.context_sentences.length > 0 ? (
              <View style={styles.sentencesContainer}>
                {subject.data.context_sentences.map(
                  (sentence: any, index: number) => (
                    <View key={`sentence-${index}`} style={styles.sentenceItem}>
                      <Text style={styles.japaneseSentence}>{sentence.ja}</Text>
                      <Text style={styles.englishSentence}>{sentence.en}</Text>
                    </View>
                  )
                )}
              </View>
            ) : (
              <Text style={styles.noteText}>
                No context sentences available for this vocabulary.
              </Text>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab, index) => (
          <TouchableOpacity
            key={`tab-${index}`}
            style={[styles.tab, activeTabIndex === index && styles.activeTab]}
            onPress={() => handleTabPress(index)}
          >
            <Text
              style={[
                styles.tabText,
                activeTabIndex === index && styles.activeTabText,
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const newIndex = Math.round(
            event.nativeEvent.contentOffset.x / width
          );
          if (onTabChange) {
            onTabChange(newIndex);
          } else {
            setInternalActiveTabIndex(newIndex);
          }
        }}
        scrollEventThrottle={16}
      >
        {tabs.map((_, index) => (
          <View key={`content-${index}`} style={styles.scrollPage}>
            {renderTabContent(index)}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (subjectColors: SubjectColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#f9f9f9",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: subjectColors.kanji,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  activeTabText: {
    color: subjectColors.kanji,
    fontWeight: "bold",
  },
  scrollPage: {
    width,
    paddingBottom: 20,
  },
  tabContent: {
    padding: 16,
  },
  characterContainer: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  characterText: {
    fontSize: 60,
    color: subjectColors.radical,
    fontFamily: "SourceHanSansJP-Bold",
  },
  kanjiCharacterText: {
    fontSize: 60,
    color: subjectColors.kanji,
    fontFamily: "SourceHanSansJP-Bold",
  },
  vocabCharacterText: {
    fontSize: 50,
    color: subjectColors.vocabulary,
    fontFamily: "SourceHanSansJP-Bold",
  },
  characterPlaceholder: {
    fontSize: 60,
    color: "#ccc",
  },
  radicalImage: {
    width: 100,
    height: 100,
  },
  infoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  meaningText: {
    fontSize: 18,
    color: "#333",
    marginBottom: 8,
  },
  mnemonicText: {
    fontSize: 16,
    color: "#444",
    lineHeight: 24,
  },
  noteText: {
    fontSize: 16,
    color: "#666",
    fontStyle: "italic",
  },
  noContentText: {
    padding: 16,
    fontSize: 16,
    color: "#666",
    fontStyle: "italic",
    textAlign: "center",
  },
  alternativeMeanings: {
    marginVertical: 8,
  },
  altMeaningsLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 4,
  },
  altMeaningsText: {
    fontSize: 16,
    color: "#333",
  },
  partsOfSpeech: {
    marginTop: 8,
  },
  posLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 4,
  },
  posText: {
    fontSize: 14,
    color: "#333",
    fontStyle: "italic",
  },
  readingsContainer: {
    marginVertical: 8,
  },
  readingTypeLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 8,
  },
  readingBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  readingBadge: {
    backgroundColor: "#f5f5f9",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 4,
  },
  primaryReadingBadge: {
    backgroundColor: subjectColors.vocabulary,
  },
  readingBadgeText: {
    color: "#666",
    fontSize: 16,
  },
  primaryReadingBadgeText: {
    color: "white",
    fontWeight: "bold",
  },
  audioButton: {
    backgroundColor: subjectColors.vocabulary,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
    marginTop: 12,
  },
  audioButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  sentencesContainer: {
    marginTop: 8,
  },
  sentenceItem: {
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: subjectColors.vocabulary,
    paddingLeft: 12,
  },
  japaneseSentence: {
    fontSize: 18,
    color: "#333",
    marginBottom: 4,
    fontFamily: "SourceHanSansJP-Regular",
  },
  englishSentence: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
  },
  relatedItemsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    justifyContent: "flex-start",
  },
  relatedItem: {
    width: 80,
    height: 80,
    borderRadius: 8,
    padding: 8,
    margin: 4,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 1,
    elevation: 1,
  },
  relatedItemCharacter: {
    fontSize: 24,
    color: "white",
    fontWeight: "bold",
    marginBottom: 4,
    fontFamily: "SourceHanSansJP-Bold",
  },
  relatedItemMeaning: {
    fontSize: 10,
    color: "white",
    textAlign: "center",
  },
});
