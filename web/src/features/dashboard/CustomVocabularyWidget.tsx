"use client";

import { useEffect, useMemo, useState } from "react";
import { CUSTOM_VOCABULARY_PACKS } from "@/features/custom-srs/catalog";
import { customLessonWords, customReviewWords } from "@/features/custom-srs/model";
import { useCustomSrs } from "@/features/custom-srs/use-custom-srs";
import { CustomVocabularyWidgetView } from "./CustomVocabularyWidgetView";

export function CustomVocabularyWidget({ scope }: { scope: string | number }) {
  const customSrs = useCustomSrs(scope, CUSTOM_VOCABULARY_PACKS);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const counts = useMemo(() => ({
    lessons: customLessonWords(customSrs.state, CUSTOM_VOCABULARY_PACKS).length,
    reviews: customReviewWords(customSrs.state, CUSTOM_VOCABULARY_PACKS, now).length,
  }), [customSrs.state, now]);

  return <CustomVocabularyWidgetView
    lessons={counts.lessons}
    reviews={counts.reviews}
    enrolledPacks={customSrs.state.enrolledPackIds.length}
    totalPacks={CUSTOM_VOCABULARY_PACKS.length}
    storageMode={customSrs.storageMode}
    loading={customSrs.isLoading}
    unavailable={customSrs.isUnavailable}
    refreshing={customSrs.isRefreshing}
    onRetry={() => void customSrs.refresh()}
  />;
}
