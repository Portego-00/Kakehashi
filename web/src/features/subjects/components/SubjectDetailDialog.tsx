"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./SubjectDetailDialog.module.css";

export function SubjectDetailDialog({ children, returnLabel }: { children: ReactNode; returnLabel: string }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = useCallback(() => router.back(), [router]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    return () => {
      if (dialog.open && typeof dialog.close === "function") dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label="Item details"
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div className={styles.sheet}>
        <header className={styles.toolbar}>
          <button type="button" className={styles.back} onClick={close} autoFocus>
            <ArrowLeft size={18} aria-hidden="true" />
            {returnLabel}
          </button>
          <span>Item details</span>
          <button type="button" className={styles.close} aria-label={`Close item details · ${returnLabel}`} onClick={close}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </dialog>
  );
}
