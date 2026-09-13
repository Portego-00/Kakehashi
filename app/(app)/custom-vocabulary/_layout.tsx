import { Redirect, Stack } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuthStore } from "../../../src/utils/store";
import { isPortegoUsername } from "../../../src/utils/portegoAccess";
import { useTheme } from "../../../src/utils/theme";
import CustomVocabularyHeader from "../../../src/features/custom-srs/custom-vocabulary-header";
import { goBackFromCustomVocabulary } from "../../../src/features/custom-srs/navigation";

export default function CustomVocabularyLayout() {
  const { apiToken, userData, isLoading } = useAuthStore();
  const { theme } = useTheme();

  if (isLoading || (apiToken && !userData)) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.backgroundColor }}>
        <CustomVocabularyHeader title="Loading" onBack={() => goBackFromCustomVocabulary("/(app)/(tabs)")} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.primary} accessibilityLabel="Checking access" />
        </View>
      </View>
    );
  }

  // Guard the entire route tree, including direct/deep links and account changes.
  if (!apiToken || !isPortegoUsername(userData?.username)) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.backgroundColor } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="word/[wordId]" />
      <Stack.Screen name="lessons" options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <Stack.Screen name="reviews" options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
    </Stack>
  );
}
