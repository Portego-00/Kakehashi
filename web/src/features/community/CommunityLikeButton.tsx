"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/react-dom";
import { Heart } from "lucide-react";
import { useSession } from "@/lib/session";
import { canViewCommunityLikes } from "./security-model";
import styles from "./CommunityLikeButton.module.css";

type Person = { id: string; username: string };

export function CommunityLikeButton({ kind, targetId, count, liked = false, pending = false, writable, label, className, onClick, iconSize = 15 }: {
  kind: "issue" | "comment";
  targetId: string;
  count: number;
  liked?: boolean;
  pending?: boolean;
  writable: boolean;
  label: string;
  className?: string;
  onClick: () => void;
  iconSize?: number;
}) {
  const { user, isDemo } = useSession();
  const canViewLikes = !isDemo && canViewCommunityLikes(user?.data.username);
  const tooltipId = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const open = canViewLikes && !dismissed && (hovered || focused);
  const { refs: floatingRefs, floatingStyles } = useFloating({
    open,
    placement: "top",
    strategy: "fixed",
    middleware: [offset(8), flip(), shift({ padding: 12 })],
    whileElementsMounted: autoUpdate,
  });
  const { setReference, setFloating } = floatingRefs;

  useEffect(() => {
    if (!open || pending || count === 0) return;
    const controller = new AbortController();
    async function load() {
      setPeople(null);
      setError(false);
      try {
        const items: Person[] = [];
        for (let page = 0; ; page += 1) {
          const params = new URLSearchParams({ action: "likes", kind, id: targetId, page: String(page) });
          const response = await fetch(`/community/api?${params}`, { cache: "no-store", signal: controller.signal });
          if (!response.ok) throw new Error("Likes could not be loaded.");
          const payload = await response.json() as { items: Person[]; hasMore: boolean };
          items.push(...payload.items);
          if (!payload.hasMore) break;
        }
        if (!controller.signal.aborted) setPeople(items);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [open, pending, count, liked, kind, targetId]);

  useEffect(() => {
    if (!open) return;
    function dismiss(event: KeyboardEvent) { if (event.key === "Escape") setDismissed(true); }
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [open]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  function enter() {
    if (!canViewLikes) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setHovered(true);
    if (!hovered) setDismissed(false);
  }
  function leave() {
    closeTimer.current = setTimeout(() => setHovered(false), 150);
  }

  const content = <><Heart size={iconSize} fill={liked ? "currentColor" : "none"} aria-hidden="true" />{Number(count || 0).toLocaleString()}</>;
  const description = open ? tooltipId : undefined;
  return <span className={styles.control} onMouseEnter={enter} onMouseLeave={leave}>
    {writable ? <button ref={setReference} className={className} type="button" disabled={pending}
      aria-pressed={liked} aria-label={label} aria-describedby={description} onClick={onClick}
      onFocus={() => { setFocused(true); setDismissed(false); }} onBlur={() => setFocused(false)}>{content}</button>
      : <span ref={setReference} className={className} role="group" tabIndex={canViewLikes ? 0 : undefined} aria-label={label} aria-describedby={description}
        onFocus={() => { setFocused(true); setDismissed(false); }} onBlur={() => setFocused(false)}>{content}</span>}
    {open ? createPortal(<div ref={setFloating} style={floatingStyles} id={tooltipId} role="tooltip"
      className={styles.tooltip} onMouseEnter={enter} onMouseLeave={leave} aria-live="polite">
      {pending ? "Updating likes…" : count === 0 ? "No likes yet" : error ? "Could not load likes. Hover again to retry." : people === null ? "Loading likes…" : people.length ? <>
        <strong>Liked by</strong><ul>{people.map((person) => <li key={person.id}>{person.username}</li>)}</ul>
      </> : "No likes yet"}
    </div>, document.body) : null}
  </span>;
}
