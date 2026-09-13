import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import {
  customLessonWords as selectLessonWords,
  customReviewWords as selectReviewWords,
  nextCustomReviewAt as selectNextReviewAt,
} from "../../../web/src/features/custom-srs/model";
import { useAuthStore } from "../../utils/store";
import { isPortegoUsername } from "../../utils/portegoAccess";
import { customVocabularyPacks } from "./catalog";
import { createCustomSrsClient, requestCustomSrsCloud } from "./client";
import type { CustomSrsState, CustomVocabularyPack } from "./types";

export { customPackProgress, customReviewForecast } from "../../../web/src/features/custom-srs/model";

export const customLessonWords = (state: CustomSrsState, packs: readonly CustomVocabularyPack[] = customVocabularyPacks) => selectLessonWords(state, packs);
export const customReviewWords = (state: CustomSrsState, packs: readonly CustomVocabularyPack[] = customVocabularyPacks, now = new Date()) => selectReviewWords(state, packs, now);
export const nextCustomReviewAt = (state: CustomSrsState, packs: readonly CustomVocabularyPack[] = customVocabularyPacks) => selectNextReviewAt(state, packs);

const client = createCustomSrsClient({ request: requestCustomSrsCloud, cache: AsyncStorage });

function syncAccount() {
  const { apiToken, userData } = useAuthStore.getState();
  const allowed = apiToken && isPortegoUsername(userData?.username);
  client.setAccount(allowed ? { id: String(userData?.id ?? userData!.username.toLowerCase()), token: apiToken } : null);
}

// Reset immediately on logout/account change, including while no feature screen is mounted.
useAuthStore.subscribe(syncAccount);
syncAccount();

let subscribers = 0;
let foregroundListener: ReturnType<typeof AppState.addEventListener> | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
function subscribe(callback: () => void) {
  const unsubscribe = client.subscribe(callback);
  subscribers += 1;
  if (subscribers === 1) {
    foregroundListener = AppState.addEventListener("change", (state) => {
      if (state === "active" && client.getSnapshot().accountId) void client.refresh().catch(() => undefined);
    });
    refreshTimer = setInterval(() => {
      if (AppState.currentState === "active" && client.getSnapshot().accountId && !client.getSnapshot().syncing) void client.refresh().catch(() => undefined);
    }, 60_000);
  }
  return () => {
    unsubscribe(); subscribers -= 1;
    if (subscribers === 0) {
      foregroundListener?.remove(); foregroundListener = null;
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = null;
    }
  };
}

// UUIDs identify logical actions only, not authentication. Sessions may supply their own to retry.
function eventId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === "x" ? value : (value & 3) | 8).toString(16);
  });
}

const actions = {
  refresh: client.refresh,
  enrollPack: (packId: string) => client.mutate({ action: "enroll_pack", packId, eventId: eventId() }),
  completeLesson: (wordId: string, id = eventId()) => client.mutate({ action: "complete_lesson", wordId, eventId: id }),
  submitReview: (wordId: string, incorrectAnswers: number, id = eventId()) => client.mutate({ action: "submit_review", wordId, incorrectAnswers, eventId: id }),
};

export function useCustomSrs() {
  const snapshot = useSyncExternalStore(subscribe, client.getSnapshot, client.getSnapshot);
  const apiToken = useAuthStore((state) => state.apiToken);
  useEffect(() => {
    if (snapshot.accountId) void client.refresh().catch(() => undefined);
  }, [snapshot.accountId, apiToken]);
  const lessonWords = useMemo(() => customLessonWords(snapshot.state), [snapshot.state]);
  const reviewWords = useMemo(() => customReviewWords(snapshot.state), [snapshot.state]);
  return { ...snapshot, isLoading: snapshot.loading, ...actions, lessonWords, reviewWords };
}
