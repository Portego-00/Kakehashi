import { AsyncUnzipInflate, Unzip, type UnzipFile } from "fflate";
import { extractMangaEpub } from "./manga-epub";
import {
  DEFAULT_MANGA_READING_DIRECTION,
  type MangaPagePlacement,
  type MangaReadingDirection,
} from "./manga-pagination";
import { getMangaPdfPageCount, MAX_MANGA_PDF_BYTES } from "./manga-pdf";

const IMAGE_EXTENSIONS = new Set(["avif", "gif", "jpeg", "jpg", "png", "webp"]);
const MAX_ARCHIVE_BYTES = 350 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 500 * 1024 * 1024;
const MAX_DIRECT_IMAGE_BYTES = 750 * 1024 * 1024;
const MAX_PAGE_BYTES = 40 * 1024 * 1024;
const MAX_SUSPICIOUS_COMPRESSION_RATIO = 250;
const MAX_IMAGE_EDGE = 12_000;
const MAX_IMAGE_PIXELS = 40_000_000;
const MAX_IMAGE_HEADER_BYTES = 2 * 1024 * 1024;
const IMAGE_MIME_EXTENSIONS = new Map([
  ["image/avif", "avif"],
  ["image/gif", "gif"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
export const MAX_MANGA_PAGES = 1_000;

export type MangaImportSource = "cbz" | "epub" | "images" | "pdf";

export interface MangaImportMetadata {
  pagePlacements: MangaPagePlacement[];
  readingDirection: MangaReadingDirection;
}

export interface PreparedMangaImport {
  title: string;
  fileName: string;
  sourceType: MangaImportSource;
  pageCount: number;
  assets: File[];
  metadata: MangaImportMetadata;
}

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

export function naturalMangaPageCompare(left: string, right: string) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

export function isMangaImage(file: Pick<File, "name" | "type">) {
  return IMAGE_EXTENSIONS.has(extension(file.name)) || IMAGE_MIME_EXTENSIONS.has(file.type.toLocaleLowerCase());
}

function supportedImageExtension(file: Pick<File, "name" | "type">) {
  const fileExtension = extension(file.name);
  return IMAGE_EXTENSIONS.has(fileExtension) ? fileExtension : IMAGE_MIME_EXTENSIONS.get(file.type.toLocaleLowerCase()) ?? "";
}

function isPdf(file: Pick<File, "name" | "type">) {
  return file.type === "application/pdf" || extension(file.name) === "pdf";
}

function isEpub(file: Pick<File, "name" | "type">) {
  return extension(file.name) === "epub" || file.type === "application/epub+zip";
}

function isArchive(file: Pick<File, "name" | "type">) {
  return ["cbz", "zip"].includes(extension(file.name))
    || file.type === "application/zip"
    || file.type === "application/vnd.comicbook+zip";
}

function imageMimeType(fileName: string) {
  const value = extension(fileName);
  if (value === "jpg" || value === "jpeg") return "image/jpeg";
  if (value === "png") return "image/png";
  if (value === "webp") return "image/webp";
  if (value === "avif") return "image/avif";
  if (value === "gif") return "image/gif";
  return "application/octet-stream";
}

export function mangaTitleFromFileName(fileName: string) {
  const withoutExtension = basename(fileName).replace(/\.[^.]+$/u, "");
  return withoutExtension.replace(/[_-]+/gu, " ").replace(/\s+/gu, " ").trim() || "Untitled manga";
}

function readBlobBytes(file: Blob) {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("The selected file could not be read."));
    reader.readAsArrayBuffer(file);
  });
}

function validatePageCount(pageCount: number) {
  if (pageCount < 1) throw new Error("No readable image pages were found.");
  if (pageCount > MAX_MANGA_PAGES) throw new Error(`Manga imports are limited to ${MAX_MANGA_PAGES.toLocaleString()} pages.`);
}

function defaultMangaImportMetadata(pageCount: number): MangaImportMetadata {
  return {
    pagePlacements: Array.from({ length: pageCount }, () => null),
    readingDirection: DEFAULT_MANGA_READING_DIRECTION,
  };
}

function readUint16BigEndian(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint24LittleEndian(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32BigEndian(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] * 0x1000000) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
}

