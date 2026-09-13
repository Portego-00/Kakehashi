import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Platform } from "react-native";
import type { InlineInkDocument } from "../../../web/src/features/notebooks/inline-ink";
import { isPortegoUsername } from "../../utils/portegoAccess";
import { useAuthStore } from "../../utils/store";
import { drawingPayload, loadNotebookDrawing, saveNotebookDrawing, type NotebookDrawingPayload } from "./handwriting-api";
import { createInlineHandwritingDraftSession, inlineHandwritingDraftKey } from "./inline-handwriting-drafts";

export function useInlineHandwriting(accountId: string | null, pageId: string | undefined, persistPage: () => Promise<void>) {
  const persist = useRef(persistPage);
  persist.current = persistPage;
  const scope = useMemo(() => ({ active: true, sessions: new Map<string, ReturnType<typeof createInlineHandwritingDraftSession>>(), abort: new AbortController() }), [accountId, pageId]);
  useEffect(() => {
    scope.active = true;
    if (scope.abort.signal.aborted) scope.abort = new AbortController();
    return () => { scope.active = false; scope.abort.abort(); };
  }, [scope]);
  const credentials = useCallback(() => {
    const { apiToken, userData } = useAuthStore.getState();
    if (!scope.active || !accountId || !pageId || !apiToken || String(userData?.id) !== accountId || !isPortegoUsername(userData?.username)) throw new Error("Your account or page changed. Reopen your notebook to continue.");
    return { token: apiToken, accountId };
  }, [accountId, pageId, scope]);
  const session = useCallback((blockId: string) => {
    const auth = credentials();
    if (!blockId || blockId.length > 240) throw new Error("This writing area could not be found.");
    let item = scope.sessions.get(blockId);
    if (!item) {
      item = createInlineHandwritingDraftSession({
        cache: AsyncStorage,
        key: inlineHandwritingDraftKey(auth.accountId, pageId!, blockId),
        isCurrent: () => { try { credentials(); return true; } catch { return false; } },
        loadOriginal: async (drawingId) => { const current = credentials(); return loadNotebookDrawing(current.token, current.accountId, drawingId, scope.abort.signal); },
        save: async (payload) => { const current = credentials(); return saveNotebookDrawing(current.token, current.accountId, drawingPayload(payload), scope.abort.signal); },
        persistPage: () => persist.current(),
      });
      scope.sessions.set(blockId, item);
    }
    return item;
  }, [credentials, pageId, scope]);
  return {
    inlineHandwritingAvailable: Platform.OS === "ios" && Boolean(Platform.isPad),
    onLoadInlineHandwriting: useCallback((blockId: string, drawingId: string) => session(blockId).load(drawingId), [session]),
    onPersistInlineHandwriting: useCallback((blockId: string, drawingId: string, document: InlineInkDocument) => (scope.sessions.get(blockId) || session(blockId)).stage(drawingId, document), [scope, session]),
    onSaveInlineHandwriting: useCallback((blockId: string, drawingId: string, payload: NotebookDrawingPayload) => session(blockId).save(drawingId, payload), [session]),
    onInlineHandwritingCommitted: useCallback((blockId: string, drawingId: string) => session(blockId).commit(drawingId), [session]),
  };
}
