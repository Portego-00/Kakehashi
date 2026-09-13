import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo } from "react";
import { cancelHandwriting, clearHandwritingDraft, editHandwriting, isHandwritingAvailable } from "../../../modules/notebook-handwriting";
import { isPortegoUsername } from "../../utils/portegoAccess";
import { useAuthStore } from "../../utils/store";
import { loadNotebookDrawing, saveNotebookDrawing } from "./handwriting-api";
import { createHandwritingDraftSession, handwritingDraftKey } from "./handwriting-drafts";
import { useInlineHandwriting } from "./use-inline-handwriting";

export function useHandwriting(accountId: string | null, pageId: string | undefined, theme: "light" | "dark", persistPage: () => Promise<void>) {
  const inline = useInlineHandwriting(accountId, pageId, persistPage);
  const scope = useMemo(() => ({ accountId, pageId, active: true, sessions: new Map<string, ReturnType<typeof createHandwritingDraftSession>>(), previews: new Map<string, string>(), abort: new AbortController() }), [accountId, pageId]);
  useEffect(() => {
    scope.active = true;
    if (scope.abort.signal.aborted) scope.abort = new AbortController();
    return () => { scope.active = false; scope.abort.abort(); scope.previews.clear(); void cancelHandwriting().catch(() => undefined); };
  }, [scope]);
  const credentials = useCallback(() => {
    const { apiToken, userData } = useAuthStore.getState();
    if (!scope.active || !accountId || !pageId || !apiToken || String(userData?.id) !== accountId || !isPortegoUsername(userData?.username)) {
      throw new Error("Your account or page changed. Reopen your notebook to continue.");
    }
    return { token: apiToken, accountId };
  }, [accountId, pageId, scope]);
  const loadPreview = useCallback(async (drawingId: string, appearance: "light" | "dark" = "light") => {
    const auth = credentials();
    const cacheKey = `${drawingId}:${appearance}`;
    const cached = scope.previews.get(cacheKey);
    if (cached) return cached;
    const drawing = await loadNotebookDrawing(auth.token, auth.accountId, drawingId, scope.abort.signal);
    credentials();
    const uri = `data:image/png;base64,${appearance === "dark" && drawing.previewFormat === "themed-v1" ? drawing.darkPreviewBase64 : drawing.previewBase64}`;
    if (scope.previews.size >= 12) scope.previews.delete(scope.previews.keys().next().value!);
    scope.previews.set(cacheKey, uri);
    return uri;
  }, [credentials, scope]);
  const edit = useCallback(async (sourceId?: string) => {
    const auth = credentials();
    if (!isHandwritingAvailable()) throw new Error("Editing handwriting needs an iPad with the latest app build.");
    const key = handwritingDraftKey(auth.accountId, pageId!, sourceId);
    let session = scope.sessions.get(key);
    if (!session) {
      session = createHandwritingDraftSession({
        cache: AsyncStorage, key,
        isCurrent: () => { try { credentials(); return true; } catch { return false; } },
        edit: (payload) => editHandwriting({ ...payload, theme, draftKey: key }),
        load: async () => {
          if (!sourceId) return undefined;
          const drawing = await loadNotebookDrawing(auth.token, auth.accountId, sourceId, scope.abort.signal);
          if (drawing.inkFormat === "strokes-v1") throw new Error("Edit this handwriting directly in its notebook area.");
          return drawing;
        },
        save: async (payload) => {
          credentials();
          const saved = await saveNotebookDrawing(auth.token, auth.accountId, payload, scope.abort.signal);
          scope.previews.set(`${saved.drawingId}:light`, `data:image/png;base64,${payload.previewBase64}`);
          return saved;
        },
        persistPage,
        clearNativeDraft: () => clearHandwritingDraft(key),
      });
      scope.sessions.set(key, session);
    }
    return session.edit();
  }, [credentials, pageId, persistPage, scope, theme]);
  const commit = useCallback(async (drawingId: string) => {
    credentials();
    for (const session of scope.sessions.values()) await session.commit(drawingId);
  }, [credentials, scope]);
  return { ...inline, handwritingAvailable: isHandwritingAvailable(), onEditHandwriting: edit, onLoadHandwritingPreview: loadPreview, onHandwritingCommitted: commit };
}
