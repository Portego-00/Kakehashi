import type { SubtitleCue, TimedLyricLine } from "./types";

const JAPANESE_RE = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\u3005\u3006\u303bｦ-ﾟ]/;

function decodeEntities(value: string) {
  if (typeof document === "undefined") {
    return value.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
  }
  const element = document.createElement("textarea");
  element.innerHTML = value;
  return element.value;
}

export function parseTimestamp(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  const parts = normalized.split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  const seconds = Number(parts.at(-1));
  const minutes = Number(parts.at(-2));
  const hours = parts.length === 3 ? Number(parts[0]) : 0;
  if (![hours, minutes, seconds].every(Number.isFinite) || minutes < 0 || seconds < 0) return null;
  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}

export function parseSrt(input: string): SubtitleCue[] {
  const blocks = input.replace(/^\uFEFF/, "").replace(/\r/g, "").trim().split(/\n{2,}/);
  const cues: SubtitleCue[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trimEnd());
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex < 0) continue;
    const [startValue, rawEnd] = lines[timingIndex].split("-->");
    const endValue = rawEnd?.trim().split(/\s+/)[0] ?? "";
    const startMs = parseTimestamp(startValue);
    const endMs = parseTimestamp(endValue);
    const text = decodeEntities(lines.slice(timingIndex + 1).join("\n").replace(/<[^>]+>/g, "")).trim();
    if (startMs === null || endMs === null || endMs <= startMs || !text) continue;
    cues.push({ id: `cue-${cues.length}-${startMs}`, startMs, endMs, text });
  }
  return cues.sort((left, right) => left.startMs - right.startMs);
}

export function parseLrc(input: string): TimedLyricLine[] {
  const staged: Array<{ startMs: number; text: string }> = [];
  for (const rawLine of input.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const timestamps = [...rawLine.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const text = rawLine.replace(/\[[^\]]+\]/g, "").trim();
    if (!text) continue;
    for (const timestamp of timestamps) {
      const minutes = Number(timestamp[1]);
      const seconds = Number(timestamp[2]);
      const fraction = timestamp[3] ?? "0";
      const milliseconds = fraction.length === 1 ? Number(fraction) * 100 : fraction.length === 2 ? Number(fraction) * 10 : Number(fraction.slice(0, 3));
      staged.push({ startMs: (minutes * 60 + seconds) * 1000 + milliseconds, text });
    }
  }
  staged.sort((left, right) => left.startMs - right.startMs);
  return staged.map((line, index) => ({
    id: `lyric-${index}-${line.startMs}`,
    startMs: line.startMs,
    endMs: staged[index + 1]?.startMs ?? line.startMs + 5000,
    text: line.text,
  }));
}

export function plainLyricsToLines(input: string): TimedLyricLine[] {
  return input.split(/\r?\n/).map((text) => text.trim()).filter(Boolean).map((text, index) => ({
    id: `plain-${index}`,
    startMs: index * 5000,
    endMs: (index + 1) * 5000,
    text,
  }));
}

export function findCueAt(cues: SubtitleCue[], timeMs: number) {
  let low = 0;
  let high = cues.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const cue = cues[middle];
    if (timeMs < cue.startMs) high = middle - 1;
    else if (timeMs >= cue.endMs) low = middle + 1;
    else return cue;
  }
  return null;
}

export function extractReadableTextFromHtml(html: string) {
  const withoutNoise = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/article|\/section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(withoutNoise)
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractTitleFromHtml(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1].replace(/<[^>]+>/g, " ")).trim() : "Imported article";
}

export function isMostlyJapanese(value: string) {
  const meaningful = [...value].filter((character) => /\S/.test(character));
  if (meaningful.length === 0) return false;
  return meaningful.filter((character) => JAPANESE_RE.test(character)).length / meaningful.length >= 0.25;
}

function readUint16(view: DataView, offset: number) { return view.getUint16(offset, true); }
function readUint32(view: DataView, offset: number) { return view.getUint32(offset, true); }

async function inflateRaw(data: Uint8Array) {
  if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot decompress EPUB files.");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw" as CompressionFormat));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZipEntries(file: Blob): Promise<Map<string, Uint8Array>> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocd = -1;
  for (let offset = Math.max(0, bytes.length - 65_557); offset <= bytes.length - 22; offset += 1) {
    if (readUint32(view, offset) === 0x06054b50) eocd = offset;
  }
  if (eocd < 0) throw new Error("This file is not a readable EPUB archive.");
  const count = readUint16(view, eocd + 10);
  let cursor = readUint32(view, eocd + 16);
  const decoder = new TextDecoder();
  const entries = new Map<string, Uint8Array>();
  for (let index = 0; index < count; index += 1) {
    if (readUint32(view, cursor) !== 0x02014b50) throw new Error("The EPUB directory is damaged.");
    const method = readUint16(view, cursor + 10);
    const compressedSize = readUint32(view, cursor + 20);
    const fileNameLength = readUint16(view, cursor + 28);
    const extraLength = readUint16(view, cursor + 30);
    const commentLength = readUint16(view, cursor + 32);
    const localOffset = readUint32(view, cursor + 42);
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + fileNameLength));
    const localNameLength = readUint16(view, localOffset + 26);
    const localExtraLength = readUint16(view, localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(start, start + compressedSize);
    if (method === 0) entries.set(name, compressed);
    else if (method === 8) entries.set(name, await inflateRaw(compressed));
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function resolveArchivePath(basePath: string, relativePath: string) {
  const base = basePath.split("/").slice(0, -1);
  for (const part of relativePath.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") base.pop();
    else base.push(part);
  }
  return base.join("/");
}

export async function extractEpub(file: Blob) {
  const entries = await readZipEntries(file);
  const decoder = new TextDecoder();
  const container = entries.get("META-INF/container.xml");
  if (!container) throw new Error("The EPUB container manifest is missing.");
  const containerXml = decoder.decode(container);
  const rootPath = containerXml.match(/full-path=["']([^"']+)["']/i)?.[1];
  if (!rootPath) throw new Error("The EPUB package path is missing.");
  const packageBytes = entries.get(rootPath);
  if (!packageBytes) throw new Error("The EPUB package could not be opened.");
  const packageXml = decoder.decode(packageBytes);
  const title = decodeEntities(packageXml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1] ?? "Untitled book");
  const manifest = new Map<string, string>();
  for (const match of packageXml.matchAll(/<item\b[^>]*\bid=["']([^"']+)["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi)) manifest.set(match[1], match[2]);
  const spineIds = [...packageXml.matchAll(/<itemref\b[^>]*\bidref=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  const chapters = spineIds.flatMap((id) => {
    const href = manifest.get(id);
    if (!href) return [];
    const entry = entries.get(resolveArchivePath(rootPath, decodeURIComponent(href.split("#")[0])));
    if (!entry) return [];
    const text = extractReadableTextFromHtml(decoder.decode(entry));
    return text ? [text] : [];
  });
  if (chapters.length === 0) throw new Error("No readable chapters were found in this EPUB.");
  return { title: title.trim() || "Untitled book", chapters, text: chapters.join("\n\n") };
}
