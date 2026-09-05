import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let openPreviewCount = 0;

function emitChange() {
  for (const listener of listeners) listener();
}

export function registerOpenNoteSubjectPreview(): () => void {
  openPreviewCount += 1;
  emitChange();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    openPreviewCount = Math.max(0, openPreviewCount - 1);
    emitChange();
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return openPreviewCount > 0;
}

export function useIsNoteSubjectPreviewOpen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
