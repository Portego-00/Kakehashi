"use client";

import { useQuery } from "@tanstack/react-query";
import {
  VOCABULARY_FREQUENCY_STALE_TIME_MS,
  fetchVocabularyFrequency,
  vocabularyFrequencyQueryKey,
  vocabularyFrequencyRequestForSubject,
  type VocabularyFrequencySubject,
} from "./vocabulary-frequency";
import styles from "./vocabulary-frequency.module.css";

export interface VocabularyFrequencyBadgeProps {
  subject: VocabularyFrequencySubject;
  enabled: boolean;
  variant?: "review" | "details";
  className?: string;
}

export function VocabularyFrequencyBadge({
  subject,
  enabled,
  variant = "review",
  className,
}: VocabularyFrequencyBadgeProps) {
  if (!enabled || !vocabularyFrequencyRequestForSubject(subject)) return null;
  return <EnabledVocabularyFrequencyBadge subject={subject} variant={variant} className={className} />;
}

function EnabledVocabularyFrequencyBadge({
  subject,
  variant,
  className,
}: Omit<VocabularyFrequencyBadgeProps, "enabled">) {
  const query = useQuery({
    queryKey: vocabularyFrequencyQueryKey(subject),
    queryFn: ({ signal }) => fetchVocabularyFrequency(subject, signal),
    staleTime: VOCABULARY_FREQUENCY_STALE_TIME_MS,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const value = query.data ? `#${query.data.frequencyRank.toLocaleString()}` : "#---";
  const accessibilityLabel = query.data
    ? `Vocabulary frequency ${value}`
    : query.isPending
      ? "Vocabulary frequency loading"
      : "Vocabulary frequency unavailable";
  const classes = [styles.badge, styles[variant ?? "review"], className].filter(Boolean).join(" ");

  return (
    <span className={classes} aria-label={accessibilityLabel} aria-live="polite">
      {value}
    </span>
  );
}
