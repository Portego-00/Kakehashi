import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import VocabularyDetails from "../../components/VocabularyDetails";
import { useAuthStore } from "../../utils/store";
import { useTheme } from "../../utils/theme";
import { getCustomVocabularyWord } from "./catalog";
import { useCustomSrs } from "./data";
import CustomVocabularyHeader from "./custom-vocabulary-header";
import { goBackFromCustomVocabulary } from "./navigation";
import { customSubjectIdToWord, customVocabularyWordToDetails, customWordUsesKanji } from "./subject";

export default function CustomVocabularyDetail({ wordId }: { wordId?: string } = {}) {
  const params = useLocalSearchParams<{ wordId?: string; tab?: string }>();
  const { theme } = useTheme();
  const customSrs = useCustomSrs();
  const userLevel = useAuthStore((state) => state.userData?.level ?? 1);
  const word = getCustomVocabularyWord(wordId ?? params.wordId ?? "");
  const assignment = word ? customSrs.state.assignments[word.id] : undefined;
  const vocabulary = useMemo(() => word ? customVocabularyWordToDetails(word, assignment) : null, [word, assignment]);

  if (!word || !vocabulary) return <View style={[styles.screen, { backgroundColor: theme.backgroundColor }]}>
    <Stack.Screen options={{ headerShown: false, title: "Vocabulary" }} />
    <CustomVocabularyHeader title="Vocabulary" onBack={() => goBackFromCustomVocabulary()} />
    <View style={styles.empty}>
      <Text selectable style={[styles.message, { color: theme.textColor }]}>This vocabulary word could not be found.</Text>
      <Pressable accessibilityRole="button" onPress={() => router.replace("/custom-vocabulary" as never)} style={styles.button}><Text style={{ color: theme.primary }}>Explore packs</Text></Pressable>
    </View>
  </View>;

  const initialTab = params.tab === "context" ? "context" : params.tab === "reading" && customWordUsesKanji(word) ? "reading" : "meaning";

  return <>
    <Stack.Screen options={{ headerShown: false, title: word.characters }} />
    <VocabularyDetails
      key={word.id}
      vocabulary={vocabulary}
      progressionStatus={customSrs.loading ? "loading" : customSrs.error ? "offline" : "success"}
      initialTab={initialTab}
      userLevel={userLevel}
      onSubjectPress={(subjectId) => {
        const customWord = customSubjectIdToWord(subjectId);
        if (customWord) {
          router.push({ pathname: "/custom-vocabulary/word/[wordId]", params: { wordId: customWord.id } } as never);
        } else if (subjectId > 0) {
          router.push({ pathname: "/subject/[id]", params: { id: String(subjectId) } } as never);
        }
      }}
    />
  </>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  empty: { flex: 1, padding: 24, justifyContent: "center", alignItems: "center", gap: 16 },
  message: { fontSize: 16, lineHeight: 24, textAlign: "center" },
  button: { minHeight: 44, padding: 12, justifyContent: "center" },
});
