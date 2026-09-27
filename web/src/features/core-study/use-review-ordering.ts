"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import type { WebStudyPreferences } from "@/features/settings/settings";
import { reviewOrderingChanged } from "./reorder-pending";

/** In mixed sessions, update hidden lanes too without changing their active card. */
export function useReviewOrdering(preferences: WebStudyPreferences, reorder: (next: WebStudyPreferences) => void) {
  const previous = useRef(preferences);
  const apply = useEffectEvent(reorder);
  useEffect(() => {
    if (reviewOrderingChanged(preferences, previous.current)) apply(preferences);
    previous.current = preferences;
  }, [preferences]);
}
