"use client";

import dynamic from "next/dynamic";
import { useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { X } from "lucide-react";
import styles from "./emoji-picker.module.css";

const NotebookEmojiPicker = dynamic(() => import("./NotebookEmojiPicker"), {
  ssr: false,
  loading: () => <p className={styles.loading} role="status">Loading emojis…</p>,
});

export function NotebookPageIcon({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const close = () => { dialog.current?.close(); setOpen(false); trigger.current?.focus({ preventScroll: true }); };

  return <>
    <button ref={trigger} type="button" className={styles.trigger} aria-label="Change page emoji" title="Change page emoji" aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={() => setOpen(true)}>
      <span aria-hidden="true">{value || "📓"}</span>
    </button>
    {open ? <EmojiDialog dialog={dialog} titleId={titleId} onClose={close}>
      <NotebookEmojiPicker value={value} onSelect={(emoji) => { onChange(emoji); close(); }} />
    </EmojiDialog> : null}
  </>;
}

function EmojiDialog({ dialog, titleId, onClose, children }: { dialog: RefObject<HTMLDialogElement | null>; titleId: string; onClose: () => void; children: ReactNode }) {
  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, [dialog]);

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
    }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.panel}>
      <header className={styles.header}>
        <h2 id={titleId}>Page emoji</h2>
        <button type="button" className={styles.close} aria-label="Close emoji picker" onClick={onClose}><X size={18} aria-hidden /></button>
      </header>
      {children}
    </div>
  </dialog>;
}
