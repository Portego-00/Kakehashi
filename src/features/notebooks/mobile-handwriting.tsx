import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { resolveNotebookPaperColor, type NotebookPaperAppearance } from "../../../web/src/features/notebooks/paper-appearance";
import { Expand, Pencil, X } from "lucide-react";

export function MobileHandwriting({ drawingId, width, height, loadPreview, onEdit, paperColor = "auto", previewFormat, theme = "light", themeBackground }: {
  drawingId: string; width: number; height: number;
  paperColor?: string; previewFormat?: string; theme?: "light" | "dark"; themeBackground?: string;
  loadPreview?: (drawingId: string, appearance?: NotebookPaperAppearance) => Promise<string>;
  onEdit?: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const paper = resolveNotebookPaperColor(paperColor, themeBackground || (theme === "dark" ? "#1e1e1e" : "#ffffff"));
  const appearance = previewFormat === "themed-v1" ? paper.appearance : undefined;
  useEffect(() => {
    let current = true;
    setPreview(null); setError("");
    if (!loadPreview || !drawingId) { setError("Reopen this notebook in the latest app to view handwriting."); return; }
    void loadPreview(drawingId, appearance).then((uri) => { if (current) setPreview(uri); }).catch((caught) => { if (current) setError(caught instanceof Error ? caught.message : "Handwriting couldn't load."); });
    return () => { current = false; };
  }, [drawingId, loadPreview, appearance, retry]);
  return <figure className="nb-handwriting" style={{ "--nb-paper-color": paper.color } as CSSProperties} contentEditable={false}>
    <div className="nb-handwriting-actions"><span>Handwriting</span>
      {preview ? <button type="button" className="nb-icon-button" aria-label="Expand handwriting" onClick={() => dialog.current?.showModal()}><Expand size={18} /></button> : null}
      {onEdit ? <button type="button" className="nb-icon-button" aria-label="Edit handwriting" onClick={onEdit}><Pencil size={18} /></button> : null}
    </div>
    {preview ? <button type="button" className="nb-handwriting-preview" aria-label="View handwriting" onClick={() => dialog.current?.showModal()}><img src={preview} width={width} height={height} alt="Handwritten notebook content" onError={() => { setPreview(null); setError("Handwriting couldn't be displayed. Try again."); }} /></button>
      : <div className="nb-handwriting-status" role="status">{error || "Loading handwriting…"}{error && loadPreview ? <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button> : null}</div>}
    <dialog ref={dialog} className="nb-handwriting-dialog" aria-labelledby={titleId} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <header><h2 id={titleId}>Handwriting</h2><button type="button" className="nb-icon-button" aria-label="Close handwriting" onClick={() => dialog.current?.close()}><X size={22} /></button></header>
      {preview ? <img src={preview} width={width} height={height} alt="Expanded handwritten notebook content" /> : null}
    </dialog>
  </figure>;
}
