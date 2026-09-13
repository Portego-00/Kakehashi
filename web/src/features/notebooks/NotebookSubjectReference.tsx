"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { autoUpdate, flip, offset, shift, size, useFloating } from "@floating-ui/react-dom";
import { ArrowUpRight, ExternalLink, Square, Volume2 } from "lucide-react";
import type { Subject } from "@/types/wanikani";
import { SubjectCharacter } from "@/features/subjects/components/SubjectCharacter";
import NotebookSubjectCatalogStatus, { type NotebookSubjectCatalogProps } from "./NotebookSubjectCatalogStatus";
import readerStyles from "@/features/content/content.module.css";
import styles from "./references.module.css";

export function subjectLabel(subject: Subject) {
  return subject.data.characters || subject.data.slug;
}

export function subjectMeaning(subject: Subject) {
  return (subject.data.meanings.find((meaning) => meaning.primary) || subject.data.meanings[0])?.meaning || "";
}

export function subjectReading(subject: Subject) {
  return (subject.data.readings?.find((reading) => reading.primary) || subject.data.readings?.[0])?.reading || "";
}

function subjectType(subject: Subject) {
  return subject.object === "kana_vocabulary" ? "Kana vocabulary" : subject.object === "kanji" ? "Kanji" : subject.object === "radical" ? "Radical" : "Vocabulary";
}

