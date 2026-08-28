import { AsyncUnzipInflate, Unzip, type UnzipFile } from "fflate";

const MARKUP_EXTENSIONS = new Set(["css", "htm", "html", "opf", "svg", "xhtml", "xml"]);
const CONTENT_DOCUMENT_TYPES = new Set(["application/xhtml+xml", "image/svg+xml", "text/html"]);
const SAFE_IMAGE_TYPES = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);
const SAFE_IMAGE_EXTENSIONS = new Set(["avif", "gif", "jpeg", "jpg", "png", "webp"]);
const BLOCK_ELEMENTS = new Set([
  "address", "article", "aside", "blockquote", "dd", "div", "dl", "dt", "figcaption", "figure", "footer",
  "h1", "h2", "h3", "h4", "h5", "h6", "header", "li", "main", "nav", "ol", "p", "pre", "section",
  "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul",
]);
const IGNORED_CONTENT_ELEMENTS = new Set(["head", "noscript", "script", "style", "template", "title"]);
const MAX_EPUB_BYTES = 200 * 1024 * 1024;
const MAX_EPUB_ENTRIES = 5_000;
const MAX_ARCHIVE_ENTRY_BYTES = 64 * 1024 * 1024;
const MAX_ARCHIVE_EXPANDED_BYTES = 300 * 1024 * 1024;
const MAX_MARKUP_ENTRY_BYTES = 5 * 1024 * 1024;
const MAX_MARKUP_BYTES = 50 * 1024 * 1024;
const MAX_COVER_BYTES = 30 * 1024 * 1024;
const MAX_SUSPICIOUS_COMPRESSION_RATIO = 250;
const MAX_SPINE_ITEMS = 2_000;

interface BufferedEntry {
  chunks: ArrayBuffer[];
  path: string;
  size: number;
}

interface ArchiveIndex {
  aliases: Map<string, string>;
  entries: Map<string, BufferedEntry>;
}

interface ManifestItem {
  fallbackId: string | null;
  id: string;
  mediaType: string;
  path: string | null;
  properties: Set<string>;
}

export type EpubWritingMode = "horizontal-tb" | "vertical-lr" | "vertical-rl";
export type EpubPageProgressionDirection = "ltr" | "rtl";

export type EpubContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; path: string; alt: string; mediaType: string };

export interface EpubChapterSummary {
  blocks: EpubContentBlock[];
  path: string;
  text: string;
  title: string | null;
  writingMode: EpubWritingMode | null;
}

export interface ExtractedBookEpub {
  chapters: EpubChapterSummary[];
  cover?: Blob;
  coverPath?: string;
  language: string | null;
  pageProgressionDirection: EpubPageProgressionDirection | null;
  text: string;
  title: string;
}

export class BookEpubImportError extends Error {}

function extension(path: string) {
  return path.toLocaleLowerCase().match(/\.([a-z0-9]+)$/u)?.[1] ?? "";
}

function basename(path: string) {
  return path.replaceAll("\\", "/").split("/").at(-1) ?? path;
}

function normalizeArchivePath(value: string) {
  const normalized = value.replaceAll("\\", "/");
  if (!normalized || normalized.includes("\0") || normalized.startsWith("/") || normalized.startsWith("//")) return null;
  const output: string[] = [];
  for (const segment of normalized.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (!output.length) return null;
      output.pop();
    } else {
      output.push(segment);
    }
  }
  return output.join("/") || null;
}

