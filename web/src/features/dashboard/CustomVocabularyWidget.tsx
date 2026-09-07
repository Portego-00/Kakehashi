"use client";

import { useEffect, useMemo, useState } from "react";
import { CUSTOM_VOCABULARY_PACKS } from "@/features/custom-srs/catalog";
import { customLessonWords, customReviewWords } from "@/features/custom-srs/model";
import { useCustomSrs } from "@/features/custom-srs/use-custom-srs";
import { CustomVocabularyWidgetView } from "./CustomVocabularyWidgetView";
import { createReviewForecast, customReviewForecastEntries } from "./review-forecast";
import { useReviewForecastPreferences } from "./use-review-forecast-preferences";

export function CustomVocabularyWidget({ scope, username = String(scope) }: { scope: string | number; username?: string }) {
  const customSrs = useCustomSrs(scope, CUSTOM_VOCABULARY_PACKS);
  const forecastPreferences = useReviewForecastPreferences(username);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const dashboardData = useMemo(() => ({
    lessons: customLessonWords(customSrs.state, CUSTOM_VOCABULARY_PACKS).length,
    reviews: customReviewWords(customSrs.state, CUSTOM_VOCABULARY_PACKS, now).length,
    forecast: createReviewForecast(customReviewForecastEntries(customSrs.state, CUSTOM_VOCABULARY_PACKS), now),
  }), [customSrs.state, now]);

  return <CustomVocabularyWidgetView
    lessons={dashboardData.lessons}
    reviews={dashboardData.reviews}
    enrolledPacks={customSrs.state.enrolledPackIds.length}
    totalPacks={CUSTOM_VOCABULARY_PACKS.length}
    forecast={dashboardData.forecast}
    forecastPreferences={forecastPreferences}
    storageMode={customSrs.storageMode}
    loading={customSrs.isLoading}
    unavailable={customSrs.isUnavailable}
    refreshing={customSrs.isRefreshing}
    onRetry={() => void customSrs.refresh()}
  />;
}
