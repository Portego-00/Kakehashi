"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sanitizeNotebookBlocks, type NotebookBlock, type NotebookPage, type NotebookState } from "./model";
import { NotebookApiError } from "./use-notebooks";

type PageDraft = Pick<NotebookPage, "title" | "icon" | "content"> & { baseRevision: number };
export type DraftStatus = "saved" | "unsaved" | "saving" | "error" | "conflict";
type SavePage = (draft: PageDraft) => Promise<NotebookState>;

function recoveryIdentity(scope: string, pageId: string) {
  const legacyKey = `kakehashi:notebooks:draft:${scope}:${pageId}`;
  const pointerKey = `kakehashi:notebooks:draft-owner:${scope}:${pageId}`;
  let tabId = crypto.randomUUID();
  let recoveredKey: string | null = null;
  try {
    tabId = sessionStorage.getItem("kakehashi:notebooks:tab-id") || tabId;
    sessionStorage.setItem("kakehashi:notebooks:tab-id", tabId);
    const previous = sessionStorage.getItem(pointerKey);
    // Never read an account's recovery content through a foreign pointer.
    if (previous?.startsWith(`${legacyKey}:`)) recoveredKey = previous;
  } catch { /* The legacy slot remains readable when session storage is blocked. */ }
  // A duplicated tab may inherit sessionStorage. A fresh writer ID keeps its
  // subsequent writes and cleanup independent from the tab it was copied from.
  const key = `${legacyKey}:${tabId}:${crypto.randomUUID()}`;
  return { key, pointerKey, recoveredKey: recoveredKey ?? legacyKey };
}

function readDraft(key: string): PageDraft | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null") as PageDraft | null;
    if (!saved || typeof saved.title !== "string" || saved.title.length > 240 || typeof saved.icon !== "string" || saved.icon.length > 32 || !Array.isArray(saved.content) || !Number.isSafeInteger(saved.baseRevision) || saved.baseRevision < 0) return null;
    return { title: saved.title, icon: saved.icon, content: sanitizeNotebookBlocks(saved.content), baseRevision: saved.baseRevision };
  } catch { return null; }
}

function sameDraftContent(left: PageDraft, right: Pick<PageDraft, "title" | "icon" | "content">) {
  return left.title === right.title && left.icon === right.icon && JSON.stringify(left.content) === JSON.stringify(right.content);
}