function safelyDecodePath(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function archiveEntryAliases(path: string) {
  const raw = normalizeArchivePath(path);
  if (!raw) return null;
  const decodedValue = safelyDecodePath(raw);
  const decoded = normalizeArchivePath(decodedValue);
  if (!decoded) return null;
  return decoded === raw ? [raw] : [raw, decoded];
}

function resolveArchiveReference(baseFilePath: string, reference: string, label: string) {
  const trimmed = reference.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const pathOnly = trimmed.split(/[?#]/u, 1)[0];
  if (!pathOnly) return null;
  const decoded = safelyDecodePath(pathOnly);
  if (/^[a-z][a-z0-9+.-]*:/iu.test(decoded) || decoded.startsWith("//")) return null;
  if (decoded.startsWith("/") || decoded.includes("\0")) {
    throw new BookEpubImportError(`The EPUB ${label} uses an unsafe archive path.`);
  }
  const baseDirectory = baseFilePath.split("/").slice(0, -1).join("/");
  const resolved = normalizeArchivePath(baseDirectory ? `${baseDirectory}/${decoded}` : decoded);
  if (!resolved) throw new BookEpubImportError(`The EPUB ${label} escapes the archive root.`);
  return resolved;
}

function isIgnoredArchivePath(path: string) {
  const name = basename(path);
  return path.startsWith("__MACOSX/") || name.startsWith("._") || name === ".DS_Store";
}

function readBlobBytes(file: Blob) {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("The selected EPUB could not be read."));
    reader.readAsArrayBuffer(file);
  });
}

async function validateArchiveDeclarations(file: Blob) {
  if (file.size > MAX_EPUB_BYTES) throw new BookEpubImportError("EPUB book imports are limited to 200 MB.");

  const tailStart = Math.max(0, file.size - (65_535 + 22));
  const tail = new Uint8Array(await readBlobBytes(file.slice(tailStart)));
  const tailView = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  let endOffset = -1;
  for (let offset = tail.byteLength - 22; offset >= 0; offset -= 1) {
    if (tailView.getUint32(offset, true) !== 0x06054b50) continue;
    const commentLength = tailView.getUint16(offset + 20, true);
    if (offset + 22 + commentLength === tail.byteLength) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new BookEpubImportError("The EPUB ZIP directory is missing or damaged.");

  const diskNumber = tailView.getUint16(endOffset + 4, true);
  const directoryDisk = tailView.getUint16(endOffset + 6, true);
  const entriesOnDisk = tailView.getUint16(endOffset + 8, true);
  const entryCount = tailView.getUint16(endOffset + 10, true);
  const directorySize = tailView.getUint32(endOffset + 12, true);
  const directoryOffset = tailView.getUint32(endOffset + 16, true);
  if (diskNumber !== 0 || directoryDisk !== 0 || entriesOnDisk !== entryCount) {
    throw new BookEpubImportError("Multi-part EPUB archives are not supported.");
  }
  if (entryCount === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
    throw new BookEpubImportError("ZIP64 EPUB archives are not supported within the import size limit.");
  }
  if (entryCount > MAX_EPUB_ENTRIES) throw new BookEpubImportError("This EPUB contains too many files to open safely.");
  if (directoryOffset + directorySize > file.size) {
    throw new BookEpubImportError("The EPUB ZIP directory is damaged.");
  }

  const directory = new Uint8Array(await readBlobBytes(file.slice(directoryOffset, directoryOffset + directorySize)));
  const view = new DataView(directory.buffer, directory.byteOffset, directory.byteLength);
  const decoder = new TextDecoder();
  let archiveDeclaredBytes = 0;
  let offset = 0;
  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (offset + 46 > directory.byteLength || view.getUint32(offset, true) !== 0x02014b50) {
      throw new BookEpubImportError("The EPUB ZIP directory is damaged.");
    }
    const compressedSize = view.getUint32(offset + 20, true);
    const originalSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const recordLength = 46 + nameLength + extraLength + commentLength;
    if (offset + recordLength > directory.byteLength) {
      throw new BookEpubImportError("The EPUB ZIP directory is damaged.");
    }
    if (compressedSize === 0xffffffff || originalSize === 0xffffffff) {
      throw new BookEpubImportError("ZIP64 EPUB entries are not supported within the import size limit.");
    }
    const name = decoder.decode(directory.subarray(offset + 46, offset + 46 + nameLength));
    archiveDeclaredBytes += originalSize;
    if (originalSize > MAX_ARCHIVE_ENTRY_BYTES) {
      throw new BookEpubImportError(`“${basename(name)}” is too large to open safely.`);
    }
    if (archiveDeclaredBytes > MAX_ARCHIVE_EXPANDED_BYTES) {
      throw new BookEpubImportError("The expanded EPUB is too large to open safely.");
    }
    if (originalSize > 16 * 1024 * 1024 && (compressedSize === 0 || originalSize / compressedSize > MAX_SUSPICIOUS_COMPRESSION_RATIO)) {
      throw new BookEpubImportError(`“${basename(name)}” has a suspicious compression ratio.`);
    }
    offset += recordLength;
  }
}

