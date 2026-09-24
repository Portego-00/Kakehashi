"use client";

import { useRef, useState } from "react";
import { Settings } from "lucide-react";
import styles from "../study.module.css";
import type { WebStudyPreferences } from "@/features/settings/settings";
import { ReviewSettingsDialog } from "./ReviewSettingsDialog";

export interface ReviewSettingsButtonProps {
  order?: "reviewOrder" | "customReviewOrder" | "lessonQuestionOrder";
  ankiSupported?: boolean;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  onStudyChange?: (next: WebStudyPreferences, previous: WebStudyPreferences) => void;
}

export function ReviewSettingsButton({ disabled, onOpenChange, ...props }: ReviewSettingsButtonProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  function close() {
    setOpen(false);
    onOpenChange?.(false);
    trigger.current?.focus({ preventScroll: true });
  }
  return <>
    <button ref={trigger} className={styles.iconButton} type="button" aria-label="Review settings" title="Review settings" aria-haspopup="dialog" disabled={disabled} onClick={() => { setOpen(true); onOpenChange?.(true); }}><Settings size={18} aria-hidden /></button>
    {open ? <ReviewSettingsDialog {...props} onClose={close} /> : null}
  </>;
}