export default function NotebookSubjectReference({ subject, subjectId, label, subjectsLoading = false, subjectsError, onRetrySubjects, inline = false }: { subject?: Subject; subjectId: number; label: string; inline?: boolean } & NotebookSubjectCatalogProps) {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState("");
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const anchor = useRef<HTMLAnchorElement | null>(null);
  const preview = useRef<HTMLDivElement | null>(null);
  const tooltipId = useId();
  const display = subject ? subjectLabel(subject) : label || "Linked subject";
  const missingLoading = !subject && subjectsLoading;
  const kind = subject?.object === "kana_vocabulary" ? "vocabulary" : subject?.object || "unknown";
  const reading = subject ? subjectReading(subject) : "";
  const meaning = subject ? subjectMeaning(subject) : "";
  const href = `/subjects/${subjectId}`;
  const audio = subject?.data.pronunciation_audios?.[0]?.url;
  const { refs: floatingRefs, floatingStyles } = useFloating({
    open,
    placement: "bottom-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip({ padding: 12 }), shift({ padding: 12 }), size({ padding: 12, apply({ availableHeight, elements }) { elements.floating.style.maxHeight = `${Math.max(120, availableHeight)}px`; } })],
  });
  const setReference = useCallback((node: HTMLAnchorElement | null) => { anchor.current = node; floatingRefs.setReference(node); }, [floatingRefs]);
  const setFloating = useCallback((node: HTMLDivElement | null) => { preview.current = node; floatingRefs.setFloating(node); }, [floatingRefs]);

  const clearTimers = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);
  const close = useCallback(() => { clearTimers(); setOpen(false); player.current?.pause(); setPlaying(false); }, [clearTimers]);
  const show = () => { clearTimers(); setOpen(true); };
  const hover = () => { clearTimers(); openTimer.current = setTimeout(() => setOpen(true), 180); };
  const leave = () => { clearTimers(); closeTimer.current = setTimeout(close, 140); };

  useEffect(() => clearTimers, [clearTimers]);
  useEffect(() => {
    const element = player.current;
    return () => { element?.pause(); };
  }, [audio]);

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (preview.current?.contains(document.activeElement)) anchor.current?.focus({ preventScroll: true });
      close();
    };
    const outside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !anchor.current?.contains(target) && !preview.current?.contains(target)) close();
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", escape); document.removeEventListener("pointerdown", outside); };
  }, [open, close]);

  const play = () => {
    const element = player.current;
    if (!element) return;
    if (playing && player.current) { player.current.pause(); setPlaying(false); return; }
    setAudioError("");
    setPlaying(true);
    void element.play().catch(() => { setPlaying(false); setAudioError("Audio could not be played. Try again."); });
  };

  return <>
    <a
      ref={setReference}
      className={inline ? styles.wordMention : styles.wordBlock}
      data-kind={kind}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      contentEditable={false}
      aria-label={missingLoading && !label ? "Loading linked subject" : undefined}
      aria-busy={missingLoading || undefined}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? tooltipId : undefined}
      onMouseEnter={hover}
      onMouseLeave={leave}
      onFocus={show}
      onBlur={leave}
      onClick={close}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" && open) {
          event.preventDefault();
          preview.current?.querySelector<HTMLElement>("button, a")?.focus();
        }
      }}
    >
      {subject ? <SubjectCharacter subject={subject} className={styles.wordCharacter} imageTone="subject" imageSize={inline ? "1em" : "1.15em"} /> : missingLoading && !label ? <span className={styles.referenceSkeleton} aria-hidden="true" /> : <span className={styles.wordCharacter} lang={label ? "ja" : undefined}>{display}</span>}
      {!inline && subject ? <span className={styles.wordMeaning}>{meaning}</span> : null}
      {!inline && !subject ? <span className={styles.wordMeaning}>{missingLoading ? "Loading details…" : "Details unavailable"}</span> : null}
      {!inline ? <ArrowUpRight size={14} aria-hidden className={styles.wordArrow} /> : null}
    </a>
    {audio ? <audio ref={player} src={audio} preload="none" className="sr-only" aria-hidden="true" onEnded={() => setPlaying(false)} onError={() => { setPlaying(false); setAudioError("Audio could not be played. Try again."); }} /> : null}
    {open ? createPortal(<div
      id={tooltipId}
      ref={setFloating}
      className={`${readerStyles.inspector} ${styles.wordPreview}`}
      style={floatingStyles}
      data-kind={kind}
      role="dialog"
      aria-label={`${display} details`}
      onMouseEnter={show}
      onMouseLeave={leave}
      onFocusCapture={show}
      onBlurCapture={leave}
    >
      {subject ? <><header className={readerStyles.readerInspectorHeader}>
        <SubjectCharacter subject={subject} className={readerStyles.lookupTerm} imageTone="light" imageSize="1.25em" />
        <div className={readerStyles.readerInspectorBadges}><span className={readerStyles.readerInspectorMeta}>Lv {subject.data.level}</span></div>
        {audio ? <button type="button" className={readerStyles.readerInspectorSpeak} onClick={play} aria-label={`${playing ? "Stop" : "Play"} pronunciation for ${display}`} aria-pressed={playing}>{playing ? <Square size={16} aria-hidden /> : <Volume2 size={18} aria-hidden />}</button> : null}
      </header>
      <div className={readerStyles.readerInspectorBody}>
        <div className={readerStyles.readerFacts}>
          <dl className={readerStyles.readerPrimaryFacts} data-layout={reading ? undefined : "stacked"}>
            {reading ? <div><dt>Reading</dt><dd lang="ja">{reading}</dd></div> : null}
            <div><dt>Meaning</dt><dd>{meaning}</dd></div>
          </dl>
          <dl className={readerStyles.readerSecondaryFacts}><div><dt>Type</dt><dd>{subject.data.parts_of_speech?.length ? subject.data.parts_of_speech.join(" · ") : subjectType(subject)}</dd></div></dl>
        </div>
        {audioError ? <p role="status" className={styles.previewError}>{audioError}</p> : null}
        <div className={readerStyles.readerInspectorActions}>
          <a className={readerStyles.readerDetailsButton} href={href} target="_blank" rel="noopener noreferrer">View details <ArrowUpRight size={16} aria-hidden /></a>
          {subject.object !== "radical" ? <a className={readerStyles.secondaryButton} href={`https://jisho.org/search/${encodeURIComponent(subject.data.characters || subject.data.slug)}`} target="_blank" rel="noopener noreferrer">Jisho <ExternalLink size={15} aria-hidden /></a> : null}
        </div>
      </div></> : <>
        <header className={styles.unresolvedHeader}>{display}</header>
        <div className={readerStyles.readerInspectorBody}>
          {subjectsLoading || subjectsError ? <NotebookSubjectCatalogStatus subjectsLoading={subjectsLoading} subjectsError={subjectsError} onRetrySubjects={onRetrySubjects} loadingLabel="Loading subject details…" errorLabel="Subject details could not be loaded." compact rows={2} /> : <p className={styles.unresolvedCopy}>This subject is not in the current catalog.</p>}
          <div className={readerStyles.readerInspectorActions}><a className={readerStyles.readerDetailsButton} href={href} target="_blank" rel="noopener noreferrer">View details <ArrowUpRight size={16} aria-hidden /></a></div>
        </div>
      </>}
    </div>, document.body) : null}
  </>;
}