async function feedArchive(unzipper: Unzip, file: Blob, shouldContinue: () => boolean) {
  if (typeof file.stream === "function") {
    const reader = file.stream().getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!shouldContinue()) {
        await reader.cancel();
        return;
      }
      unzipper.push(value, false);
    }
    if (shouldContinue()) unzipper.push(new Uint8Array(), true);
    return;
  }
  if (shouldContinue()) unzipper.push(new Uint8Array(await readBlobBytes(file)), true);
}

async function readSelectedEntries(
  file: Blob,
  shouldRead: (path: string) => boolean,
  limits: { maxEntryBytes: number; maxTotalBytes: number },
): Promise<ArchiveIndex> {
  if (file.size > MAX_EPUB_BYTES) throw new BookEpubImportError("EPUB book imports are limited to 200 MB.");

  try {
    return await new Promise<ArchiveIndex>((resolve, reject) => {
      const aliases = new Map<string, string>();
      const entries = new Map<string, BufferedEntry>();
      const seenPaths = new Set<string>();
      const activeFiles = new Set<UnzipFile>();
      let archiveComplete = false;
      let archiveEntries = 0;
      let archiveDeclaredBytes = 0;
      let selectedDeclaredBytes = 0;
      let extractedBytes = 0;
      let settled = false;

      function finishIfReady() {
        if (!settled && archiveComplete && activeFiles.size === 0) {
          settled = true;
          resolve({ aliases, entries });
        }
      }

      function fail(error: Error) {
        if (settled) return;
        settled = true;
        for (const activeFile of activeFiles) activeFile.terminate();
        reject(error);
      }

      const unzipper = new Unzip((entry) => {
        if (settled) return;
        archiveEntries += 1;
        if (archiveEntries > MAX_EPUB_ENTRIES) {
          fail(new BookEpubImportError("This EPUB contains too many files to open safely."));
          return;
        }
        if (entry.name.endsWith("/")) return;

        const aliasesForEntry = archiveEntryAliases(entry.name);
        if (!aliasesForEntry) {
          fail(new BookEpubImportError("This EPUB contains an unsafe archive entry path."));
          return;
        }
        const canonicalPath = aliasesForEntry[0];
        if (seenPaths.has(canonicalPath)) {
          fail(new BookEpubImportError(`The EPUB contains more than one entry named “${basename(canonicalPath)}”.`));
          return;
        }
        seenPaths.add(canonicalPath);
        for (const alias of aliasesForEntry) {
          const existing = aliases.get(alias);
          if (existing && existing !== canonicalPath) {
            fail(new BookEpubImportError("The EPUB contains ambiguous encoded archive paths."));
            return;
          }
          aliases.set(alias, canonicalPath);
        }

        if (entry.originalSize !== undefined) {
          archiveDeclaredBytes += entry.originalSize;
          if (entry.originalSize > MAX_ARCHIVE_ENTRY_BYTES) {
            fail(new BookEpubImportError(`“${basename(canonicalPath)}” is too large to open safely.`));
            return;
          }
          if (archiveDeclaredBytes > MAX_ARCHIVE_EXPANDED_BYTES) {
            fail(new BookEpubImportError("The expanded EPUB is too large to open safely."));
            return;
          }
          if (entry.size && entry.originalSize > 16 * 1024 * 1024 && entry.originalSize / entry.size > MAX_SUSPICIOUS_COMPRESSION_RATIO) {
            fail(new BookEpubImportError(`“${basename(canonicalPath)}” has a suspicious compression ratio.`));
            return;
          }
        }
        if (isIgnoredArchivePath(canonicalPath) || !shouldRead(canonicalPath)) return;

        if (entry.originalSize !== undefined) {
          selectedDeclaredBytes += entry.originalSize;
          if (entry.originalSize > limits.maxEntryBytes) {
            fail(new BookEpubImportError(`“${basename(canonicalPath)}” is too large to import safely.`));
            return;
          }
          if (selectedDeclaredBytes > limits.maxTotalBytes) {
            fail(new BookEpubImportError("The expanded EPUB is too large to import safely."));
            return;
          }
        }

        const chunks: ArrayBuffer[] = [];
        let entryBytes = 0;
        activeFiles.add(entry);
        entry.ondata = (error, chunk, final) => {
          if (settled) return;
          if (error) {
            fail(error);
            return;
          }
          entryBytes += chunk.byteLength;
          extractedBytes += chunk.byteLength;
          if (entryBytes > limits.maxEntryBytes) {
            fail(new BookEpubImportError(`“${basename(canonicalPath)}” is too large to import safely.`));
            return;
          }
          if (extractedBytes > limits.maxTotalBytes) {
            fail(new BookEpubImportError("The expanded EPUB is too large to import safely."));
            return;
          }
          if (chunk.byteLength) {
            const copy = new Uint8Array(chunk.byteLength);
            copy.set(chunk);
            chunks.push(copy.buffer);
          }
          if (final) {
            activeFiles.delete(entry);
            entries.set(canonicalPath, { chunks, path: canonicalPath, size: entryBytes });
            finishIfReady();
          }
        };
        try {
          entry.start();
        } catch (error) {
          fail(error instanceof Error ? error : new Error("Unsupported EPUB compression."));
        }
      });
      unzipper.register(AsyncUnzipInflate);

      void feedArchive(unzipper, file, () => !settled).then(() => {
        archiveComplete = true;
        finishIfReady();
      }).catch((error: unknown) => fail(error instanceof Error ? error : new Error("The EPUB could not be read.")));
    });
  } catch (error) {
    if (error instanceof BookEpubImportError) throw error;
    throw new BookEpubImportError("This EPUB is damaged or uses an unsupported compression format.");
  }
}

