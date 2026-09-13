"use client";

import { useSyncExternalStore } from "react";

export const PHONE_STUDY_MEDIA_QUERY = "(max-width: 47.999rem) and (pointer: coarse)";

function subscribeToPhoneInput(onChange: () => void) {
  const media = window.matchMedia?.(PHONE_STUDY_MEDIA_QUERY);
  if (!media) return () => {};
  media.addEventListener?.("change", onChange);
  return () => media.removeEventListener?.("change", onChange);
}

function hasPhoneInput() {
  return window.matchMedia?.(PHONE_STUDY_MEDIA_QUERY).matches ?? false;
}

export function usePhoneStudyInput() {
  return useSyncExternalStore(subscribeToPhoneInput, hasPhoneInput, () => false);
}
