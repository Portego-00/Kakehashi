"use client";

import { useEffect, useId, useRef } from "react";
import { ExternalLink } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { STUDY_MATERIAL_PERMISSION_MESSAGE, STUDY_MATERIAL_PERMISSION_TITLE, STUDY_MATERIAL_TOKEN_SETTINGS_URL } from "../../../../../shared/study-material-permissions";
import styles from "../study-material-permissions.module.css";

export function StudyMaterialPermissionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  return <dialog ref={ref} className={styles.dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onClose={(event) => event.stopPropagation()}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    {open ? <>
      <h2 id={titleId}>{STUDY_MATERIAL_PERMISSION_TITLE}</h2>
      <p id={descriptionId}>{STUDY_MATERIAL_PERMISSION_MESSAGE}</p>
      <div className={styles.actions}>
        <Button type="button" tone="ghost" onClick={onClose}>Keep editing</Button>
        <ButtonLink href={STUDY_MATERIAL_TOKEN_SETTINGS_URL} target="_blank" rel="noopener noreferrer" tone="primary">Open API token settings<ExternalLink size={16} aria-hidden /></ButtonLink>
      </div>
    </> : null}
  </dialog>;
}