function bytesFromEntry(entry: BufferedEntry) {
  const bytes = new Uint8Array(entry.size);
  let offset = 0;
  for (const chunk of entry.chunks) {
    const view = new Uint8Array(chunk);
    bytes.set(view, offset);
    offset += view.byteLength;
  }
  return bytes;
}

function decodeMarkup(entry: BufferedEntry) {
  const bytes = bytesFromEntry(entry);
  const isUtf16LittleEndian = (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0x3c && bytes[1] === 0x00);
  const isUtf16BigEndian = (bytes[0] === 0xfe && bytes[1] === 0xff) || (bytes[0] === 0x00 && bytes[1] === 0x3c);
  if (isUtf16LittleEndian) return new TextDecoder("utf-16le").decode(bytes);
  if (isUtf16BigEndian) return new TextDecoder("utf-16be").decode(bytes);
  return new TextDecoder().decode(bytes);
}

function elementsByLocalName(root: Document | Element, name: string) {
  return Array.from(root.getElementsByTagName("*")).filter((element) => element.localName.toLocaleLowerCase() === name);
}

function stripDocumentType(source: string, label: string) {
  if (/<!ENTITY\b/iu.test(source) || /<!DOCTYPE[^>]*\[/iu.test(source)) {
    throw new BookEpubImportError(`The EPUB ${label} contains an unsupported entity declaration.`);
  }
  const stripped = source.replace(/<!DOCTYPE(?:[^>"']|"[^"]*"|'[^']*')*>/giu, "");
  if (/<!DOCTYPE\b/iu.test(stripped)) {
    throw new BookEpubImportError(`The EPUB ${label} contains a malformed document type declaration.`);
  }
  return stripped;
}

function assertNoActiveContent(document: Document, label: string) {
  if (elementsByLocalName(document, "script").length) {
    throw new BookEpubImportError(`The EPUB ${label} contains scripts, which are not supported.`);
  }
  for (const element of Array.from(document.getElementsByTagName("*"))) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLocaleLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on") || /^(?:javascript|vbscript):/iu.test(safelyDecodePath(value))) {
        throw new BookEpubImportError(`The EPUB ${label} contains executable content, which is not supported.`);
      }
    }
  }
}

function parseXml(entry: BufferedEntry, label: string) {
  const source = stripDocumentType(decodeMarkup(entry), label);
  const document = new DOMParser().parseFromString(source, "application/xml");
  if (elementsByLocalName(document, "parsererror").length) {
    throw new BookEpubImportError(`The EPUB ${label} is not valid XML.`);
  }
  assertNoActiveContent(document, label);
  return document;
}

function escapeMarkupAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function neutralizeHtmlResourceAttributes(source: string) {
  const withoutImports = source.replace(/@import\s+(?:url\([^)]*\)|["'][^"']*["'])\s*;?/giu, "");
  return withoutImports.replace(
    /\s(src|srcset|href|poster|data|action|formaction)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/giu,
    (_match, rawName: string, doubleQuoted: string | undefined, singleQuoted: string | undefined, unquoted: string | undefined) => {
      const name = rawName.toLocaleLowerCase();
      const value = doubleQuoted ?? singleQuoted ?? unquoted ?? "";
      return ` data-epub-original-${name}="${escapeMarkupAttribute(value)}"`;
    },
  );
}

