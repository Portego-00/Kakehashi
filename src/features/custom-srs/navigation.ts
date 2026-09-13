import { router } from "expo-router";

type CustomVocabularyBackFallback = "/custom-vocabulary" | "/(app)/(tabs)";

interface BackNavigation {
  canGoBack(): boolean;
  back(): void;
  replace(path: CustomVocabularyBackFallback): void;
}

/** Pop preserves the originating pack's params and the parent navigator's history. */
export function goBackFromCustomVocabulary(
  fallback: CustomVocabularyBackFallback = "/custom-vocabulary",
  navigation: BackNavigation = router,
) {
  if (navigation.canGoBack()) {
    navigation.back();
  } else {
    // Direct links may have no previous screen. Replace only in that case.
    navigation.replace(fallback);
  }
}