function jpegDimensions(bytes: Uint8Array) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const startOfFrameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > bytes.length) return null;
    const segmentLength = readUint16BigEndian(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    if (startOfFrameMarkers.has(marker)) {
      return { width: readUint16BigEndian(bytes, offset + 5), height: readUint16BigEndian(bytes, offset + 3) };
    }
    offset += segmentLength;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array) {
  const header = String.fromCharCode(...bytes.slice(0, 16));
  if (!header.startsWith("RIFF") || header.slice(8, 12) !== "WEBP") return null;
  const format = header.slice(12, 16);
  if (format === "VP8X" && bytes.length >= 30) {
    return { width: readUint24LittleEndian(bytes, 24) + 1, height: readUint24LittleEndian(bytes, 27) + 1 };
  }
  if (format === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (format === "VP8 " && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return { width: (bytes[26] | (bytes[27] << 8)) & 0x3fff, height: (bytes[28] | (bytes[29] << 8)) & 0x3fff };
  }
  return null;
}

function avifDimensions(bytes: Uint8Array) {
  if (bytes.length < 32 || String.fromCharCode(...bytes.slice(4, 8)) !== "ftyp") return null;
  for (let offset = 8; offset + 16 <= bytes.length; offset += 1) {
    if (bytes[offset] === 0x69 && bytes[offset + 1] === 0x73 && bytes[offset + 2] === 0x70 && bytes[offset + 3] === 0x65) {
      return { width: readUint32BigEndian(bytes, offset + 8), height: readUint32BigEndian(bytes, offset + 12) };
    }
  }
  return null;
}

function encodedImageDimensions(bytes: Uint8Array, fileExtension: string) {
  if (fileExtension === "png" && bytes.length >= 24
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
    && String.fromCharCode(...bytes.slice(12, 16)) === "IHDR") {
    return { width: readUint32BigEndian(bytes, 16), height: readUint32BigEndian(bytes, 20) };
  }
  if (fileExtension === "gif" && bytes.length >= 10 && String.fromCharCode(...bytes.slice(0, 3)) === "GIF") {
    return { width: bytes[6] | (bytes[7] << 8), height: bytes[8] | (bytes[9] << 8) };
  }
  if (fileExtension === "jpg" || fileExtension === "jpeg") return jpegDimensions(bytes);
  if (fileExtension === "webp") return webpDimensions(bytes);
  if (fileExtension === "avif") return avifDimensions(bytes);
  return null;
}

async function validateMangaImage(file: File) {
  const fileExtension = supportedImageExtension(file);
  const bytes = new Uint8Array(await readBlobBytes(file.slice(0, MAX_IMAGE_HEADER_BYTES)));
  const dimensions = encodedImageDimensions(bytes, fileExtension);
  if (!dimensions?.width || !dimensions.height) throw new Error(`“${file.name}” is not a readable supported manga image.`);
  if (dimensions.width > MAX_IMAGE_EDGE || dimensions.height > MAX_IMAGE_EDGE || dimensions.width * dimensions.height > MAX_IMAGE_PIXELS) {
    throw new Error(`“${file.name}” has image dimensions that are too large to open safely.`);
  }
}

async function feedArchive(unzipper: Unzip, file: File) {
  if (typeof file.stream === "function") {
    const reader = file.stream().getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      unzipper.push(value, false);
    }
    unzipper.push(new Uint8Array(), true);
    return;
  }
  unzipper.push(new Uint8Array(await readBlobBytes(file)), true);
}

