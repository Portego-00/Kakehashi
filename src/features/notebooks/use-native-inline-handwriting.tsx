import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { encodeInlineInk } from "../../../web/src/features/notebooks/inline-ink";
import { isNotebookDrawingId, isNotebookDrawingSize } from "../../../web/src/features/notebooks/handwriting";
import { isNotebookPaperColor, resolveNotebookPaperColor } from "../../../web/src/features/notebooks/paper-appearance";
import { isPortegoUsername } from "../../utils/portegoAccess";
import { useAuthStore } from "../../utils/store";
import { loadNotebookDrawing, saveNotebookDrawing, type NotebookDrawingPayload } from "./handwriting-api";
import { createInlineHandwritingDraftSession, inlineHandwritingDraftKey } from "./inline-handwriting-drafts";
import { createNativeInkJournal, nativeInkDraftKey } from "./native-inline-journal";
import { getNativeInlineCanvas, isNativeInlineHandwritingAvailable, type NativeCanvasHandle, type NativeCanvasProps, type NativeCanvasState } from "./native-inline-view";
import type { NativeInkGeometry, NativeInkStart, NativeInkState, NativeInlineHandwritingProps } from "./native-inline-contract";

type Session = {
  input: NativeInkStart; id: string; handle: NativeCanvasHandle | null;
  document: NativeCanvasProps["document"]; geometry: NativeInkGeometry; state: NativeInkState;
  journal: ReturnType<typeof createNativeInkJournal>; saving: boolean; ready: boolean; awaitingCommit: boolean; fingerDrawing: boolean; drawing: boolean; exportedRevision?: number;
};
function validGeometry(geometry: NativeInkGeometry) {
  return Number.isSafeInteger(geometry.revision) && geometry.revision >= 0
    && [geometry.rect, { ...geometry.viewport, x: 0, y: 0 }].every((rect) => Object.values(rect).every(Number.isFinite) && rect.width > 0 && rect.height > 0 && rect.width <= 10000 && rect.height <= 10000)
    && Object.values(geometry.clipRect).every(Number.isFinite) && geometry.clipRect.width >= 0 && geometry.clipRect.height >= 0 && geometry.clipRect.width <= geometry.viewport.width && geometry.clipRect.height <= geometry.viewport.height;
}

