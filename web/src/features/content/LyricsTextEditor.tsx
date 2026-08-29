import { useMemo, useState, type FormEvent } from "react";
import { parseLyricsText, type LyricsTextFormat } from "./parsers";
import styles from "./content.module.css";

const FORMAT_LABELS: Record<LyricsTextFormat, string> = {
  plain: "Plain text",
  lrc: "LRC",
  srt: "SRT",
  webvtt: "WebVTT",
  timestamped: "Timestamped lines",
};

export function LyricsTextEditor({
  kind,
  initialValue,
  onCancel,
  onSave,
}: {
  kind: "lyrics" | "transcript";
  initialValue: string;
  onCancel: () => void;
  onSave: (value: string) => boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const parsed = useMemo(() => parseLyricsText(value), [value]);
  const label = kind === "lyrics" ? "Custom lyrics" : "Custom transcript";
  const lineLabel = parsed.lines.length === 1 ? "line" : "lines";

  function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = value.trim();
    if (!normalized || !parsed.lines.length) return;
    if (onSave(normalized)) onCancel();
  }

  return (
    <form className={styles.lyricsTextEditor} onSubmit={submit}>
      <label className={styles.field}>
        <span>{kind === "lyrics" ? "Paste lyrics" : "Paste lyrics or a transcript"}</span>
        <textarea
          className={styles.textarea}
          aria-label={label}
          autoFocus
          spellCheck={false}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={"Plain text, or timed lines\n[00:12.50] 歌詞の一行"}
        />
      </label>
      <p className={styles.lyricsTextEditorHint}>Timed lyrics usually use LRC timestamps such as [00:12.50]. SRT, WebVTT, and lines beginning with 01:23 also work.</p>
      {value.trim() ? <p className={styles.lyricsTextEditorDetection} role="status">Detected: {FORMAT_LABELS[parsed.format]} · {parsed.lines.length} {parsed.timed ? "timed " : ""}{lineLabel}</p> : null}
      <div className={styles.lyricsTextEditorActions}>
        <button className={styles.secondaryButton} type="button" onClick={onCancel}>Cancel</button>
        <button className={styles.button} type="submit" disabled={!value.trim() || !parsed.lines.length}>Save {kind}</button>
      </div>
    </form>
  );
}
