"use client";

import { useQuery } from "@tanstack/react-query";
import {
  VOCABULARY_FREQUENCY_STALE_TIME_MS,
  fetchVocabularyFrequencyForRequest,
  normalizeVocabularyFrequencyRequest,
  vocabularyFrequencyQueryKeyForRequest,
  vocabularyFrequencyRequestForSubject,
  type VocabularyFrequencyRequest,
  type VocabularyFrequencySubject,
} from "./vocabulary-frequency";
import styles from "./vocabulary-frequency.module.css";

interface VocabularyFrequencyBadgeCommonProps {
  enabled: boolean;
  variant?: "review" | "details";
  className?: string;
}

type VocabularyFrequencyBadgeSourceProps =
  | { subject: VocabularyFrequencySubject; request?: never }
  | { subject?: never; request: VocabularyFrequencyRequest };

export type VocabularyFrequencyBadgeProps = VocabularyFrequencyBadgeCommonProps & VocabularyFrequencyBadgeSourceProps;

export function VocabularyFrequencyBadge(props: VocabularyFrequencyBadgeProps) {
  if (!props.enabled) return null;

  const hasSubject = props.subject !== undefined;
  const hasRequest = props.request !== undefined;
  if (hasSubject === hasRequest) return null;

  const request = props.request !== undefined
    ? normalizeVocabularyFrequencyRequest(props.request)
    : props.subject !== undefined
      ? vocabularyFrequencyRequestForSubject(props.subject)
      : null;
  if (!request) return null;

  return (
    <EnabledVocabularyFrequencyBadge
      request={request}
      variant={props.variant ?? "review"}
      className={props.className}
    />
  );
}

function EnabledVocabularyFrequencyBadge({
  request,
  variant,
  className,
}: {
  request: VocabularyFrequencyRequest;
  variant: NonNullable<VocabularyFrequencyBadgeProps["variant"]>;
  className?: string;
}) {
  const query = useQuery({
    queryKey: vocabularyFrequencyQueryKeyForRequest(request),
    queryFn: ({ signal }) => fetchVocabularyFrequencyForRequest(request, signal),
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
  const classes = [styles.badge, styles[variant], className].filter(Boolean).join(" ");

  return (
    <span className={classes} aria-label={accessibilityLabel} aria-live="polite">
      {value}
    </span>
  );
}
