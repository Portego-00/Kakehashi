"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { QuestionKind } from "./answer-checker";
import { kindsForSubject, type CoreQuestion } from "./queue";

export const REVIEW_LEAVE_TITLE = "Leave reviews?";
export const REVIEW_LEAVE_MESSAGE = "Some items have only their meaning or reading completed. If you leave now, those unfinished pairs will start over. Completed reviews are saved.";

export function hasIncompleteReviewPairs(
  questions: readonly Pick<CoreQuestion, "assignment" | "subject">[],
  completed: Readonly<Record<number, readonly QuestionKind[]>>,
) {
  return questions.some(({ assignment, subject }) => {
    if (kindsForSubject(subject).length !== 2) return false;
    const answers = completed[assignment.id] ?? [];
    return answers.includes("meaning") !== answers.includes("reading");
  });
}

function samePage(left: URL, right: URL) {
  return left.origin === right.origin && left.pathname === right.pathname && left.search === right.search;
}

type HistoryGuard = (event: PopStateEvent) => void;
const historyGuards = new Set<HistoryGuard>();

/** Mount in root Providers so this listener precedes the App Router on every route. */
export function ReviewNavigationGuardHost() {
  useLayoutEffect(() => {
    const beforeHistoryNavigation = (event: PopStateEvent) => {
      for (const guard of historyGuards) {
        guard(event);
        if (event.cancelBubble) break;
      }
    };
    window.addEventListener("popstate", beforeHistoryNavigation, true);
    return () => window.removeEventListener("popstate", beforeHistoryNavigation, true);
  }, []);
  return null;
}

/** Keep incomplete meaning/reading pairs on screen until leaving is confirmed. */
export function useReviewLeaveGuard(hasIncompletePairs: boolean) {
  const [pendingLeave, setPendingLeave] = useState<{ action: () => void } | null>(null);
  const bypassLink = useRef(false);
  const bypassUnload = useRef(false);
  const allowedHistoryDestination = useRef<string | null>(null);

  // A completed pair must also dismiss an obsolete warning before another pair starts.
  if (!hasIncompletePairs && pendingLeave) setPendingLeave(null);

  const requestLeave = useCallback((action: () => void) => {
    if (hasIncompletePairs) setPendingLeave((current) => current ?? { action });
    else action();
  }, [hasIncompletePairs]);

  const cancelLeave = useCallback(() => setPendingLeave(null), []);
  const confirmLeave = useCallback(() => {
    if (!pendingLeave) return;
    setPendingLeave(null);
    bypassUnload.current = true;
    try { pendingLeave.action(); }
    finally { bypassUnload.current = false; }
  }, [pendingLeave]);

  useEffect(() => {
    if (!hasIncompletePairs) return;
    let currentUrl = new URL(window.location.href);
    let currentState: unknown = window.history.state;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (bypassUnload.current || allowedHistoryDestination.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const beforeLink = (event: MouseEvent) => {
      if (bypassLink.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (!/^https?:$/.test(destination.protocol) || samePage(destination, new URL(window.location.href))) return;
      event.preventDefault();
      event.stopPropagation();
      requestLeave(() => {
        // Replay the original link so Next Link keeps its normal client navigation.
        bypassLink.current = true;
        try { anchor.click(); }
        finally { bypassLink.current = false; }
      });
    };

    const beforeHistoryNavigation = (event: PopStateEvent) => {
      const destination = new URL(window.location.href);
      if (allowedHistoryDestination.current === destination.href) {
        allowedHistoryDestination.current = null;
        return;
      }
      if (samePage(destination, currentUrl)) {
        currentUrl = destination;
        currentState = event.state;
        return;
      }

      // The root host registers before the App Router, keeping this review
      // mounted. Restore its history state and URL while the dialog is open;
      // Back after confirmation returns to the attempted destination.
      event.stopImmediatePropagation();
      window.history.pushState(currentState, "", currentUrl.href);
      requestLeave(() => {
        allowedHistoryDestination.current = destination.href;
        window.history.back();
      });
    };

    window.addEventListener("beforeunload", beforeUnload);
    historyGuards.add(beforeHistoryNavigation);
    document.addEventListener("click", beforeLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      historyGuards.delete(beforeHistoryNavigation);
      document.removeEventListener("click", beforeLink, true);
      allowedHistoryDestination.current = null;
    };
  }, [hasIncompletePairs, requestLeave]);

  return { isLeaveDialogOpen: Boolean(pendingLeave), requestLeave, cancelLeave, confirmLeave };
}
