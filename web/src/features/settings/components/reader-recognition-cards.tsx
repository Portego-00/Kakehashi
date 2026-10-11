"use client";
import { useState } from "react";
import { SettingsChoices } from "./review-answer-mode-cards";
import styles from "../settings.module.css";

export function ReaderRecognitionCards({ value, onChange }: {
  value: "wk" | "wk-jpdb"; onChange: (value: "wk" | "wk-jpdb") => void;
}) {
  const [preview, setPreview] = useState<"news" | "lyrics">("news");
  return <div className={styles.readerRecognition}>
    <div className={styles.previewSwitcher} role="group" aria-label="Text recognition preview">
      <span>Preview in</span>
      <button type="button" aria-pressed={preview === "news"} onClick={() => setPreview("news")}>NHK News</button>
      <button type="button" aria-pressed={preview === "lyrics"} onClick={() => setPreview("lyrics")}>Song lyrics</button>
    </div>
    <SettingsChoices label="Text recognition" value={value} onChange={onChange} options={[
      { value: "wk", label: "WaniKani only", description: "Highlight matching WaniKani words.", art: `${preview}-wk` },
      { value: "wk-jpdb", label: "WaniKani + JPDB", description: "Add grammar, verbs and vocabulary with JPDB parsing.", art: `${preview}-full` },
    ]} />
  </div>;
}