export async function extractArchivePages(file: File): Promise<File[]> {
  if (file.size > MAX_ARCHIVE_BYTES) throw new Error("This archive is too large to import safely in a browser.");
  let pageCount = 0;
  let declaredExtractedBytes = 0;
  let extractedBytes = 0;

  const entries = await new Promise<Array<{ path: string; chunks: ArrayBuffer[] }>>((resolve, reject) => {
    const pages: Array<{ path: string; chunks: ArrayBuffer[] }> = [];
    const activeFiles = new Set<UnzipFile>();
    let archiveComplete = false;
    let settled = false;

    function finishIfReady() {
      if (!settled && archiveComplete && activeFiles.size === 0) {
        settled = true;
        resolve(pages);
      }
    }

    function fail(error: Error) {
      if (settled) return;
      settled = true;
      for (const activeFile of activeFiles) activeFile.terminate();
      reject(error);
    }

    const unzipper = new Unzip((entry) => {
      if (settled || isIgnoredArchivePath(entry.name) || !IMAGE_EXTENSIONS.has(extension(entry.name))) return;
      pageCount += 1;
      if (pageCount > MAX_MANGA_PAGES) {
        fail(new Error(`This archive contains more than ${MAX_MANGA_PAGES.toLocaleString()} image pages.`));
        return;
      }
      if (entry.originalSize !== undefined) {
        declaredExtractedBytes += entry.originalSize;
        if (entry.originalSize > MAX_PAGE_BYTES) {
          fail(new Error(`“${basename(entry.name)}” is too large to import safely.`));
          return;
        }
        if (declaredExtractedBytes > MAX_EXTRACTED_BYTES) {
          fail(new Error("The expanded archive is too large to import safely."));
          return;
        }
        if (entry.size && entry.originalSize > 16 * 1024 * 1024 && entry.originalSize / entry.size > MAX_SUSPICIOUS_COMPRESSION_RATIO) {
          fail(new Error(`“${basename(entry.name)}” has a suspicious compression ratio.`));
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
        if (entryBytes > MAX_PAGE_BYTES) {
          fail(new Error(`“${basename(entry.name)}” is too large to import safely.`));
          return;
        }
        if (extractedBytes > MAX_EXTRACTED_BYTES) {
          fail(new Error("The expanded archive is too large to import safely."));
          return;
        }
        if (chunk.byteLength) {
          const copy = new Uint8Array(chunk.byteLength);
          copy.set(chunk);
          chunks.push(copy.buffer);
        }
        if (final) {
          activeFiles.delete(entry);
          if (entryBytes) pages.push({ path: entry.name, chunks });
          finishIfReady();
        }
      };
      try {
        entry.start();
      } catch (error) {
        fail(error instanceof Error ? error : new Error("Unsupported archive compression."));
      }
    });
    unzipper.register(AsyncUnzipInflate);

    void feedArchive(unzipper, file).then(() => {
      archiveComplete = true;
      finishIfReady();
    }).catch((error: unknown) => fail(error instanceof Error ? error : new Error("The archive could not be read.")));
  }).catch((error: unknown) => {
    if (error instanceof Error && /(?:too large|more than|suspicious compression)/iu.test(error.message)) throw error;
    throw new Error("This CBZ/ZIP archive is damaged or uses an unsupported compression format.");
  });

  const pages = entries
    .sort((left, right) => naturalMangaPageCompare(left.path, right.path))
    .map(({ path, chunks }, index) => {
      return new File(chunks, `page-${String(index + 1).padStart(4, "0")}.${extension(path) || "jpg"}`, {
        type: imageMimeType(path),
        lastModified: file.lastModified,
      });
    });
  validatePageCount(pages.length);
  for (const page of pages) await validateMangaImage(page);
  return pages;
}

export async function extractEpubMangaPages(file: File) {
  const extracted = await extractMangaEpub(file);
  const pages = extracted.pages.map(({ chunks, mediaType, path }, index) => {
    const sourceExtension = extension(path);
    const fileExtension = IMAGE_EXTENSIONS.has(sourceExtension) ? sourceExtension : IMAGE_MIME_EXTENSIONS.get(mediaType) || "jpg";
    return new File(chunks, `page-${String(index + 1).padStart(4, "0")}.${fileExtension}`, {
      type: IMAGE_MIME_EXTENSIONS.has(mediaType) ? mediaType : imageMimeType(path),
      lastModified: file.lastModified,
    });
  });
  validatePageCount(pages.length);
  for (const page of pages) await validateMangaImage(page);
  return {
    metadata: {
      pagePlacements: extracted.pages.map((page) => page.placement),
      readingDirection: extracted.readingDirection ?? DEFAULT_MANGA_READING_DIRECTION,
    } satisfies MangaImportMetadata,
    pages,
    title: extracted.title.trim() || mangaTitleFromFileName(file.name),
  };
}

export async function prepareMangaImport(inputFiles: readonly File[]): Promise<PreparedMangaImport> {
  const files = [...inputFiles].sort((left, right) => naturalMangaPageCompare(left.name, right.name));
  if (!files.length) throw new Error("Choose an EPUB, CBZ, ZIP, PDF, or a set of image pages.");

  if (files.length === 1 && isEpub(files[0])) {
    const { metadata, pages, title } = await extractEpubMangaPages(files[0]);
    return { title, fileName: files[0].name, sourceType: "epub", pageCount: pages.length, assets: pages, metadata };
  }

  if (files.length === 1 && isArchive(files[0])) {
    const pages = await extractArchivePages(files[0]);
    return {
      title: mangaTitleFromFileName(files[0].name),
      fileName: files[0].name,
      sourceType: "cbz",
      pageCount: pages.length,
      assets: pages,
      metadata: defaultMangaImportMetadata(pages.length),
    };
  }

  if (files.length === 1 && isPdf(files[0])) {
    if (files[0].size > MAX_MANGA_PDF_BYTES) throw new Error("PDF manga imports are limited to 300 MB.");
    const pageCount = await getMangaPdfPageCount(files[0]);
    validatePageCount(pageCount);
    return {
      title: mangaTitleFromFileName(files[0].name),
      fileName: files[0].name,
      sourceType: "pdf",
      pageCount,
      assets: [files[0]],
      metadata: defaultMangaImportMetadata(pageCount),
    };
  }

  if (files.some((file) => !isMangaImage(file))) throw new Error("Select one EPUB/CBZ/ZIP/PDF file, or select image pages together.");
  validatePageCount(files.length);
  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (totalBytes > MAX_DIRECT_IMAGE_BYTES) throw new Error("This image set is too large to keep safely in browser storage.");
  for (const file of files) {
    if (file.size > MAX_PAGE_BYTES) throw new Error(`“${file.name}” is too large to import safely.`);
    await validateMangaImage(file);
  }
  return {
    title: mangaTitleFromFileName(files[0].name.replace(/(?:[-_ ]?\d+)?\.[^.]+$/u, "")),
    fileName: `${files.length} image page${files.length === 1 ? "" : "s"}`,
    sourceType: "images",
    pageCount: files.length,
    assets: files,
    metadata: defaultMangaImportMetadata(files.length),
  };
}
