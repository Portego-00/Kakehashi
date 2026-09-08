import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useAuthStore } from "../../utils/store";
import { isPortegoUsername } from "../../utils/portegoAccess";
import { requestNotebookCloud } from "./api";
import { createNotebookClient } from "./client";

export const notebookClient = createNotebookClient({ request: requestNotebookCloud, cache: AsyncStorage });
function syncAccount() {
  const { apiToken, userData } = useAuthStore.getState();
  notebookClient.setAccount(apiToken && userData?.id && isPortegoUsername(userData.username) ? { id: String(userData.id), token: apiToken } : null);
}
useAuthStore.subscribe(syncAccount);
syncAccount();
let subscribers = 0;
let foreground: ReturnType<typeof AppState.addEventListener> | null = null;
function subscribe(callback: () => void) {
  const unsubscribe = notebookClient.subscribe(callback);
  if (++subscribers === 1) foreground = AppState.addEventListener("change", (state) => {
    if (!notebookClient.getSnapshot().accountId) return;
    if (state === "active") void notebookClient.refresh().catch(() => undefined);
    else void notebookClient.flushDrafts().catch(() => undefined);
  });
  return () => { unsubscribe(); if (--subscribers === 0) { foreground?.remove(); foreground = null; } };
}
const actions = {
  refresh: notebookClient.refresh,
  mutate: notebookClient.mutate,
  updatePageDraft: notebookClient.updatePageDraft,
  flushDrafts: notebookClient.flushDrafts,
  discardDraft: notebookClient.discardDraft,
  duplicateDraft: notebookClient.duplicateDraft,
  persistDrafts: notebookClient.persistDrafts,
};
export function useNotebooks() {
  const snapshot = useSyncExternalStore(subscribe, notebookClient.getSnapshot, notebookClient.getSnapshot);
  const token = useAuthStore((state) => state.apiToken);
  useEffect(() => {
    if (snapshot.accountId) void notebookClient.refresh().catch(() => undefined);
  }, [snapshot.accountId, token]);
  return { ...snapshot, ...actions };
}