function parseContentDocument(entry: BufferedEntry, mediaType: string) {
  const label = `chapter “${basename(entry.path)}”`;
  const source = stripDocumentType(decodeMarkup(entry), label);
  if (/<script\b/iu.test(source)) {
    throw new BookEpubImportError(`The EPUB ${label} contains scripts, which are not supported.`);
  }
  const xmlDocument = new DOMParser().parseFromString(source, "application/xml");
  if (!elementsByLocalName(xmlDocument, "parsererror").length) {
    assertNoActiveContent(xmlDocument, label);
    return xmlDocument;
  }
  if (mediaType !== "text/html" && !["htm", "html"].includes(extension(entry.path))) {
    throw new BookEpubImportError(`The EPUB ${label} is not valid XHTML.`);
  }
  const htmlDocument = new DOMParser().parseFromString(neutralizeHtmlResourceAttributes(source), "text/html");
  assertNoActiveContent(htmlDocument, label);
  return htmlDocument;
}

function canonicalPath(index: ArchiveIndex, path: string | null) {
  return path ? index.aliases.get(path) ?? null : null;
}

function entryAt(index: ArchiveIndex, path: string | null) {
  const canonical = canonicalPath(index, path);
  return canonical ? index.entries.get(canonical) ?? null : null;
}

function mediaTypeForPath(path: string, declaredMediaType = "") {
  const normalized = declaredMediaType.trim().toLocaleLowerCase();
  if (SAFE_IMAGE_TYPES.has(normalized)) return normalized;
  const fileExtension = extension(path);
  if (fileExtension === "jpg" || fileExtension === "jpeg") return "image/jpeg";
  if (fileExtension === "png") return "image/png";
  if (fileExtension === "webp") return "image/webp";
  if (fileExtension === "gif") return "image/gif";
  if (fileExtension === "avif") return "image/avif";
  return "application/octet-stream";
}

function isSafeImage(path: string, mediaType: string) {
  return SAFE_IMAGE_TYPES.has(mediaType) || SAFE_IMAGE_EXTENSIONS.has(extension(path));
}

function isContentDocument(path: string, mediaType: string) {
  return CONTENT_DOCUMENT_TYPES.has(mediaType) || ["htm", "html", "svg", "xhtml"].includes(extension(path));
}