/** Only the paper is native; its surrounding notebook remains the same editor. */
export function useNativeInlineHandwriting(accountId: string | null, pageId: string | undefined, persistPage: () => Promise<void>, editorKey?: string, themeBackground = "#ffffff") {
  const persist = useRef(persistPage); persist.current = persistPage;
  const [visible, setVisible] = useState<Session | null>(null);
  const [state, setState] = useState<NativeInkState | null>(null);
  const scope = useMemo(() => ({ accountId, pageId, editorKey, active: true, starting: false, current: null as Session | null, abort: new AbortController() }), [accountId, pageId, editorKey]);
  const credentials = useCallback(() => {
    const auth = useAuthStore.getState();
    if (!scope.active || !accountId || !pageId || !auth.apiToken || String(auth.userData?.id) !== accountId || !isPortegoUsername(auth.userData?.username)) throw new Error("Your account or page changed. Your drawing remains on this device.");
    return { token: auth.apiToken, accountId };
  }, [accountId, pageId, scope]);
  useEffect(() => {
    scope.active = true; setVisible(null); setState(null);
    if (scope.abort.signal.aborted) scope.abort = new AbortController();
    return () => {
      scope.active = false; scope.abort.abort();
      const handle = scope.current?.handle;
      void handle?.flushDraft().catch(() => undefined);
      void handle?.setToolsVisible(false).catch(() => undefined);
    };
  }, [scope]);
  const current = useCallback((blockId: string) => {
    credentials(); const session = scope.current;
    if (!session || session.input.blockId !== blockId) throw new Error("Open this writing area again to continue.");
    return session;
  }, [credentials, scope]);
  const check = useCallback((session: Session) => {
    credentials();
    if (scope.current !== session) throw new Error("The writing area closed or changed. Its recovery remains on this device.");
  }, [credentials, scope]);
  const publish = useCallback((session: Session, patch: Partial<NativeInkState> = {}) => {
    if (!scope.active || scope.current !== session) return;
    session.state = { ...session.state, ...patch };
    setState(session.state); setVisible({ ...session });
  }, [scope]);
  const start = useCallback(async (input: NativeInkStart) => {
    const auth = credentials();
    if (!isNativeInlineHandwritingAvailable()) throw new Error("Install the latest iPad build to use the native Pencil tools.");
    if (scope.starting || scope.current) throw new Error("Finish the current writing area before opening another.");
    if (!input.blockId || input.blockId.length > 128 || !isNotebookDrawingSize(input.width, input.height) || (input.drawingId !== "" && !isNotebookDrawingId(input.drawingId)) || !validGeometry(input.geometry) || (input.paperColor !== undefined && !isNotebookPaperColor(input.paperColor))) throw new Error("This writing area has an invalid size or position.");
    scope.starting = true;
    try {
      const key = nativeInkDraftKey(auth.accountId, pageId!, input.blockId);
      const journal = createNativeInkJournal(AsyncStorage, key);
      const pending = await journal.read(input.drawingId);
      let payload: NotebookDrawingPayload | undefined = pending?.payload;
      if (!payload && input.inkFormat === "strokes-v1") {
        // Import any unfinished inline strokes from the previous app version.
        const old = createInlineHandwritingDraftSession({ cache: AsyncStorage, key: inlineHandwritingDraftKey(auth.accountId, pageId!, input.blockId), isCurrent: () => { try { credentials(); return true; } catch { return false; } }, loadOriginal: (id) => loadNotebookDrawing(auth.token, auth.accountId, id, scope.abort.signal), save: async () => { throw new Error("Import only"); }, persistPage: async () => undefined });
        const ink = await old.load(input.drawingId);
        if (ink) payload = { inkFormat: "strokes-v1", inkBase64: encodeInlineInk(ink), width: ink.width, height: ink.height, previewBase64: "" };
      } else if (!payload && input.drawingId) payload = await loadNotebookDrawing(auth.token, auth.accountId, input.drawingId, scope.abort.signal);
      credentials();
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      const size = { width: payload?.width ?? input.width, height: payload?.height ?? input.height };
      const session: Session = { input, id, handle: null, geometry: input.geometry, journal, saving: false, ready: false, awaitingCommit: false, fingerDrawing: false, drawing: false,
        document: { ...size, sessionId: id, draftKey: key, sourceId: input.drawingId, ...(pending ? { acceptedRecoverySourceId: pending.sourceId } : {}), inkFormat: payload?.inkFormat ?? "pencilkit-v1", ...(payload?.inkBase64 ? { inkBase64: payload.inkBase64 } : {}) },
        state: { ...size, blockId: input.blockId, sessionId: id, revision: 0, minimumWidth: 128, minimumHeight: 96, hasInk: false, canUndo: false, canRedo: false, busy: true },
      };
      scope.current = session; publish(session);
    } finally { scope.starting = false; }
  }, [credentials, pageId, publish, scope]);
  const callbacks: NativeInlineHandwritingProps = {
    nativeHandwritingAvailable: isNativeInlineHandwritingAvailable(),
    nativeHandwritingState: state,
    onNativeHandwritingStart: start,
    onNativeHandwritingLayout: useCallback<NonNullable<NativeInlineHandwritingProps["onNativeHandwritingLayout"]>>(async (blockId, geometry) => {
      const session = current(blockId);
      if (!validGeometry(geometry) || geometry.revision <= session.geometry.revision) return;
      session.geometry = geometry; publish(session);
    }, [current, publish]),
    onNativeHandwritingCommand: useCallback<NonNullable<NativeInlineHandwritingProps["onNativeHandwritingCommand"]>>(async (blockId, command, enabled) => {
      const session = current(blockId); if (session.saving || !session.ready || !session.handle) return;
      if (session.awaitingCommit && command !== "tools") throw new Error("Wait for your drawing to finish syncing before changing its ink.");
      if (command === "undo") await session.handle.undo();
      if (command === "redo") await session.handle.redo();
      if (command === "tools") await session.handle.setToolsVisible(enabled !== false);
      if (command === "finger") { session.fingerDrawing = enabled === true; publish(session); }
    }, [current, publish]),
    onNativeHandwritingResize: useCallback<NonNullable<NativeInlineHandwritingProps["onNativeHandwritingResize"]>>(async (blockId, size) => {
      const session = current(blockId);
      if (!session.handle || !session.ready || session.saving || session.awaitingCommit || !isNotebookDrawingSize(size.width, size.height) || size.height < session.state.minimumHeight) throw new Error("Keep the writing area large enough for its existing strokes.");
      if (size.width !== session.state.width) throw new Error("Use the bottom handle to change the writing area height.");
      const actual = await session.handle.resizePaper(session.state.width, size.height);
      check(session);
      if (actual.sessionId !== session.id) throw new Error("This writing area changed while resizing.");
      if (actual.revision >= session.state.revision) publish(session, actual);
    }, [check, current, publish]),
    onNativeHandwritingPaperColor: useCallback<NonNullable<NativeInlineHandwritingProps["onNativeHandwritingPaperColor"]>>(async (blockId, paperColor) => {
      const session = current(blockId);
      if (session.saving || session.awaitingCommit) throw new Error("Wait for your drawing to finish syncing before changing paper color.");
      if (!isNotebookPaperColor(paperColor)) throw new Error("Choose a valid paper color.");
      session.input = { ...session.input, paperColor }; publish(session);
    }, [current, publish]),
    onNativeHandwritingSave: useCallback<NonNullable<NativeInlineHandwritingProps["onNativeHandwritingSave"]>>(async (blockId, sourceId) => {
      const session = current(blockId);
      if (session.saving || !session.ready || !session.handle) throw new Error("Wait for the drawing to finish opening or saving.");
      session.saving = true; publish(session, { busy: true, error: undefined });
      try {
        const pending = await session.journal.read(session.input.drawingId);
        check(session);
        if (sourceId !== session.input.drawingId && sourceId !== pending?.saved?.drawingId) throw new Error("This handwriting block changed. Reopen it before saving.");
        session.awaitingCommit = true;
        const output = await session.handle.exportDrawing();
        check(session);
        if (output.sessionId !== session.id) throw new Error("The drawing changed before it could be saved.");
        session.exportedRevision = output.revision;
        const staged = await session.journal.stage(sourceId, output.revision, { inkBase64: output.inkBase64, previewBase64: output.previewBase64, ...(output.previewFormat ? { previewFormat: output.previewFormat, darkPreviewBase64: output.darkPreviewBase64 } : {}), width: output.width, height: output.height, inkFormat: "pencilkit-v1" });
        check(session);
        const auth = credentials();
        const saved = staged.saved ?? await saveNotebookDrawing(auth.token, auth.accountId, staged.payload, scope.abort.signal);
        await session.journal.uploaded(staged, saved);
        check(session); return saved;
      } catch (error) {
        session.awaitingCommit = false;
        publish(session, { busy: false, error: error instanceof Error ? error.message : "Your drawing is saved on this device. Try Done again." });
        throw error;
      } finally { session.saving = false; publish(session, { busy: false }); }
    }, [check, credentials, current, publish, scope]),
    onNativeHandwritingCommitted: useCallback<NonNullable<NativeInlineHandwritingProps["onNativeHandwritingCommitted"]>>(async (blockId, drawingId) => {
      const session = current(blockId);
      try {
        const pending = await session.journal.read(drawingId);
        if (!pending || pending.saved?.drawingId !== drawingId) throw new Error("The drawing has not finished syncing. Try Done again.");
        check(session); await persist.current(); check(session);
        if (!session.handle || await session.handle.acknowledgeSave(pending.revision, drawingId) !== true) throw new Error("Newer handwriting remains on this device. Tap Done again to sync it.");
        check(session); await session.journal.clear(pending); check(session);
        // The previous portable recovery is superseded only after the native ref is durable.
        await AsyncStorage.removeItem(inlineHandwritingDraftKey(accountId!, pageId!, blockId));
        if (scope.current === session) { scope.current = null; setVisible(null); setState(null); }
      } catch (error) {
        session.awaitingCommit = false;
        publish(session, { busy: false, error: error instanceof Error ? error.message : "Your drawing remains on this iPad. Tap Done again to sync it." });
        throw error;
      }
    }, [accountId, check, current, pageId, publish, scope]),
    onNativeHandwritingClose: useCallback<NonNullable<NativeInlineHandwritingProps["onNativeHandwritingClose"]>>(async (blockId) => {
      const session = current(blockId); await session.handle?.flushDraft(); await session.handle?.setToolsVisible(false);
      if (scope.current === session) { scope.current = null; setVisible(null); setState(null); }
    }, [current, scope]),
  };
  const Canvas = getNativeInlineCanvas();
  const session = scope.current;
  let overlay = null;
  if (Canvas && visible && session && visible.id === session.id) {
    const { rect, clipRect } = visible.geometry;
    const paper = resolveNotebookPaperColor(session.input.paperColor, themeBackground);
    const event = (next: NativeCanvasState) => {
      if (next.sessionId !== session.id || scope.current !== session || !scope.active) return;
      session.ready = true;
      if (next.revision < session.state.revision) return;
      publish(session, { ...next, busy: session.saving });
    };
    overlay = <View pointerEvents="box-none" style={{ position: "absolute", overflow: "hidden", left: clipRect.x, top: clipRect.y, width: clipRect.width, height: clipRect.height, zIndex: 20 }}>
      <Canvas key={session.id} ref={(handle) => { session.handle = handle; }}
        style={{ position: "absolute", left: rect.x - clipRect.x, top: rect.y - clipRect.y, width: rect.width, height: rect.height }}
        document={session.document} paperSize={{ width: state?.width ?? session.document.width, height: state?.height ?? session.document.height }}
        paperColor={paper.color} paperStyle={paper.appearance}
        active={session.ready && clipRect.width > 0 && clipRect.height > 0} inputEnabled={session.ready && !session.saving && !session.awaitingCommit} fingerDrawing={session.fingerDrawing}
        onReady={(result) => event(result.nativeEvent)} onChange={(result) => event(result.nativeEvent)}
        onToolActivity={(result) => { if (result.nativeEvent.sessionId === session.id && scope.current === session) session.drawing = result.nativeEvent.drawing; }}
        onError={(result) => { if (result.nativeEvent.sessionId === session.id) publish(session, { busy: false, error: result.nativeEvent.message }); }}
      />
    </View>;
  }
  return { editorProps: callbacks, overlay };
}
