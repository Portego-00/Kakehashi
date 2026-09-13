import type { PDFDocumentProxy } from "pdfjs-dist";

const PDF_WORKER_URL = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
const MAX_RENDER_EDGE = 2_400;
const MAX_RENDER_PIXELS = 8_000_000;
export const MAX_MANGA_PDF_BYTES = 300 * 1024 * 1024;

export interface MangaPdfDocument {
  pageCount: number;
  renderPage(pageNumber: number): Promise<Blob>;
  destroy(): Promise<void>;
}

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
  return pdfjs;
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The PDF page could not be converted to an image."));
    }, "image/jpeg", 0.92);
  });
}

function safePageNumber(pageNumber: number, pageCount: number) {
  return Math.max(1, Math.min(pageCount, Math.floor(pageNumber || 1)));
}

async function renderPage(document: PDFDocumentProxy, pageNumber: number) {
  const page = await document.getPage(safePageNumber(pageNumber, document.numPages));
  try {
    const baseViewport = page.getViewport({ scale: 1 });
    const baseEdge = Math.max(baseViewport.width, baseViewport.height);
    if (!Number.isFinite(baseEdge) || baseEdge <= 0) throw new Error("This PDF page has invalid dimensions.");
    const scale = Math.min(2, MAX_RENDER_EDGE / baseEdge);
    const viewport = page.getViewport({ scale });
    if (viewport.width * viewport.height > MAX_RENDER_PIXELS) throw new Error("This PDF page is too large to render safely.");
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("This browser cannot render PDF pages.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;
    return canvasToBlob(canvas);
  } finally {
    page.cleanup();
  }
}

export async function openMangaPdf(file: Blob): Promise<MangaPdfDocument> {
  if (file.size > MAX_MANGA_PDF_BYTES) throw new Error("PDF manga imports are limited to 300 MB.");
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data, isEvalSupported: false, stopAtErrors: true });
  let document: PDFDocumentProxy;
  try {
    document = await task.promise;
  } catch (error) {
    await task.destroy().catch(() => undefined);
    throw new Error(error instanceof Error && /password/i.test(error.message)
      ? "Password-protected PDFs are not supported."
      : "This PDF could not be opened.");
  }

  return {
    pageCount: document.numPages,
    renderPage: (pageNumber) => renderPage(document, pageNumber),
    destroy: async () => { await document.destroy(); },
  };
}

export async function getMangaPdfPageCount(file: Blob) {
  const document = await openMangaPdf(file);
  try {
    return document.pageCount;
  } finally {
    await document.destroy();
  }
}
