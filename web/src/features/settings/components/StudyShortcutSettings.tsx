"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronRight, Keyboard, X } from "lucide-react";
import { DEFAULT_STUDY_SHORTCUTS, STUDY_SHORTCUT_LABELS, shortcutLabel, validShortcutKey, type StudyShortcutAction, type StudyShortcuts } from "../study-shortcuts";
import styles from "./StudyShortcutSettings.module.css";

export function StudyShortcutSettings({ value, onChange }: { value: StudyShortcuts; onChange: (value: StudyShortcuts) => void }) {
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState<StudyShortcutAction | null>(null);
  const [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const title = useId();
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    if (element?.showModal) element.showModal(); else element?.setAttribute("open", "");
    return () => { element?.close?.(); trigger.current?.focus(); };
  }, [open]);
  function close() { setOpen(false); setRecording(null); setMessage(""); }
  return <div data-settings-search="Custom study keys" data-search-keywords="Anki keyboard shortcuts progress replay audio correct incorrect">
    <button ref={trigger} type="button" className={styles.entry} onClick={() => setOpen(true)} aria-haspopup="dialog">
      <span><strong>Custom study keys</strong><small>Choose shortcuts for revealing, grading, audio, and more.</small></span><ChevronRight size={18} aria-hidden />
    </button>
    {open ? <dialog ref={dialog} className={styles.dialog} aria-labelledby={title} onCancel={(event) => { event.preventDefault(); if (recording) { setRecording(null); setMessage("Key change canceled."); } else close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className={styles.content}>
        <header className={styles.header}><h2 id={title}><Keyboard size={21} aria-hidden />Study keys</h2><button type="button" aria-label="Close study keys" onClick={close}><X size={20} aria-hidden /></button></header>
        <p className={styles.description}>Choose a key to change it, then press a new key. Your changes save automatically across reviews, lesson quizzes, extra study, and mixed sessions.</p>
        <div className={styles.bindings}>
          {(Object.keys(STUDY_SHORTCUT_LABELS) as StudyShortcutAction[]).map((action) => <div key={action} className={styles.row}>
            <span>{STUDY_SHORTCUT_LABELS[action]}</span>
            <button type="button" className={styles.key} data-recording={recording === action} aria-label={`Change ${STUDY_SHORTCUT_LABELS[action].toLowerCase()} key, currently ${shortcutLabel(value[action])}`} aria-pressed={recording === action}
              onClick={() => { setRecording(action); setMessage("Press a new key. Escape cancels."); }}
              onBlur={() => { if (recording === action) setRecording(null); }}
              onKeyDown={(event) => {
                if (recording !== action || event.key === "Tab") return;
                event.preventDefault(); event.stopPropagation();
                if (event.key === "Escape") { setRecording(null); setMessage("Key change canceled."); return; }
                if (event.repeat || event.nativeEvent.isComposing) return;
                if (event.ctrlKey || event.metaKey || event.altKey || !validShortcutKey(event.key)) { setMessage("Use a letter, number, symbol, arrow key, Enter, or Space without modifiers."); return; }
                const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
                const duplicate = (Object.keys(value) as StudyShortcutAction[]).find((other) => other !== action && value[other] === key);
                if (duplicate) { setMessage(`${shortcutLabel(key)} is already used for ${STUDY_SHORTCUT_LABELS[duplicate].toLowerCase()}. Choose another key.`); return; }
                onChange({ ...value, [action]: key }); setRecording(null); setMessage(`${STUDY_SHORTCUT_LABELS[action]} set to ${shortcutLabel(key)}.`);
              }}><kbd>{recording === action ? "Press a key…" : shortcutLabel(value[action])}</kbd></button>
          </div>)}
        </div>
        <p className={styles.status} role="status">{message || "Shortcuts respect the keyboard shortcuts setting. Some actions are specific to a study mode."}</p>
        <footer className={styles.footer}><button type="button" onClick={() => { setRecording(null); onChange({ ...DEFAULT_STUDY_SHORTCUTS }); setMessage("Default study keys restored."); }}>Reset to defaults</button><button type="button" onClick={close}>Done</button></footer>
      </div>
    </dialog> : null}
  </div>;
}