export function usePageDraft(page: NotebookPage, scope: string, savePage: SavePage) {
  const [recovery] = useState(() => recoveryIdentity(scope, page.id));
  const { key, pointerKey } = recovery;
  const [draft, setDraft] = useState<PageDraft>(() => ({ title: page.title, icon: page.icon, content: page.content, baseRevision: page.revision }));
  const [status, setStatus] = useState<DraftStatus>("saved");
  const [message, setMessage] = useState("");
  const [editorEpoch, setEditorEpoch] = useState(0);
  const current = useRef(draft);
  const dirty = useRef(false);
  const conflict = useRef(false);
  const generation = useRef(0);
  const pending = useRef<Promise<boolean> | null>(null);
  const saveRef = useRef(savePage);
  useEffect(() => { saveRef.current = savePage; }, [savePage]);

  const persist = useCallback(() => {
    if (!dirty.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(current.current));
      sessionStorage.setItem(pointerKey, key);
    }
    catch { setMessage("This browser cannot keep a recovery draft. Keep this page open until it is saved."); }
  }, [key, pointerKey]);

  const clearRecovery = useCallback((saved: Pick<PageDraft, "title" | "icon" | "content">) => {
    try {
      localStorage.removeItem(key);
      const recovered = readDraft(recovery.recoveredKey);
      // A still-open source tab may have continued writing. Remove a recovered
      // snapshot only when that exact content is now safe in the saved page.
      if (recovered && sameDraftContent(recovered, saved)) localStorage.removeItem(recovery.recoveredKey);
      if (sessionStorage.getItem(pointerKey) === key) sessionStorage.removeItem(pointerKey);
    } catch { /* Saving remains successful when recovery storage is unavailable. */ }
  }, [key, pointerKey, recovery.recoveredKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = readDraft(recovery.recoveredKey);
        if (!saved || dirty.current) return;
        current.current = saved;
        dirty.current = true;
        conflict.current = saved.baseRevision !== page.revision;
        setDraft(saved);
        setEditorEpoch((value) => value + 1);
        setStatus(conflict.current ? "conflict" : "unsaved");
        setMessage(conflict.current ? "This page changed elsewhere. Your recovered draft is still here." : "Recovered your unsaved draft.");
        persist();
      } catch { /* Invalid browser data never replaces a cloud document. */ }
    }, 0);
    return () => window.clearTimeout(timer);
    // A document is remounted whenever its page or account changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (page.revision <= current.current.baseRevision) return;
    const timer = window.setTimeout(() => {
      if (pending.current || page.revision <= current.current.baseRevision) return;
      if (dirty.current) {
        conflict.current = true;
        setStatus("conflict");
        setMessage("This page changed in another tab or study screen. Keep your writing as a new page, or load the saved version.");
      } else {
        const next = { title: page.title, icon: page.icon, content: page.content, baseRevision: page.revision };
        current.current = next;
        setDraft(next);
        setEditorEpoch((value) => value + 1);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [page, status, draft.baseRevision]);

  const update = useCallback((patch: Partial<Pick<PageDraft, "title" | "icon" | "content">>) => {
    const next = { ...current.current, ...patch };
    current.current = next;
    dirty.current = true;
    generation.current += 1;
    setDraft(next);
    if (!conflict.current) setStatus("unsaved");
  }, []);

  const flush = useCallback(async (): Promise<boolean> => {
    if (pending.current) return pending.current;
    if (!dirty.current) return true;
    if (conflict.current) { persist(); return false; }
    const snapshot = current.current;
    const savedGeneration = generation.current;
    setStatus("saving");
    const operation = (async () => {
      try {
        const next = await saveRef.current(snapshot);
        const saved = next.pages.find((item) => item.id === page.id);
        if (!saved) throw new Error("The saved page was not returned.");
        current.current = { ...current.current, baseRevision: saved.revision };
        setDraft(current.current);
        if (generation.current === savedGeneration) {
          dirty.current = false;
          setStatus("saved");
          setMessage("");
          clearRecovery(snapshot);
        } else { setStatus("unsaved"); persist(); }
        return true;
      } catch (error) {
        conflict.current = error instanceof NotebookApiError && error.status === 409;
        setStatus(conflict.current ? "conflict" : "error");
        setMessage(error instanceof Error ? error.message : "Your changes could not be saved.");
        persist();
        return false;
      } finally { pending.current = null; }
    })();
    pending.current = operation;
    return operation;
  }, [clearRecovery, page.id, persist]);

  useEffect(() => {
    if (!dirty.current) return;
    const draftTimer = window.setTimeout(persist, 150);
    return () => window.clearTimeout(draftTimer);
  }, [draft, persist]);

  useEffect(() => {
    if (status !== "unsaved") return;
    const saveTimer = window.setTimeout(() => void flush(), 900);
    return () => window.clearTimeout(saveTimer);
  }, [draft, flush, status]);

  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      persist();
      if (dirty.current) { event.preventDefault(); event.returnValue = ""; }
    };
    const visibility = () => { if (document.visibilityState === "hidden") { persist(); void flush(); } };
    const online = () => { if (dirty.current && !conflict.current) void flush(); };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      persist();
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [flush, persist]);

  const discard = useCallback((savedPage: NotebookPage) => {
    dirty.current = false;
    conflict.current = false;
    const next = { title: savedPage.title, icon: savedPage.icon, content: savedPage.content, baseRevision: savedPage.revision };
    current.current = next;
    setDraft(next);
    setEditorEpoch((value) => value + 1);
    setStatus("saved");
    setMessage("");
    clearRecovery(savedPage);
  }, [clearRecovery]);

  const flushAll = useCallback(async () => {
    while (dirty.current) { if (!await flush()) return false; }
    return true;
  }, [flush]);

  return { draft, status, message, editorEpoch, update, flush: flushAll, discard, setContent: (content: NotebookBlock[]) => update({ content }) };
}
