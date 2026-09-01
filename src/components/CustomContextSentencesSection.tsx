import { Ionicons } from "@expo/vector-icons";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  deleteCustomContextSentence,
  getCustomContextSentencesForSubject,
  updateCustomContextSentence,
  upsertCustomContextSentence,
} from "../services/customContextSentenceService";
import type {
  CustomContextSentence,
  CustomContextSentenceDisplayMode,
} from "../types/customContextSentence";
import { azureSpeechService } from "../utils/azureSpeech";
import { azureTranslatorService } from "../utils/azureTranslator";
import { tryBlankContextSentence } from "../utils/contextSentenceCloze";
import { getReadableTextColor, withAlpha } from "../utils/subjectColors";
import { useAuthStore } from "../utils/store";
import { useTheme } from "../utils/theme";

const TRANSLATION_DEBOUNCE_MS = 650;
const ICON_HIT_SLOP = { top: 4, right: 4, bottom: 4, left: 4 };

type ManuallyEditedField = "japanese" | "kana" | "english" | null;

export interface CustomContextSentencesSectionProps {
  subjectId: number;
  subjectCharacters: string;
  subjectReadings: readonly string[];
  accentColor?: string;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

function hasNonAbortFailure(
  results: readonly PromiseSettledResult<string>[],
): boolean {
  return results.some(
    (result) => result.status === "rejected" && !isAbortError(result.reason),
  );
}

export function CustomContextSentencesSection({
  subjectId,
  subjectCharacters,
  subjectReadings,
  accentColor,
}: CustomContextSentencesSectionProps) {
  const { theme } = useTheme();
  const userId = useAuthStore((state) => state.userData?.id ?? null);
  const resolvedAccentColor = accentColor ?? theme.primary;
  const accentTextColor = getReadableTextColor(resolvedAccentColor);

  const [sentences, setSentences] = useState<CustomContextSentence[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftJapanese, setDraftJapanese] = useState("");
  const [draftKana, setDraftKana] = useState("");
  const [draftEnglish, setDraftEnglish] = useState("");
  const [draftDisplayMode, setDraftDisplayMode] =
    useState<CustomContextSentenceDisplayMode>("kanji");
  const [lastEditedField, setLastEditedField] =
    useState<ManuallyEditedField>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const translationGenerationRef = useRef(0);
  const translationAbortRef = useRef<AbortController | null>(null);
  const playbackGenerationRef = useRef(0);

  const japaneseVocabularyForms = useMemo(
    () =>
      subjectCharacters.trim().length > 0 ? [subjectCharacters.trim()] : [],
    [subjectCharacters],
  );
  const kanaVocabularyForms = useMemo(
    () =>
      Array.from(
        new Set(subjectReadings.map((value) => value.trim()).filter(Boolean)),
      ),
    [subjectReadings],
  );

  const selectedJapaneseDraft =
    draftDisplayMode === "kana" ? draftKana : draftJapanese;
  const japaneseDraftMatchesSubject =
    draftJapanese.trim().length > 0 &&
    tryBlankContextSentence(draftJapanese, japaneseVocabularyForms) !== null;
  const kanaDraftMatchesSubject =
    draftKana.trim().length > 0 &&
    tryBlankContextSentence(
      draftKana,
      kanaVocabularyForms.length > 0
        ? kanaVocabularyForms
        : japaneseVocabularyForms,
      { allowShortKanaConjugation: japaneseDraftMatchesSubject },
    ) !== null;
  const completeDraftMatchesSubject =
    japaneseDraftMatchesSubject && kanaDraftMatchesSubject;
  const hasCompleteDraft = Boolean(
    draftJapanese.trim() && draftKana.trim() && draftEnglish.trim(),
  );
  const canSave = Boolean(
    userId &&
      hasCompleteDraft &&
      completeDraftMatchesSubject &&
      !isTranslating &&
      !isSaving,
  );

  const cancelTranslations = useCallback(() => {
    translationGenerationRef.current += 1;
    translationAbortRef.current?.abort();
    translationAbortRef.current = null;
    if (mountedRef.current) {
      setIsTranslating(false);
    }
  }, []);

  const stopPlayback = useCallback(async () => {
    playbackGenerationRef.current += 1;
    if (mountedRef.current) {
      setPlayingId(null);
    }
    await azureSpeechService.stop();
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      translationGenerationRef.current += 1;
      translationAbortRef.current?.abort();
      translationAbortRef.current = null;
      playbackGenerationRef.current += 1;
      void azureSpeechService.stop();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      setSentences([]);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);
    setSectionError(null);

    void getCustomContextSentencesForSubject(userId, subjectId)
      .then((storedSentences) => {
        if (!cancelled) {
          setSentences(storedSentences);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSectionError("Saved sentences couldn't be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [subjectId, userId]);

  const translationSourceText =
    lastEditedField === "japanese"
      ? draftJapanese
      : lastEditedField === "kana"
        ? draftKana
        : lastEditedField === "english"
          ? draftEnglish
          : "";

  useEffect(() => {
    if (!editorVisible || !lastEditedField || !translationSourceText.trim()) {
      return;
    }

    const requestGeneration = translationGenerationRef.current;
    let controller: AbortController | null = null;

    const timeout = setTimeout(() => {
      controller = new AbortController();
      translationAbortRef.current = controller;
      setIsTranslating(true);
      setTranslationError(null);

      const isCurrentRequest = () =>
        mountedRef.current &&
        !controller?.signal.aborted &&
        translationGenerationRef.current === requestGeneration;

      const showTranslationFailure = () => {
        if (isCurrentRequest()) {
          setTranslationError(
            "Translation couldn't update. You can keep editing.",
          );
        }
      };

      const synchronizeDraft = async () => {
        const sourceText = translationSourceText.trim();

        if (lastEditedField === "japanese") {
          const results = await Promise.allSettled([
            azureTranslatorService.translate(sourceText, "ja", "en", {
              signal: controller?.signal,
            }),
            azureTranslatorService.transliterateJapaneseToKana(sourceText, {
              signal: controller?.signal,
            }),
          ]);

          if (!isCurrentRequest()) {
            return;
          }

          const [englishResult, kanaResult] = results;
          if (englishResult.status === "fulfilled") {
            setDraftEnglish(englishResult.value);
          }
          if (kanaResult.status === "fulfilled") {
            setDraftKana(kanaResult.value);
          }
          if (hasNonAbortFailure(results)) {
            showTranslationFailure();
          }
          return;
        }

        if (lastEditedField === "english") {
          try {
            const japanese = await azureTranslatorService.translate(
              sourceText,
              "en",
              "ja",
              { signal: controller?.signal },
            );
            if (!isCurrentRequest()) {
              return;
            }
            setDraftJapanese(japanese);

            const kana =
              await azureTranslatorService.transliterateJapaneseToKana(
                japanese,
                { signal: controller?.signal },
              );
            if (isCurrentRequest()) {
              setDraftKana(kana);
            }
          } catch (error) {
            if (!isAbortError(error)) {
              showTranslationFailure();
            }
          }
          return;
        }

        try {
          const english = await azureTranslatorService.translate(
            sourceText,
            "ja",
            "en",
            { signal: controller?.signal },
          );
          if (!isCurrentRequest()) {
            return;
          }
          setDraftEnglish(english);

          const commonKanjiJapanese = await azureTranslatorService.translate(
            english,
            "en",
            "ja",
            { signal: controller?.signal },
          );
          if (isCurrentRequest()) {
            setDraftJapanese(commonKanjiJapanese);
          }
        } catch (error) {
          if (!isAbortError(error)) {
            showTranslationFailure();
          }
        }
      };

      void synchronizeDraft().finally(() => {
        if (isCurrentRequest()) {
          setIsTranslating(false);
          translationAbortRef.current = null;
        }
      });
    }, TRANSLATION_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeout);
      translationGenerationRef.current += 1;
      controller?.abort();
      if (translationAbortRef.current === controller) {
        translationAbortRef.current = null;
      }
    };
  }, [editorVisible, lastEditedField, translationSourceText]);

  const resetEditor = useCallback(() => {
    setEditingId(null);
    setDraftJapanese("");
    setDraftKana("");
    setDraftEnglish("");
    setDraftDisplayMode("kanji");
    setLastEditedField(null);
    setTranslationError(null);
    setEditorError(null);
    setIsSaving(false);
  }, []);

  const openNewEditor = useCallback(() => {
    cancelTranslations();
    void stopPlayback();
    resetEditor();
    setEditorVisible(true);
  }, [cancelTranslations, resetEditor, stopPlayback]);

  const openEditEditor = useCallback(
    (sentence: CustomContextSentence) => {
      cancelTranslations();
      void stopPlayback();
      setEditingId(sentence.id);
      setDraftJapanese(sentence.japanese);
      setDraftKana(sentence.kana);
      setDraftEnglish(sentence.english);
      setDraftDisplayMode(sentence.displayMode);
      setLastEditedField(null);
      setTranslationError(null);
      setEditorError(null);
      setIsSaving(false);
      setEditorVisible(true);
    },
    [cancelTranslations, stopPlayback],
  );

  const closeEditor = useCallback(() => {
    if (isSaving) {
      return;
    }
    cancelTranslations();
    void stopPlayback();
    setEditorVisible(false);
    resetEditor();
  }, [cancelTranslations, isSaving, resetEditor, stopPlayback]);

  const handleManualJapaneseChange = useCallback(
    (value: string) => {
      cancelTranslations();
      setTranslationError(null);
      setEditorError(null);
      if (draftDisplayMode === "kana") {
        setDraftKana(value);
        setLastEditedField("kana");
      } else {
        setDraftJapanese(value);
        setLastEditedField("japanese");
      }
    },
    [cancelTranslations, draftDisplayMode],
  );

  const handleManualEnglishChange = useCallback(
    (value: string) => {
      cancelTranslations();
      setTranslationError(null);
      setEditorError(null);
      setDraftEnglish(value);
      setLastEditedField("english");
    },
    [cancelTranslations],
  );

  const handleDisplayModeChange = useCallback((value: string) => {
    setDraftDisplayMode(value === "Kana" ? "kana" : "kanji");
    setEditorError(null);
  }, []);

  const handlePlay = useCallback(
    async (text: string, id: string) => {
      const normalizedText = text.trim();
      if (!normalizedText) {
        return;
      }

      const playbackGeneration = playbackGenerationRef.current + 1;
      playbackGenerationRef.current = playbackGeneration;

      try {
        if (playingId === id) {
          await azureSpeechService.stop();
          if (
            mountedRef.current &&
            playbackGenerationRef.current === playbackGeneration
          ) {
            setPlayingId(null);
          }
          return;
        }

        await azureSpeechService.stop();
        if (
          !mountedRef.current ||
          playbackGenerationRef.current !== playbackGeneration
        ) {
          return;
        }

        setPlayingId(id);
        await azureSpeechService.speak(
          normalizedText,
          undefined,
          () => {
            if (
              mountedRef.current &&
              playbackGenerationRef.current === playbackGeneration
            ) {
              setPlayingId(null);
            }
          },
          () => {
            if (
              mountedRef.current &&
              playbackGenerationRef.current === playbackGeneration
            ) {
              setPlayingId(null);
              if (editorVisible) {
                setEditorError("Audio couldn't play.");
              } else {
                setSectionError("Audio couldn't play.");
              }
            }
          },
        );
      } catch {
        if (
          mountedRef.current &&
          playbackGenerationRef.current === playbackGeneration
        ) {
          setPlayingId(null);
          if (editorVisible) {
            setEditorError("Audio couldn't play.");
          } else {
            setSectionError("Audio couldn't play.");
          }
        }
      }
    },
    [editorVisible, playingId],
  );

  const handleSave = useCallback(async () => {
    setEditorError(null);

    if (!userId) {
      setEditorError("Your WaniKani account couldn't be identified.");
      return;
    }

    if (!hasCompleteDraft) {
      setEditorError("Add Japanese, kana, and English before saving.");
      return;
    }

    if (!completeDraftMatchesSubject) {
      setEditorError(
        `Use ${subjectCharacters || "this vocabulary"} in the Japanese version and one of its readings in the kana version.`,
      );
      return;
    }

    cancelTranslations();
    setIsSaving(true);

    try {
      const savedSentence = await upsertCustomContextSentence(userId, {
        id: editingId ?? undefined,
        subjectId,
        japanese: draftJapanese,
        kana: draftKana,
        english: draftEnglish,
        displayMode: draftDisplayMode,
      });

      if (!mountedRef.current) {
        return;
      }

      setSentences((currentSentences) => {
        const sentenceIndex = currentSentences.findIndex(
          (sentence) => sentence.id === savedSentence.id,
        );
        if (sentenceIndex < 0) {
          return [...currentSentences, savedSentence];
        }

        const nextSentences = [...currentSentences];
        nextSentences[sentenceIndex] = savedSentence;
        return nextSentences;
      });
      setSectionError(null);
      void stopPlayback();
      setEditorVisible(false);
      resetEditor();
    } catch {
      if (mountedRef.current) {
        setEditorError("This sentence couldn't be saved. Please try again.");
        setIsSaving(false);
      }
    }
  }, [
    cancelTranslations,
    draftDisplayMode,
    draftEnglish,
    draftJapanese,
    draftKana,
    editingId,
    hasCompleteDraft,
    resetEditor,
    completeDraftMatchesSubject,
    stopPlayback,
    subjectCharacters,
    subjectId,
    userId,
  ]);

  const confirmDelete = useCallback(
    (sentence: CustomContextSentence) => {
      if (!userId) {
        return;
      }

      Alert.alert(
        "Delete this sentence?",
        "This removes it from this device.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              void deleteCustomContextSentence(userId, sentence.id)
                .then((deleted) => {
                  if (deleted && mountedRef.current) {
                    setSentences((currentSentences) =>
                      currentSentences.filter(
                        (currentSentence) =>
                          currentSentence.id !== sentence.id,
                      ),
                    );
                    setSectionError(null);
                  }
                })
                .catch(() => {
                  if (mountedRef.current) {
                    setSectionError(
                      "This sentence couldn't be deleted. Please try again.",
                    );
                  }
                });
            },
          },
        ],
      );
    },
    [userId],
  );

  const toggleSavedDisplayMode = useCallback(
    (sentence: CustomContextSentence) => {
      if (!userId) {
        return;
      }

      const nextDisplayMode: CustomContextSentenceDisplayMode =
        sentence.displayMode === "kanji" ? "kana" : "kanji";
      setSentences((currentSentences) =>
        currentSentences.map((currentSentence) =>
          currentSentence.id === sentence.id
            ? { ...currentSentence, displayMode: nextDisplayMode }
            : currentSentence,
        ),
      );

      void updateCustomContextSentence(userId, sentence.id, {
        displayMode: nextDisplayMode,
      })
        .then((updatedSentence) => {
          if (!updatedSentence) {
            throw new Error("Custom context sentence no longer exists.");
          }
          if (!mountedRef.current) {
            return;
          }
          setSentences((currentSentences) =>
            currentSentences.map((currentSentence) =>
              currentSentence.id === updatedSentence.id
                ? updatedSentence
                : currentSentence,
            ),
          );
          setSectionError(null);
        })
        .catch(() => {
          if (!mountedRef.current) {
            return;
          }
          setSentences((currentSentences) =>
            currentSentences.map((currentSentence) =>
              currentSentence.id === sentence.id &&
              currentSentence.displayMode === nextDisplayMode
                ? { ...currentSentence, displayMode: sentence.displayMode }
                : currentSentence,
            ),
          );
          setSectionError(
            "The kanji/kana preference couldn't be saved. Please try again.",
          );
        });
    },
    [userId],
  );

  const japaneseInputValue =
    draftDisplayMode === "kana" ? draftKana : draftJapanese;
  const draftPlaybackId = "custom-context-draft";

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text
          accessibilityRole="header"
          style={[styles.sectionTitle, { color: theme.textColor }]}
        >
          My Sentences
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add custom context sentence"
          onPress={openNewEditor}
          style={({ pressed }) => [
            styles.addButton,
            { opacity: pressed ? 0.5 : 1 },
          ]}
        >
          <Ionicons name="add" size={20} color={resolvedAccentColor} />
        </Pressable>
      </View>

      <View
        style={[
          styles.sentenceList,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
      >
        {isLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="small" color={resolvedAccentColor} />
          </View>
        ) : sentences.length === 0 ? (
          <Text
            style={[styles.emptyText, { color: theme.textSecondary }]}
          >
            No saved sentences yet.
          </Text>
        ) : (
          sentences.map((sentence, index) => {
            const displayedJapanese =
              sentence.displayMode === "kana"
                ? sentence.kana
                : sentence.japanese;
            const isPlaying = playingId === sentence.id;

            return (
              <View
                key={sentence.id}
                style={[
                  styles.sentenceRow,
                  index < sentences.length - 1 && {
                    borderBottomColor: theme.border,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <View style={styles.sentenceCopy}>
                  <Text
                    selectable
                    style={[styles.japaneseText, { color: theme.textColor }]}
                  >
                    {displayedJapanese}
                  </Text>
                  <Text
                    selectable
                    style={[styles.englishText, { color: theme.textSecondary }]}
                  >
                    {sentence.english}
                  </Text>
                </View>

                <View style={styles.rowActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      isPlaying ? "Stop sentence audio" : "Play sentence audio"
                    }
                    hitSlop={ICON_HIT_SLOP}
                    onPress={() =>
                      void handlePlay(displayedJapanese, sentence.id)
                    }
                    style={({ pressed }) => [
                      styles.rowAction,
                      {
                        backgroundColor: isPlaying
                          ? resolvedAccentColor
                          : "transparent",
                        opacity: pressed ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={isPlaying ? "stop" : "play"}
                      size={17}
                      color={isPlaying ? accentTextColor : resolvedAccentColor}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      sentence.displayMode === "kanji"
                        ? "Show this sentence in kana"
                        : "Show this sentence in kanji"
                    }
                    hitSlop={ICON_HIT_SLOP}
                    onPress={() => toggleSavedDisplayMode(sentence)}
                    style={({ pressed }) => [
                      styles.rowAction,
                      { opacity: pressed ? 0.5 : 1 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.displayModeText,
                        { color: resolvedAccentColor },
                      ]}
                    >
                      {sentence.displayMode === "kanji" ? "漢字" : "かな"}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Edit custom context sentence"
                    hitSlop={ICON_HIT_SLOP}
                    onPress={() => openEditEditor(sentence)}
                    style={({ pressed }) => [
                      styles.rowAction,
                      { opacity: pressed ? 0.5 : 1 },
                    ]}
                  >
                    <Ionicons
                      name="pencil"
                      size={16}
                      color={theme.textSecondary}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Delete custom context sentence"
                    hitSlop={ICON_HIT_SLOP}
                    onPress={() => confirmDelete(sentence)}
                    style={({ pressed }) => [
                      styles.rowAction,
                      { opacity: pressed ? 0.5 : 1 },
                    ]}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={17}
                      color={theme.error}
                    />
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </View>

      {sectionError ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.sectionError, { color: theme.error }]}
        >
          {sectionError}
        </Text>
      ) : null}

      <Modal
        visible={editorVisible}
        animationType="slide"
        presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
        onRequestClose={closeEditor}
      >
        <SafeAreaView
          edges={["top", "bottom"]}
          style={[
            styles.modalContainer,
            { backgroundColor: theme.backgroundColor },
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalContainer}
          >
            <View
              style={[styles.modalHeader, { borderBottomColor: theme.border }]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel editing custom context sentence"
                disabled={isSaving}
                onPress={closeEditor}
                style={({ pressed }) => [
                  styles.headerButton,
                  { opacity: pressed || isSaving ? 0.5 : 1 },
                ]}
              >
                <Text
                  style={[styles.headerButtonText, { color: theme.textSecondary }]}
                >
                  Cancel
                </Text>
              </Pressable>
              <Text
                numberOfLines={1}
                style={[styles.modalTitle, { color: theme.textColor }]}
              >
                {editingId ? "Edit sentence" : "New sentence"}
              </Text>
              <View style={styles.headerButton} />
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.editorContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.fieldHeader}>
                <Text
                  style={[styles.fieldLabel, { color: theme.textColor }]}
                >
                  Japanese
                </Text>
                <SegmentedControl
                  accessibilityLabel="Japanese display style"
                  values={["Kanji", "Kana"]}
                  selectedIndex={draftDisplayMode === "kanji" ? 0 : 1}
                  onValueChange={handleDisplayModeChange}
                  tintColor={resolvedAccentColor}
                  backgroundColor={theme.cardBackground}
                  appearance={theme.isDark ? "dark" : "light"}
                  style={styles.segmentedControl}
                />
              </View>

              <View style={styles.inputWithAction}>
                <TextInput
                  accessibilityLabel={
                    draftDisplayMode === "kanji"
                      ? "Japanese sentence in kanji"
                      : "Japanese sentence in kana"
                  }
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                  textAlignVertical="top"
                  placeholder={
                    draftDisplayMode === "kanji"
                      ? `Write a sentence using ${subjectCharacters}`
                      : "Write the sentence in kana"
                  }
                  placeholderTextColor={theme.textLight}
                  value={japaneseInputValue}
                  onChangeText={handleManualJapaneseChange}
                  style={[
                    styles.textInput,
                    styles.japaneseInput,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.border,
                      color: theme.textColor,
                    },
                  ]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    playingId === draftPlaybackId
                      ? "Stop draft sentence audio"
                      : "Play draft sentence audio"
                  }
                  disabled={!selectedJapaneseDraft.trim()}
                  onPress={() =>
                    void handlePlay(selectedJapaneseDraft, draftPlaybackId)
                  }
                  style={({ pressed }) => [
                    styles.draftPlayButton,
                    {
                      backgroundColor:
                        playingId === draftPlaybackId
                          ? resolvedAccentColor
                          : withAlpha(resolvedAccentColor, 0.1),
                      opacity:
                        pressed || !selectedJapaneseDraft.trim() ? 0.45 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      playingId === draftPlaybackId ? "stop" : "volume-medium"
                    }
                    size={19}
                    color={
                      playingId === draftPlaybackId
                        ? accentTextColor
                        : resolvedAccentColor
                    }
                  />
                </Pressable>
              </View>

              {draftJapanese.trim() && !japaneseDraftMatchesSubject ? (
                <Text
                  style={[styles.validationText, { color: theme.error }]}
                >
                  Use {subjectCharacters || "this vocabulary"} in the Japanese
                  version.
                </Text>
              ) : draftKana.trim() && !kanaDraftMatchesSubject ? (
                <Text
                  style={[styles.validationText, { color: theme.error }]}
                >
                  Use one of this vocabulary’s readings in the kana version.
                </Text>
              ) : null}

              <View style={styles.englishHeader}>
                <Text
                  style={[styles.fieldLabel, { color: theme.textColor }]}
                >
                  English
                </Text>
                {isTranslating ? (
                  <View style={styles.translationStatus}>
                    <ActivityIndicator
                      size="small"
                      color={resolvedAccentColor}
                    />
                    <Text
                      style={[
                        styles.translationStatusText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Updating…
                    </Text>
                  </View>
                ) : null}
              </View>
              <TextInput
                accessibilityLabel="English translation"
                multiline
                autoCapitalize="sentences"
                autoCorrect
                textAlignVertical="top"
                placeholder="English translation"
                placeholderTextColor={theme.textLight}
                value={draftEnglish}
                onChangeText={handleManualEnglishChange}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.border,
                    color: theme.textColor,
                  },
                ]}
              />

              {translationError ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={[styles.inlineError, { color: theme.error }]}
                >
                  {translationError}
                </Text>
              ) : null}

              <View
                style={[
                  styles.localNote,
                  { backgroundColor: withAlpha(theme.textSecondary, 0.08) },
                ]}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={16}
                  color={theme.textSecondary}
                />
                <Text
                  style={[styles.localNoteText, { color: theme.textSecondary }]}
                >
                  Saved only on this device. These sentences do not sync.
                </Text>
              </View>

              {editorError ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={[styles.inlineError, { color: theme.error }]}
                >
                  {editorError}
                </Text>
              ) : null}
            </ScrollView>

            <View
              style={[
                styles.modalFooter,
                {
                  backgroundColor: theme.backgroundColor,
                  borderTopColor: theme.border,
                },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save custom context sentence"
                accessibilityState={{ disabled: !canSave }}
                disabled={!canSave}
                onPress={() => void handleSave()}
                style={({ pressed }) => [
                  styles.saveButton,
                  {
                    backgroundColor: resolvedAccentColor,
                    opacity: !canSave || pressed ? 0.45 : 1,
                  },
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={accentTextColor} />
                ) : (
                  <Text
                    style={[styles.saveButtonText, { color: accentTextColor }]}
                  >
                    Save sentence
                  </Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  sectionHeader: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  addButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  sentenceList: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    overflow: "hidden",
  },
  emptyState: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 17,
    fontSize: 14,
  },
  sentenceRow: {
    minHeight: 70,
    paddingVertical: 11,
    paddingLeft: 14,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  sentenceCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  japaneseText: {
    fontSize: 17,
    lineHeight: 25,
    fontFamily: "SourceHanSansJP-Regular",
  },
  englishText: {
    marginTop: 3,
    fontSize: 14,
    lineHeight: 20,
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowAction: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  displayModeText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
  },
  sectionError: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    minHeight: 54,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  headerButton: {
    minWidth: 70,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  headerButtonText: {
    fontSize: 16,
  },
  modalTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
  },
  editorContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  segmentedControl: {
    width: 168,
    height: 32,
  },
  inputWithAction: {
    position: "relative",
  },
  textInput: {
    minHeight: 108,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 16,
    lineHeight: 23,
  },
  japaneseInput: {
    paddingRight: 58,
    fontFamily: "SourceHanSansJP-Regular",
  },
  draftPlayButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  validationText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  englishHeader: {
    minHeight: 28,
    marginTop: 18,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  translationStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  translationStatusText: {
    fontSize: 12,
  },
  inlineError: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
  },
  localNote: {
    marginTop: 18,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  localNoteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  modalFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  saveButton: {
    minHeight: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
});

export default CustomContextSentencesSection;
