"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import styles from "./review-exit-guard.module.css";

/** Guard answers still held in this session; submitted reviews already live in the durable outbox. */
export function ReviewExitGuard({ pendingSubjects }: { pendingSubjects: number }) {
  const id = useId();
  const count = useRef(pendingSubjects);
  const allowed = useRef(false);
  const entry = useRef<{ url: string; state: object } | null>(null);
  const lifecycle = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const [leave, setLeave] = useState<(() => void) | null>(null);

  useEffect(() => {
    count.current = pendingSubjects;
    if (pendingSubjects > 0 && !entry.current) {
      entry.current = { url: location.href, state: history.state ?? {} };
      history.pushState({ ...history.state, reviewExitGuard: id }, "", location.href);
    }
  }, [pendingSubjects, id]);

  useEffect(() => {
    const lifecycleRef = lifecycle;
    const generation = ++lifecycleRef.current;
    const unload = (event: BeforeUnloadEvent) => {
      if (count.current > 0 && !allowed.current) { event.preventDefault(); event.returnValue = ""; }
    };
    const link = (event: MouseEvent) => {
      if (!count.current || allowed.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, location.href);
      if (destination.origin === location.origin && destination.pathname === location.pathname && destination.search === location.search) return;
      if (!/^https?:$/.test(destination.protocol)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setLeave(() => () => {
        if (history.state?.reviewExitGuard === id) {
          window.addEventListener("popstate", () => location.assign(destination.href), { once: true });
          history.back();
        } else location.assign(destination.href);
      });
    };
    const back = (event: PopStateEvent) => {
      if (allowed.current || !entry.current || event.state?.reviewExitGuard === id) return;
      const destination = location.href;
      event.stopImmediatePropagation();
      if (!count.current) { allowed.current = true; history.back(); return; }
      const { url, state } = entry.current;
      // Restore the guarded entry before Next handles the traversal, keeping the session mounted.
      history.pushState({ ...state, reviewExitGuard: id }, "", url);
      setLeave(() => destination === url ? () => history.go(-2) : () => location.assign(destination));
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("popstate", back, true);
    document.addEventListener("click", link, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("popstate", back, true);
      document.removeEventListener("click", link, true);
      queueMicrotask(() => {
        if (lifecycleRef.current === generation && !allowed.current && entry.current && history.state?.reviewExitGuard === id && location.href === entry.current.url) history.back();
      });
    };
  }, [id]);

  useEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    if (leave && !modal.open) {
      if (typeof modal.showModal === "function") modal.showModal(); else modal.setAttribute("open", "");
      modal.querySelector<HTMLButtonElement>("[data-keep-reviewing]")?.focus();
    } else if (!leave && modal.open) {
      if (typeof modal.close === "function") modal.close(); else modal.removeAttribute("open");
    }
  }, [leave]);

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    onCancel={(event) => { event.preventDefault(); setLeave(null); }}>
    <h2 id={`${id}-title`}>Leave this session?</h2>
    <p id={`${id}-description`}>{pendingSubjects} {pendingSubjects === 1 ? "subject has" : "subjects have"} answers that haven’t been submitted yet. Finish each subject’s questions to submit its progress. Submitted reviews are already saved.</p>
    <div className={styles.actions}>
      <Button tone="ghost" onClick={() => { allowed.current = true; leave?.(); }}>Leave anyway</Button>
      <Button tone="primary" data-keep-reviewing autoFocus onClick={() => setLeave(null)}>Keep reviewing</Button>
    </div>
  </dialog>;
}
