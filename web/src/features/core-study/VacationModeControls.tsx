"use client";

import { ExternalLink } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ButtonLink, type ButtonState } from "@/components/ui/Button";
import { WANIKANI_VACATION_SETTINGS_URL } from "./vacation";

type VacationModeControlsProps = {
  active: boolean;
  refresh: () => Promise<unknown>;
  className?: string;
  showRefresh?: boolean;
};

export function VacationModeControls({ active, refresh, className, showRefresh = true }: VacationModeControlsProps) {
  const [refreshState, setRefreshState] = useState<ButtonState>("idle");
  const [announcement, setAnnouncement] = useState("");
  const awaitingReturn = useRef(false);

  const checkStatus = useCallback(async () => {
    setRefreshState("loading");
    setAnnouncement("Checking Vacation Mode status.");
    try {
      await refresh();
      setRefreshState("success");
      setAnnouncement("Vacation Mode status refreshed.");
    } catch {
      setRefreshState("error");
      setAnnouncement("Vacation Mode status could not be refreshed. Try again.");
    }
  }, [refresh]);

  useEffect(() => {
    const checkAfterReturning = () => {
      if (!awaitingReturn.current || document.visibilityState === "hidden") return;
      awaitingReturn.current = false;
      void checkStatus();
    };
    window.addEventListener("focus", checkAfterReturning);
    document.addEventListener("visibilitychange", checkAfterReturning);
    return () => {
      window.removeEventListener("focus", checkAfterReturning);
      document.removeEventListener("visibilitychange", checkAfterReturning);
    };
  }, [checkStatus]);

  return <div className={className}>
    <ButtonLink href={WANIKANI_VACATION_SETTINGS_URL} target="_blank" rel="noreferrer" tone="primary" size="small" prefetch={false} onClick={() => { awaitingReturn.current = true; }}>
      {active ? "Turn off in WaniKani" : "Turn on in WaniKani"}<ExternalLink size={15} aria-hidden />
    </ButtonLink>
    {showRefresh ? <Button type="button" tone="ghost" size="small" state={refreshState} onClick={() => void checkStatus()}>{refreshState === "loading" ? "Checking…" : "Check status"}</Button> : null}
    <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
  </div>;
}
