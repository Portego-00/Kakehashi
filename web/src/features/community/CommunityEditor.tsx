"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CommunityMarkdown } from "./CommunityMarkdown";
import { COMMUNITY_IMAGE_ACCEPT, COMMUNITY_IMAGE_MAX_BYTES, COMMUNITY_IMAGE_TYPES } from "./media";
import styles from "@/features/content/community.module.css";

type Props = {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onUploadingChange: (uploading: boolean) => void;
  maxLength: number;
  placeholder: string;
  disabled?: boolean;
};

export function CommunityEditor({ id, label, value, onChange, onUploadingChange, maxLength, placeholder, disabled }: Props) {
  const generatedId = useId();
  const editorId = id || generatedId;
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef({ value, onChange });
  useEffect(() => { latest.current = { value, onChange }; }, [value, onChange]);
  const uploadLock = useRef(false);

  async function upload(files: File[]) {
    if (!files.length || uploadLock.current || disabled) return;
    uploadLock.current = true;
    setUploading(true); onUploadingChange(true); setError("");
    try {
      for (const file of files) {
        const type = /\.hei[cf]$/i.test(file.name) ? "image/heic" : file.type;
        if (!COMMUNITY_IMAGE_TYPES.has(type)) throw new Error("Choose a PNG, JPEG, GIF, WebP, AVIF or HEIC image.");
        if (!file.size || file.size > COMMUNITY_IMAGE_MAX_BYTES) throw new Error("Each image must be smaller than 4 MB.");
        // Reserve enough room before uploading, and recheck against any edits made while it runs.
        if (latest.current.value.length + 500 > maxLength) throw new Error("Make some room in your message before attaching an image.");
        const response = await fetch("/community/media", { method: "POST", headers: { "Content-Type": type }, body: file, signal: AbortSignal.timeout(60_000) });
        const result = await response.json().catch(() => null) as { url?: string; error?: string } | null;
        if (!response.ok || !result?.url) throw new Error(result?.error || "The image could not be uploaded. Please try again.");
        const attachment = `\n\n![Image](${result.url})\n`;
        const current = latest.current.value;
        if (current.length + attachment.length > maxLength) throw new Error("Your message is too long to insert the image. Shorten it and try again.");
        latest.current.value = current + attachment;
        latest.current.onChange(current + attachment);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The image could not be uploaded."); }
    finally { uploadLock.current = false; setUploading(false); onUploadingChange(false); if (input.current) input.current.value = ""; }
  }

  return <div className={styles.editor}>
    <label htmlFor={editorId}>{label}</label>
    <div className={styles.modeTabs} role="tablist" aria-label={`${label} editor mode`}>
      {[false, true].map((mode) => <button key={String(mode)} id={`${editorId}-${mode ? "preview" : "write"}`} type="button" role="tab" aria-selected={preview === mode} aria-controls={`${editorId}-panel`} tabIndex={preview === mode ? 0 : -1} onClick={() => setPreview(mode)} onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "ArrowRight" || event.key === "End"; setPreview(next); document.getElementById(`${editorId}-${next ? "preview" : "write"}`)?.focus(); } }}>{mode ? "Preview" : "Write"}</button>)}
    </div>
    <div id={`${editorId}-panel`} role="tabpanel" aria-labelledby={`${editorId}-${preview ? "preview" : "write"}`} onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }} onDrop={(event) => { if (event.dataTransfer.files.length) { event.preventDefault(); void upload(Array.from(event.dataTransfer.files)); } }}>
      {preview ? <div className={styles.editorPreview}>{value.trim() ? <CommunityMarkdown>{value}</CommunityMarkdown> : <p>Nothing to preview yet.</p>}</div> : <textarea id={editorId} value={value} maxLength={maxLength} disabled={disabled} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} onPaste={(event) => { const files = Array.from(event.clipboardData.files); if (files.length) { event.preventDefault(); void upload(files); } }} />}
    </div>
    <div className={styles.attachmentToolbar}>
      <input ref={input} hidden type="file" tabIndex={-1} aria-label={`Attach images to ${label}`} accept={COMMUNITY_IMAGE_ACCEPT} multiple disabled={disabled || uploading} onChange={(event) => void upload(Array.from(event.target.files || []))} />
      <button className={styles.secondary} type="button" disabled={disabled || uploading} onClick={() => input.current?.click()}>{uploading ? "Uploading…" : "Attach images"}</button>
      <span>Paste or drop images · up to 4 MB each · Markdown supported</span>
    </div>
    {uploading ? <p role="status">Uploading images. Wait before posting.</p> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
  </div>;
}
