"use client";

import { useId, useState, type ReactNode } from "react";
import { canUseYouGlish } from "../../../../../src/features/youglish/player";
import { useSession } from "@/lib/session";
import { YouGlishContextPlayer } from "./YouGlishContextPlayer";
import { useSubjectAudioStop } from "./SubjectAudioControls";
import styles from "../media-context.module.css";

export function useYouGlishAccess(enabled?: boolean) {
  const { user, isDemo } = useSession();
  return !isDemo && canUseYouGlish(user?.data.username, enabled);
}

export function MediaContextSource({ query, enabled, active = true, children }: { query: string; enabled?: boolean; active?: boolean; children: ReactNode }) {
  const allowed = useYouGlishAccess(enabled);
  const [source, setSource] = useState<"immersionkit" | "youglish">("immersionkit");
  const stopAudio = useSubjectAudioStop();
  const id = useId();
  const showYouGlish = allowed && source === "youglish";

  if (!allowed) return <>{children}</>;

  return <div className={allowed ? styles.container : undefined}>
    {allowed ? <div role="tablist" aria-label="Context source" className={styles.tabs}>
      {(["immersionkit", "youglish"] as const).map((item) => <button key={item} type="button" role="tab" id={`${id}-${item}`} aria-controls={`${id}-panel`} aria-selected={showYouGlish === (item === "youglish")} tabIndex={showYouGlish === (item === "youglish") ? 0 : -1} onClick={() => { stopAudio?.(); setSource(item); }} onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const next = event.key === "Home" ? "immersionkit" : event.key === "End" ? "youglish" : item === "youglish" ? "immersionkit" : "youglish";
        stopAudio?.(); setSource(next);
        document.getElementById(`${id}-${next}`)?.focus();
      }}>{item === "youglish" ? "YouGlish" : "ImmersionKit"}</button>)}
    </div> : null}
    <div id={`${id}-panel`} role={allowed ? "tabpanel" : undefined} aria-labelledby={allowed ? `${id}-${showYouGlish ? "youglish" : "immersionkit"}` : undefined}>
      {showYouGlish ? active && query.trim() ? <YouGlishContextPlayer key={query} query={query} onPlaybackStart={stopAudio} /> : null : children || <p>ImmersionKit examples are turned off in settings.</p>}
    </div>
  </div>;
}