function normalizedText(value: string) {
  return value
    .replace(/\r/gu, "")
    .replace(/[\t\f\v ]+/gu, " ")
    .replace(/ *\n */gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function originalAttribute(element: Element, name: string) {
  return element.getAttribute(name) ?? element.getAttribute(`data-epub-original-${name}`);
}

function imageReference(element: Element) {
  if (element.localName.toLocaleLowerCase() === "image") {
    return originalAttribute(element, "href")
      ?? element.getAttributeNS("http://www.w3.org/1999/xlink", "href")
      ?? element.getAttribute("xlink:href")
      ?? "";
  }
  return originalAttribute(element, "src") ?? "";
}

function imageBlock(
  element: Element,
  chapterPath: string,
  archive: ArchiveIndex,
  manifestByPath: Map<string, ManifestItem>,
): Extract<EpubContentBlock, { type: "image" }> | null {
  const reference = imageReference(element);
  if (!reference) return null;
  const resolvedPath = resolveArchiveReference(chapterPath, reference, `chapter image in “${basename(chapterPath)}”`);
  const path = canonicalPath(archive, resolvedPath);
  if (!path) return null;
  const mediaType = mediaTypeForPath(path, manifestByPath.get(path)?.mediaType);
  if (!isSafeImage(path, mediaType)) return null;
  return {
    alt: normalizedText(element.getAttribute("alt") ?? element.getAttribute("aria-label") ?? ""),
    mediaType,
    path,
    type: "image",
  };
}

function chapterBlocks(
  document: Document,
  chapterPath: string,
  archive: ArchiveIndex,
  manifestByPath: Map<string, ManifestItem>,
) {
  const blocks: EpubContentBlock[] = [];
  let pendingText = "";

  function appendBreak() {
    if (pendingText && !pendingText.endsWith("\n")) pendingText += "\n";
  }

  function flushText() {
    const text = normalizedText(pendingText);
    if (text) blocks.push({ text, type: "text" });
    pendingText = "";
  }

  function visit(node: Node) {
    if (node.nodeType === 3) {
      pendingText += node.nodeValue ?? "";
      return;
    }
    if (node.nodeType !== 1) return;
    const element = node as Element;
    const name = element.localName.toLocaleLowerCase();
    if (IGNORED_CONTENT_ELEMENTS.has(name)) return;
    if (name === "img" || name === "image") {
      flushText();
      const block = imageBlock(element, chapterPath, archive, manifestByPath);
      if (block) blocks.push(block);
      return;
    }
    if (name === "br") {
      appendBreak();
      return;
    }
    const isBlock = BLOCK_ELEMENTS.has(name);
    if (isBlock) appendBreak();
    for (const child of Array.from(element.childNodes)) visit(child);
    if (isBlock) appendBreak();
  }

  const root = document.body ?? document.documentElement;
  if (root) visit(root);
  flushText();
  return blocks;
}

function writingModeValue(value: string): EpubWritingMode | null {
  const normalized = value.trim().toLocaleLowerCase();
  if (normalized === "vertical-rl" || normalized === "tb-rl") return "vertical-rl";
  if (normalized === "vertical-lr" || normalized === "tb-lr") return "vertical-lr";
  if (["horizontal-tb", "lr-tb", "rl-tb"].includes(normalized)) return "horizontal-tb";
  return null;
}

function writingModeFromDeclarations(declarations: string) {
  const match = declarations.match(/(?:^|[;{])\s*(?:-(?:epub|webkit)-)?writing-mode\s*:\s*([a-z-]+)/iu);
  return match ? writingModeValue(match[1]) : null;
}

function writingModeFromCss(source: string, rootOnly: boolean) {
  if (!rootOnly) return writingModeFromDeclarations(source);
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/gu)) {
    const selectors = match[1].split(",").map((selector) => selector.trim().toLocaleLowerCase());
    if (!selectors.some((selector) => /^(?::root|html|body)(?:\b|[.#[:])/u.test(selector))) continue;
    const mode = writingModeFromDeclarations(match[2]);
    if (mode) return mode;
  }
  return null;
}

function linkedStyleSources(document: Document, chapterPath: string, archive: ArchiveIndex) {
  const sources: string[] = [];
  for (const style of elementsByLocalName(document, "style")) sources.push(style.textContent ?? "");
  for (const link of elementsByLocalName(document, "link")) {
    const relations = (link.getAttribute("rel") ?? "").toLocaleLowerCase().split(/\s+/u);
    if (!relations.includes("stylesheet")) continue;
    const reference = originalAttribute(link, "href") ?? "";
    const path = resolveArchiveReference(chapterPath, reference, `chapter stylesheet in “${basename(chapterPath)}”`);
    const entry = entryAt(archive, path);
    if (entry) sources.push(decodeMarkup(entry));
  }
  return sources;
}

function chapterWritingMode(document: Document, chapterPath: string, archive: ArchiveIndex) {
  const rootStyle = document.documentElement?.getAttribute("style") ?? "";
  const body = elementsByLocalName(document, "body")[0];
  const bodyStyle = body?.getAttribute("style") ?? "";
  const inlineMode = writingModeFromDeclarations(rootStyle) ?? writingModeFromDeclarations(bodyStyle);
  if (inlineMode) return inlineMode;
  const sources = linkedStyleSources(document, chapterPath, archive);
  for (const source of sources) {
    const mode = writingModeFromCss(source, true);
    if (mode) return mode;
  }
  for (const source of sources) {
    const mode = writingModeFromCss(source, false);
    if (mode) return mode;
  }
  return null;
}

function chapterTitle(document: Document) {
  const title = elementsByLocalName(document, "title")[0]?.textContent
    ?? ["h1", "h2", "h3"].flatMap((name) => elementsByLocalName(document, name))[0]?.textContent
    ?? "";
  return normalizedText(title) || null;
}

function pageProgressionDirection(spine: Element): EpubPageProgressionDirection | null {
  const direction = spine.getAttribute("page-progression-direction")?.trim().toLocaleLowerCase();
  return direction === "ltr" || direction === "rtl" ? direction : null;
}

function manifestItemForSpine(id: string, manifest: Map<string, ManifestItem>) {
  let item = manifest.get(id) ?? null;
  const visited = new Set<string>();
  while (item && !item.path && item.fallbackId && !visited.has(item.id)) {
    visited.add(item.id);
    item = manifest.get(item.fallbackId) ?? null;
  }
  return item;
}

function coverImagePath(
  item: ManifestItem | undefined,
  archive: ArchiveIndex,
  manifestByPath: Map<string, ManifestItem>,
) {
  if (!item?.path) return null;
  const directMediaType = mediaTypeForPath(item.path, item.mediaType);
  if (isSafeImage(item.path, directMediaType)) return item.path;
  if (!isContentDocument(item.path, item.mediaType)) return null;
  const wrapperEntry = entryAt(archive, item.path);
  if (!wrapperEntry) return null;
  const wrapperDocument = parseContentDocument(wrapperEntry, item.mediaType);
  for (const element of Array.from(wrapperDocument.getElementsByTagName("*"))) {
    const name = element.localName.toLocaleLowerCase();
    if (name !== "img" && name !== "image") continue;
    const block = imageBlock(element, item.path, archive, manifestByPath);
    if (block) return block.path;
  }
  return null;
}

function fallbackTitle(file: Blob) {
  const name = "name" in file && typeof file.name === "string" ? file.name : "";
  return name.replace(/\.epub$/iu, "").trim() || "Untitled book";
}

export async function extractBookEpub(file: Blob): Promise<ExtractedBookEpub> {
  await validateArchiveDeclarations(file);
  const metadata = await readSelectedEntries(
    file,
    (path) => MARKUP_EXTENSIONS.has(extension(path)),
    { maxEntryBytes: MAX_MARKUP_ENTRY_BYTES, maxTotalBytes: MAX_MARKUP_BYTES },
  );

  const containerPath = [...metadata.aliases.keys()].find((path) => path.toLocaleLowerCase() === "meta-inf/container.xml") ?? null;
  const containerEntry = entryAt(metadata, containerPath);
  if (!containerEntry) throw new BookEpubImportError("The EPUB container manifest is missing.");
  const containerDocument = parseXml(containerEntry, "container manifest");
  const packageReference = elementsByLocalName(containerDocument, "rootfile")[0]?.getAttribute("full-path") ?? "";
  const packagePath = resolveArchiveReference("", packageReference, "package reference");
  const canonicalPackagePath = canonicalPath(metadata, packagePath);
  const packageEntry = entryAt(metadata, packagePath);
  if (!canonicalPackagePath || !packageEntry) throw new BookEpubImportError("The EPUB package document is missing.");

  const packageDocument = parseXml(packageEntry, "package document");
  const metadataElement = elementsByLocalName(packageDocument, "metadata")[0];
  const title = normalizedText(metadataElement ? elementsByLocalName(metadataElement, "title")[0]?.textContent ?? "" : "") || fallbackTitle(file);
  const language = normalizedText(metadataElement ? elementsByLocalName(metadataElement, "language")[0]?.textContent ?? "" : "") || null;

  const manifest = new Map<string, ManifestItem>();
  const manifestByPath = new Map<string, ManifestItem>();
  for (const element of elementsByLocalName(packageDocument, "item")) {
    const id = element.getAttribute("id")?.trim() ?? "";
    if (!id) continue;
    const resolvedPath = resolveArchiveReference(canonicalPackagePath, element.getAttribute("href") ?? "", `manifest item “${id}”`);
    const path = canonicalPath(metadata, resolvedPath) ?? resolvedPath;
    const item: ManifestItem = {
      fallbackId: element.getAttribute("fallback")?.trim() || null,
      id,
      mediaType: element.getAttribute("media-type")?.trim().toLocaleLowerCase() ?? "",
      path,
      properties: new Set((element.getAttribute("properties") ?? "").trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean)),
    };
    manifest.set(id, item);
    if (path) manifestByPath.set(path, item);
  }

  const spine = elementsByLocalName(packageDocument, "spine")[0];
  if (!spine) throw new BookEpubImportError("The EPUB reading order is missing.");
  const itemReferences = elementsByLocalName(spine, "itemref");
  if (!itemReferences.length) throw new BookEpubImportError("The EPUB reading order is empty.");
  if (itemReferences.length > MAX_SPINE_ITEMS) throw new BookEpubImportError("This EPUB contains too many chapters to open safely.");

  const chapters: EpubChapterSummary[] = [];
  for (const itemReference of itemReferences) {
    const itemId = itemReference.getAttribute("idref")?.trim() ?? "";
    const item = manifestItemForSpine(itemId, manifest);
    if (!item?.path || !isContentDocument(item.path, item.mediaType)) continue;
    const chapterEntry = entryAt(metadata, item.path);
    if (!chapterEntry) throw new BookEpubImportError(`The EPUB chapter “${basename(item.path)}” is missing.`);
    const document = parseContentDocument(chapterEntry, item.mediaType);
    const blocks = chapterBlocks(document, item.path, metadata, manifestByPath);
    chapters.push({
      blocks,
      path: item.path,
      text: blocks.flatMap((block) => block.type === "text" ? [block.text] : []).join("\n\n"),
      title: chapterTitle(document),
      writingMode: chapterWritingMode(document, item.path, metadata),
    });
  }
  if (!chapters.length) throw new BookEpubImportError("No readable chapters were found in this EPUB.");

  const epub3Cover = [...manifest.values()].find((item) => item.properties.has("cover-image"));
  const epub2CoverId = metadataElement
    ? elementsByLocalName(metadataElement, "meta").find((element) => element.getAttribute("name")?.trim().toLocaleLowerCase() === "cover")?.getAttribute("content")?.trim()
    : null;
  const coverItem = epub3Cover ?? (epub2CoverId ? manifest.get(epub2CoverId) : undefined);
  const coverPath = coverImagePath(coverItem, metadata, manifestByPath);
  const coverEntries = coverPath
    ? await readSelectedEntries(
      file,
      (path) => path === coverPath,
      { maxEntryBytes: MAX_COVER_BYTES, maxTotalBytes: MAX_COVER_BYTES },
    )
    : null;
  const coverEntry = coverEntries && coverPath ? entryAt(coverEntries, coverPath) : null;
  const cover = coverEntry && coverPath
    ? new Blob(coverEntry.chunks, { type: mediaTypeForPath(coverPath, manifestByPath.get(coverPath)?.mediaType) })
    : undefined;

  const result: ExtractedBookEpub = {
    chapters,
    language,
    pageProgressionDirection: pageProgressionDirection(spine),
    text: chapters.map((chapter) => chapter.text).filter(Boolean).join("\n\n"),
    title,
  };
  if (cover && coverPath) {
    result.cover = cover;
    result.coverPath = coverPath;
  }
  return result;
}
