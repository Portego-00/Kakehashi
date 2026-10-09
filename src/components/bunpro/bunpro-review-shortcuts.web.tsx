import { useEffect } from "react";

export function BunproReviewShortcuts({ enabled, questionKey, onKey }: { enabled: boolean; questionKey: string; onKey: (key: string) => void }) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || (event.target as Element)?.closest("input,textarea,select,[contenteditable=true]")) return;
      onKey(event.key);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, questionKey, onKey]);
  return null;
}
