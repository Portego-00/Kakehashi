"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Copy, Download, Link2, ExternalLink, Moon, Sun, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/States";
import { analyticsKanjiShareLayout, createAnalyticsShareImage, downloadAnalyticsFile, type AnalyticsShareOptions } from "../analytics-export";
import { createPublicAnalyticsSnapshot, createPublicAnalyticsSnapshotUrl } from "../analytics-public-share";
import { AnalyticsDialog } from "./AnalyticsPrimitives";
import type { AnalyticsWidgetProps } from "./AnalyticsWidgets";
import styles from "../analytics-share.module.css";

export function ShareAnalytics(props: AnalyticsWidgetProps & { username: string; startedAt: string; onClose: () => void }) {
  // A share is a captured snapshot; background sync must not mix newer counts with its original identity or date.
  const [{ insights, subjects, assignments, username, level, startedAt }] = useState(() => props);
  const { onClose } = props;
  const [options, setOptions] = useState<AnalyticsShareOptions>({ username, level, hideUsername: false, hideDays: false, startedAt, theme: "light", format: "stats" });
  const [capturedAt] = useState(() => new Date());
  const [generated, setGenerated] = useState<{ options: AnalyticsShareOptions; insights: typeof insights; subjects: typeof subjects; assignments: typeof assignments; url: string; blob: Blob } | null>(null);
  const currentImage = generated?.options === options && generated.insights === insights && generated.subjects === subjects && generated.assignments === assignments ? generated : null;
  const [message, setMessage] = useState("");
  const [error, setError] = useState<AnalyticsShareOptions | null>(null);
  const [retry, setRetry] = useState(0);
  const [copying, setCopying] = useState(false);
  const [zoom, setZoom] = useState(false);
  const imageHeight = options.format === "kanji" ? analyticsKanjiShareLayout(subjects.filter((subject) => subject.object === "kanji" && !subject.data.hidden_at).length).height : 900;
  const updateOptions = (update: Partial<AnalyticsShareOptions>) => { setOptions((value) => ({ ...value, ...update })); setMessage(""); setZoom(false); };
  const snapshotUrl = () => createPublicAnalyticsSnapshotUrl(createPublicAnalyticsSnapshot(insights, options, subjects, assignments, capturedAt), window.location.origin);

  useEffect(() => {
    let disposed = false;
    let url: string | null = null;
    createAnalyticsShareImage(insights, options, subjects, assignments, capturedAt).then((image) => {
      if (disposed) return;
      url = URL.createObjectURL(image);
      setGenerated({ options, insights, subjects, assignments, url, blob: image });
    }).catch(() => { if (!disposed) setError(options); });
    return () => { disposed = true; if (url) URL.revokeObjectURL(url); };
  }, [insights, options, subjects, assignments, capturedAt, retry]);

  return <AnalyticsDialog title="Share your progress" onClose={onClose} className={styles.dialog} bodyClassName={styles.body}>
    <div className={styles.workspace}>
      <div className={styles.composition}>
        <div className={styles.toolbar}>
          <label className={styles.format}><span>Format</span><select value={options.format} onChange={(event) => updateOptions({ format: event.target.value as AnalyticsShareOptions["format"] })}><option value="stats">Progress summary</option><option value="kanji">Kanji wall</option><option value="activity">Activity calendar</option></select></label>
          <div className={styles.previewTools}><div className={styles.theme} role="group" aria-label="Image theme"><button type="button" aria-label="Light" title="Light image theme" aria-pressed={options.theme === "light"} onClick={() => updateOptions({ theme: "light" })}><Sun size={16} aria-hidden /><span>Light</span></button><button type="button" aria-label="Dark" title="Dark image theme" aria-pressed={options.theme === "dark"} onClick={() => updateOptions({ theme: "dark" })}><Moon size={16} aria-hidden /><span>Dark</span></button></div><button type="button" className={styles.zoom} aria-label="Zoom preview" title={zoom ? "Fit preview" : "Zoom preview"} aria-pressed={zoom} disabled={!currentImage} onClick={() => setZoom(!zoom)}>{zoom ? <ZoomOut size={18} aria-hidden /> : <ZoomIn size={18} aria-hidden />}</button></div>
        </div>
        <div className={styles.preview} role="region" aria-label="Image preview" tabIndex={zoom ? 0 : undefined} data-format={options.format} data-zoom={zoom} style={{ aspectRatio: `1440 / ${imageHeight}` }} aria-busy={!currentImage && error !== options}>
          {currentImage ? <Image src={currentImage.url} alt="Your progress image preview" width={1440} height={imageHeight} unoptimized className={styles.image} /> : error === options ? <div className={styles.error}><p>The preview could not be created.</p><Button tone="default" size="small" onClick={() => { setError(null); setRetry((value) => value + 1); }}>Try again</Button></div> : <Skeleton height="100%" />}
        </div>
        <div className={styles.exportActions}>
          <Button tone="primary" disabled={!currentImage} onClick={() => { if (currentImage) downloadAnalyticsFile(currentImage.blob, `kakehashi-${options.format}.png`); }}><Download size={16} aria-hidden />Download PNG</Button>
          <Button tone="default" disabled={!currentImage || copying} onClick={async () => {
            if (!currentImage) return;
            setCopying(true);
            try { await navigator.clipboard.write([new ClipboardItem({ "image/png": currentImage.blob })]); setMessage("Image copied."); }
            catch { setMessage("Clipboard access is unavailable. Download the PNG instead."); }
            finally { setCopying(false); }
          }}><Copy size={16} aria-hidden />Copy image</Button>
        </div>
      </div>
      <aside className={styles.settings} aria-label="Sharing settings">
        <fieldset className={styles.privacy}><legend>Privacy</legend><label><span>Hide username</span><input type="checkbox" checked={options.hideUsername} onChange={(event) => updateOptions({ hideUsername: event.target.checked })} /></label><label><span>Hide days studying</span><input type="checkbox" checked={options.hideDays} onChange={(event) => updateOptions({ hideDays: event.target.checked })} /></label><label className={styles.date}><span>Started studying</span><input type="date" value={options.startedAt.slice(0, 10)} max={capturedAt.toISOString().slice(0, 10)} disabled={options.hideDays} onChange={(event) => updateOptions({ startedAt: event.target.value })} /></label></fieldset>
        <div className={styles.snapshot}>
          <h3>Share a snapshot</h3>
          <p>A fixed view of these statistics. Anyone with the link can open it.</p>
          <Button tone="default" onClick={async () => { try { await navigator.clipboard.writeText(snapshotUrl()); setMessage("Snapshot link copied."); } catch { setMessage("The link could not be copied. Open the snapshot to copy its address."); } }}><Link2 size={16} aria-hidden />Copy snapshot link</Button>
          <Button tone="ghost" onClick={() => { try { window.open(snapshotUrl(), "_blank", "noopener,noreferrer"); } catch { setMessage("The snapshot could not be created. Check your sharing settings."); } }}><ExternalLink size={16} aria-hidden />Preview snapshot</Button>
          <details className={styles.included}><summary>Included information</summary><p>Level, lifetime accuracy, Guru+ kanji, burned items and SRS counts. Your name and study duration follow the privacy settings above. Your API token is never included.</p></details>
        </div>
      </aside>
    </div>
    <p role="status" className={styles.status}>{message}</p>
  </AnalyticsDialog>;
}
