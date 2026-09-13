import { AsyncUnzipInflate, Unzip, type UnzipFile } from "fflate";
import type { MangaPagePlacement, MangaReadingDirection } from "./manga-pagination";

const RASTER_IMAGE_EXTENSIONS = new Set(["avif", "gif", "jpeg", "jpg", "png", "webp"]);
const RASTER_IMAGE_TYPES = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);
const MARKUP_EXTENSIONS = new Set(["htm", "html", "opf", "svg", "xhtml", "xml"]);
const CONTENT_DOCUMENT_TYPES = new Set(["application/xhtml+xml", "image/svg+xml", "text/html"]);
const MAX_EPUB_BYTES = 350 * 1024 * 1024;
const MAX_EPUB_ENTRIES = 10_000;
const MAX_METADATA_ENTRY_BYTES = 4 * 1024 * 1024;
const MAX_METADATA_BYTES = 32 * 1024 * 1024;
const MAX_PAGE_BYTES = 40 * 1024 * 1024;
const MAX_PAGE_BYTES_TOTAL = 500 * 1024 * 1024;
const MAX_SUSPICIOUS_COMPRESSION_RATIO = 250;
const MAX_EPUB_PAGES = 1_000;
const XML_ENCRYPTION_NAMESPACE = "http://www.w3.org/2001/04/xmlenc#";

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
  fallback?: string;
  id: string;
  mediaType: string;
  path: string | null;
}

export interface MangaEpubPage {
  chunks: ArrayBuffer[];
  mediaType: string;
  path: string;
  placement: MangaPagePlacement;
}

export interface ExtractedMangaEpub {
  pages: MangaEpubPage[];
  readingDirection: MangaReadingDirection | null;
  title: string;
}

class MangaEpubImportError extends Error {}

function extension(fileName: string) {
  return fileName.toLocaleLowerCase().match(/\.([a-z0-9]+)$/u)?.[1] ?? "";
}

function basename(path: string) {
  return path.replaceAll("\\", "/").split("/").at(-1) ?? path;
}

function isIgnoredArchivePath(path: string) {
  const normalized = path.replaceAll("\\", "/");
  const name = basename(normalized);
  return normalized.startsWith("__MACOSX/") || name.startsWith("._") || name === ".DS_Store";
}

function normalizeArchivePath(value: string) {
  const normalized = value.replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || normalized.startsWith("//")) return null;
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
  return output.join("/");
}

function safelyDecodePath(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function resolveArchiveReference(baseFilePath: string, reference: string) {
  const trimmed = reference.trim();
  if (!trimmed || trimmed.startsWith("/") || trimmed.startsWith("//") || /^[a-z][a-z0-9+.-]*:/iu.test(trimmed)) return null;
  const pathOnly = trimmed.split(/[?#]/u, 1)[0];
  if (!pathOnly) return null;
  const decoded = safelyDecodePath(pathOnly);
  const baseDirectory = baseFilePath.split("/").slice(0, -1).join("/");
  return normalizeArchivePath(baseDirectory ? `${baseDirectory}/${decoded}` : decoded);
}

function entryAliases(path: string) {
  const raw = normalizeArchivePath(path);
  if (!raw) return [];
  const decoded = normalizeArchivePath(safelyDecodePath(raw));
  return decoded && decoded !== raw ? [raw, decoded] : [raw];
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

async function feedArchive(unzipper: Unzip, file: File, shouldContinue: () => boolean) {
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
    if (!shouldContinue()) return;
    unzipper.push(new Uint8Array(), true);
    return;
  }
  if (!shouldContinue()) return;
  unzipper.push(new Uint8Array(await readBlobBytes(file)), true);
}

async function readSelectedEntries(
  file: File,
  shouldRead: (path: string) => boolean,
  limits: { maxEntryBytes: number; maxTotalBytes: number },
): Promise<ArchiveIndex> {
  if (file.size > MAX_EPUB_BYTES) throw new MangaEpubImportError("EPUB manga imports are limited to 350 MB.");

  try {
    return await new Promise<ArchiveIndex>((resolve, reject) => {
      const aliases = new Map<string, string>();
      const entries = new Map<string, BufferedEntry>();
      const activeFiles = new Set<UnzipFile>();
      let archiveComplete = false;
      let archiveEntries = 0;
      let declaredBytes = 0;
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
        archiveEntries += 1;
        if (archiveEntries > MAX_EPUB_ENTRIES) {
          fail(new MangaEpubImportError("This EPUB contains too many files to open safely."));
          return;
        }

        const aliasesForEntry = entryAliases(entry.name);
        const canonicalPath = aliasesForEntry[0];
        if (!canonicalPath || isIgnoredArchivePath(canonicalPath)) return;
        for (const alias of aliasesForEntry) {
          if (!aliases.has(alias)) aliases.set(alias, canonicalPath);
        }
        if (!shouldRead(canonicalPath)) return;

        if (entry.originalSize !== undefined) {
          declaredBytes += entry.originalSize;
          if (entry.originalSize > limits.maxEntryBytes) {
            fail(new MangaEpubImportError(`“${basename(entry.name)}” is too large to import safely.`));
            return;
          }
          if (declaredBytes > limits.maxTotalBytes) {
            fail(new MangaEpubImportError("The expanded EPUB is too large to import safely."));
            return;
          }
          if (entry.size && entry.originalSize > 16 * 1024 * 1024 && entry.originalSize / entry.size > MAX_SUSPICIOUS_COMPRESSION_RATIO) {
            fail(new MangaEpubImportError(`“${basename(entry.name)}” has a suspicious compression ratio.`));
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
            fail(new MangaEpubImportError(`“${basename(entry.name)}” is too large to import safely.`));
            return;
          }
          if (extractedBytes > limits.maxTotalBytes) {
            fail(new MangaEpubImportError("The expanded EPUB is too large to import safely."));
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
    if (error instanceof MangaEpubImportError) throw error;
    throw new MangaEpubImportError("This EPUB is damaged or uses an unsupported compression format.");
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

function parseXml(entry: BufferedEntry, label: string) {
  const source = decodeMarkup(entry);
  if (/<!DOCTYPE\b/iu.test(source)) throw new MangaEpubImportError(`The EPUB ${label} contains an unsupported document type declaration.`);
  const document = new DOMParser().parseFromString(source, "application/xml");
  if (elementsByLocalName(document, "parsererror").length) {
    throw new MangaEpubImportError(`The EPUB ${label} is not valid XML.`);
  }
  return document;
}

function parseContentDocument(entry: BufferedEntry, mediaType: string) {
  const source = decodeMarkup(entry);
  if (mediaType === "text/html" || ["htm", "html"].includes(extension(entry.path))) {
    return new DOMParser().parseFromString(source, "text/html");
  }
  const xmlDocument = new DOMParser().parseFromString(source, "application/xml");
  if (!elementsByLocalName(xmlDocument, "parsererror").length) return xmlDocument;
  return new DOMParser().parseFromString(source, "text/html");
}

function canonicalPath(index: ArchiveIndex, path: string | null) {
  return path ? index.aliases.get(path) ?? null : null;
}

function entryAt(index: ArchiveIndex, path: string | null) {
  const canonical = canonicalPath(index, path);
  return canonical ? index.entries.get(canonical) ?? null : null;
}

function mediaTypeForPath(path: string, manifestByPath: Map<string, ManifestItem>) {
  const declared = manifestByPath.get(path)?.mediaType;
  if (declared) return declared;
  const fileExtension = extension(path);
  if (fileExtension === "jpg" || fileExtension === "jpeg") return "image/jpeg";
  if (fileExtension === "png") return "image/png";
  if (fileExtension === "webp") return "image/webp";
  if (fileExtension === "gif") return "image/gif";
  if (fileExtension === "avif") return "image/avif";
  return "application/octet-stream";
}

function isRasterImage(path: string, mediaType: string) {
  return RASTER_IMAGE_EXTENSIONS.has(extension(path)) || RASTER_IMAGE_TYPES.has(mediaType);
}

function isContentDocument(path: string, mediaType: string) {
  return CONTENT_DOCUMENT_TYPES.has(mediaType) || ["htm", "html", "svg", "xhtml"].includes(extension(path));
}

function spineReadingDirection(spine: Element): MangaReadingDirection | null {
  const value = spine.getAttribute("page-progression-direction")?.trim().toLocaleLowerCase();
  return value === "ltr" || value === "rtl" ? value : null;
}

function spinePagePlacement(itemReference: Element): MangaPagePlacement {
  const properties = new Set(
    (itemReference.getAttribute("properties") ?? "")
      .trim()
      .split(/\s+/u)
      .map((property) => property.toLocaleLowerCase())
      .filter(Boolean),
  );
  if (properties.has("rendition:page-spread-center") || properties.has("page-spread-center")) return "center";
  if (properties.has("rendition:page-spread-left") || properties.has("page-spread-left")) return "left";
  if (properties.has("rendition:page-spread-right") || properties.has("page-spread-right")) return "right";
  return null;
}

function encryptedPaths(metadata: ArchiveIndex) {
  const encryptionEntry = entryAt(metadata, "META-INF/encryption.xml");
  if (!encryptionEntry) return new Set<string>();
  const document = parseXml(encryptionEntry, "encryption manifest");
  const encrypted = new Set<string>();
  const references = [
    ...Array.from(document.getElementsByTagNameNS(XML_ENCRYPTION_NAMESPACE, "CipherReference")),
    ...elementsByLocalName(document, "cipherreference"),
  ];
  for (const reference of references) {
    const path = resolveArchiveReference("", reference.getAttribute("URI") ?? reference.getAttribute("uri") ?? "");
    const canonical = canonicalPath(metadata, path);
    if (canonical) encrypted.add(canonical);
  }
  return encrypted;
}

function pageReferences(document: Document, documentPath: string) {
  const references: string[] = [];
  for (const element of Array.from(document.getElementsByTagName("*"))) {
    const name = element.localName.toLocaleLowerCase();
    let reference = "";
    if (name === "img") {
      reference = element.getAttribute("src") ?? "";
      if (!reference) {
        const srcset = element.getAttribute("srcset") ?? "";
        reference = srcset.split(",").at(-1)?.trim().split(/\s+/u)[0] ?? "";
      }
    } else if (name === "image") {
      reference = element.getAttribute("href")
        ?? element.getAttributeNS("http://www.w3.org/1999/xlink", "href")
        ?? element.getAttribute("xlink:href")
        ?? "";
    } else if (name === "object") {
      reference = element.getAttribute("data") ?? "";
    }
    if (!reference) continue;
    const path = resolveArchiveReference(documentPath, reference);
    if (path) references.push(path);
  }
  return references;
}

function hasReadableText(document: Document) {
  return (document.body?.textContent ?? document.documentElement?.textContent ?? "").replace(/\s+/gu, " ").trim().length >= 20;
}

function unsupportedPageError() {
  return new MangaEpubImportError("This EPUB does not use one supported raster image per manga page. Convert it to CBZ or PDF first.");
}

export async function extractMangaEpub(file: File): Promise<ExtractedMangaEpub> {
  const metadata = await readSelectedEntries(
    file,
    (path) => MARKUP_EXTENSIONS.has(extension(path)),
    { maxEntryBytes: MAX_METADATA_ENTRY_BYTES, maxTotalBytes: MAX_METADATA_BYTES },
  );

  const containerPath = [...metadata.aliases.keys()].find((path) => path.toLocaleLowerCase() === "meta-inf/container.xml") ?? null;
  const containerEntry = entryAt(metadata, containerPath);
  if (!containerEntry) throw new MangaEpubImportError("The EPUB container manifest is missing.");
  const containerDocument = parseXml(containerEntry, "container manifest");
  const rootFile = elementsByLocalName(containerDocument, "rootfile")[0];
  const packageReference = rootFile?.getAttribute("full-path") ?? "";
  const packagePath = resolveArchiveReference("", packageReference);
  const canonicalPackagePath = canonicalPath(metadata, packagePath);
  const packageEntry = entryAt(metadata, packagePath);
  if (!packageEntry || !canonicalPackagePath) throw new MangaEpubImportError("The EPUB package document is missing.");

  const packageDocument = parseXml(packageEntry, "package document");
  const title = elementsByLocalName(packageDocument, "title")[0]?.textContent?.replace(/\s+/gu, " ").trim() || file.name.replace(/\.epub$/iu, "") || "Untitled manga";
  const manifest = new Map<string, ManifestItem>();
  const manifestByPath = new Map<string, ManifestItem>();
  for (const element of elementsByLocalName(packageDocument, "item")) {
    const id = element.getAttribute("id")?.trim() ?? "";
    if (!id) continue;
    const resolvedPath = resolveArchiveReference(canonicalPackagePath, element.getAttribute("href") ?? "");
    const canonical = canonicalPath(metadata, resolvedPath) ?? resolvedPath;
    const item: ManifestItem = {
      fallback: element.getAttribute("fallback")?.trim() || undefined,
      id,
      mediaType: element.getAttribute("media-type")?.trim().toLocaleLowerCase() ?? "",
      path: canonical,
    };
    manifest.set(id, item);
    if (canonical) manifestByPath.set(canonical, item);
  }

  const spine = elementsByLocalName(packageDocument, "spine")[0];
  if (!spine) throw new MangaEpubImportError("The EPUB reading order is missing.");
  const itemReferences = elementsByLocalName(spine, "itemref");
  if (!itemReferences.length) throw new MangaEpubImportError("The EPUB reading order is empty.");
  const readingDirection = spineReadingDirection(spine);

  const encrypted = encryptedPaths(metadata);
  const orderedPages: Array<{ mediaType: string; path: string; placement: MangaPagePlacement }> = [];
  let foundTextChapter = false;

  for (const itemReference of itemReferences) {
    const linear = itemReference.getAttribute("linear")?.toLocaleLowerCase() !== "no";
    if (!linear) continue;
    const placement = spinePagePlacement(itemReference);
    let itemId = itemReference.getAttribute("idref")?.trim() ?? "";
    const visited = new Set<string>();
    let page: { mediaType: string; path: string } | null = null;

    while (itemId && !visited.has(itemId)) {
      visited.add(itemId);
      const item = manifest.get(itemId);
      if (!item?.path) break;
      const itemPath = canonicalPath(metadata, item.path) ?? item.path;
      if (encrypted.has(itemPath)) {
        throw new MangaEpubImportError("This EPUB protects one or more manga pages with DRM or encryption, which cannot be imported.");
      }

      if (isRasterImage(itemPath, item.mediaType)) {
        const canonical = canonicalPath(metadata, itemPath);
        if (!canonical) throw new MangaEpubImportError(`The EPUB page “${basename(itemPath)}” is missing.`);
        page = { mediaType: mediaTypeForPath(canonical, manifestByPath), path: canonical };
        break;
      }

      if (isContentDocument(itemPath, item.mediaType)) {
        const contentEntry = entryAt(metadata, itemPath);
        if (!contentEntry) throw new MangaEpubImportError(`The EPUB page wrapper “${basename(itemPath)}” is missing.`);
        const contentDocument = parseContentDocument(contentEntry, item.mediaType);
        const referencedPaths = pageReferences(contentDocument, itemPath);
        const rasterPaths = [...new Set(referencedPaths.flatMap((referencedPath) => {
          const canonical = canonicalPath(metadata, referencedPath);
          if (!canonical) return [];
          const mediaType = mediaTypeForPath(canonical, manifestByPath);
          return isRasterImage(canonical, mediaType) ? [canonical] : [];
        }))];
        if (rasterPaths.length > 1) {
          throw new MangaEpubImportError("This EPUB composes a page from multiple images, which the manga reader cannot preserve yet. Convert it to CBZ or PDF first.");
        }
        if (rasterPaths.length === 1) {
          const imagePath = rasterPaths[0];
          if (encrypted.has(imagePath)) {
            throw new MangaEpubImportError("This EPUB protects one or more manga pages with DRM or encryption, which cannot be imported.");
          }
          page = { mediaType: mediaTypeForPath(imagePath, manifestByPath), path: imagePath };
          break;
        }
        if (hasReadableText(contentDocument)) foundTextChapter = true;
      }

      itemId = item.fallback ?? "";
    }

    if (page) {
      orderedPages.push({ ...page, placement });
    } else if (foundTextChapter) {
      throw new MangaEpubImportError("This EPUB contains text chapters rather than image pages. Import it in Books instead.");
    } else {
      throw unsupportedPageError();
    }
  }

  if (!orderedPages.length) {
    if (foundTextChapter) throw new MangaEpubImportError("This EPUB contains text chapters rather than image pages. Import it in Books instead.");
    throw unsupportedPageError();
  }
  if (orderedPages.length > MAX_EPUB_PAGES) throw new MangaEpubImportError(`EPUB manga imports are limited to ${MAX_EPUB_PAGES.toLocaleString()} pages.`);

  const selectedPaths = new Set(orderedPages.map((page) => page.path));
  const pageEntries = await readSelectedEntries(
    file,
    (path) => selectedPaths.has(path),
    { maxEntryBytes: MAX_PAGE_BYTES, maxTotalBytes: MAX_PAGE_BYTES_TOTAL },
  );
  const logicalPageBytes = orderedPages.reduce((total, page) => total + (entryAt(pageEntries, page.path)?.size ?? 0), 0);
  if (logicalPageBytes > MAX_PAGE_BYTES_TOTAL) throw new MangaEpubImportError("The expanded EPUB is too large to import safely.");
  const pages = orderedPages.map((page) => {
    const entry = entryAt(pageEntries, page.path);
    if (!entry) throw new MangaEpubImportError(`The EPUB page “${basename(page.path)}” could not be extracted.`);
    return { chunks: entry.chunks, mediaType: page.mediaType, path: page.path, placement: page.placement };
  });
  return { pages, readingDirection, title };
}
