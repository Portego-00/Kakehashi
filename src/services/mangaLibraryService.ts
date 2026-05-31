import { Buffer } from "buffer";
import { Directory, File, Paths } from "expo-file-system";
import { unzipSync } from "fflate";
import {
  mangaOcrService,
  type MangaOcrRegion,
} from "./mangaOcrService";

const MANGA_LIBRARY_DIRECTORY_NAME = "manga-library";
const MANGA_LIBRARY_INDEX_FILE_NAME = "index.json";
const MANGA_LIBRARY_SCHEMA_VERSION = 1;
const PAGE_NUMBER_PADDING = 4;

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "avif",
  "gif",
]);

export type MangaSourceType = "cbz" | "pdf" | "images";
type MangaFileSourceType = Exclude<MangaSourceType, "images">;
export type MangaPickerSource = "file" | "directory";

export interface MangaLibraryItem {
  id: string;
  title: string;
  fileName: string;
  sourceType: MangaSourceType;
  pageCount: number;
  lastReadPage: number;
  coverUri?: string;
  importedAt: number;
  updatedAt: number;
}

interface PersistedMangaRecord {
  schemaVersion: number;
  metadata: MangaLibraryItem;
  pageImageFileNames?: string[];
  sourcePdfFileName?: string;
}

export interface StoredMangaRecord {
  schemaVersion: number;
  metadata: MangaLibraryItem;
  pageImageUris?: string[];
  sourcePdfUri?: string;
}

export interface MangaPageData {
  page: number;
  totalPages: number;
  imageWidth: number;
  imageHeight: number;
  imageUri: string;
  regions: MangaOcrRegion[];
  updatedAt: number;
}

export interface MangaOcrStatus {
  totalPages: number;
  completedPages: number;
  completedPageNumbers: number[];
}

type CachedMangaPageRecord = MangaPageData;
type GetPageDataOptions = {
  forceRefresh?: boolean;
};

const libraryDirectory = new Directory(Paths.document, MANGA_LIBRARY_DIRECTORY_NAME);
const indexFile = new File(libraryDirectory, MANGA_LIBRARY_INDEX_FILE_NAME);

function getMangaDirectory(mangaId: string): Directory {
  return new Directory(libraryDirectory.uri, mangaId);
}

function getMangaRecordFile(mangaId: string): File {
  return new File(getMangaDirectory(mangaId), "record.json");
}

function getMangaPagesDirectory(mangaId: string): Directory {
  return new Directory(getMangaDirectory(mangaId).uri, "pages");
}

function getMangaRenderedDirectory(mangaId: string): Directory {
  return new Directory(getMangaDirectory(mangaId).uri, "rendered");
}

function getMangaOcrDirectory(mangaId: string): Directory {
  return new Directory(getMangaDirectory(mangaId).uri, "ocr");
}

function getMangaPdfDirectory(mangaId: string): Directory {
  return new Directory(getMangaDirectory(mangaId).uri, "pdf");
}

function getCachedOcrFile(mangaId: string, page: number): File {
  const pageLabel = page.toString().padStart(PAGE_NUMBER_PADDING, "0");
  return new File(getMangaOcrDirectory(mangaId), `page-${pageLabel}.json`);
}

function getRenderedPageFile(mangaId: string, page: number): File {
  const pageLabel = page.toString().padStart(PAGE_NUMBER_PADDING, "0");
  return new File(getMangaRenderedDirectory(mangaId), `page-${pageLabel}.jpg`);
}

function getSourcePdfFile(mangaId: string, fileName = "source.pdf"): File {
  return new File(getMangaPdfDirectory(mangaId), fileName);
}

function normalizePathSegment(value: string): string {
  return value.replace(/\\/g, "/").trim();
}

function stripDirectoryFromPath(value: string): string {
  const normalized = normalizePathSegment(value);
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[a-z0-9]+$/i, "");
}

function normalizeTitleFromFileName(fileName: string): string {
  const baseName = stripExtension(fileName).trim();
  if (!baseName) {
    return "Untitled Manga";
  }

  return baseName
    .replace(/[_\-]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function getFileExtension(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
}

function naturalCompare(left: string, right: string): number {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function isImagePath(path: string): boolean {
  const fileName = stripDirectoryFromPath(path);
  const extension = getFileExtension(fileName);
  return IMAGE_EXTENSIONS.has(extension);
}

function isImageBasedSourceType(sourceType: MangaSourceType): boolean {
  return sourceType === "cbz" || sourceType === "images";
}

type DirectoryImageEntry = {
  file: File;
  relativePath: string;
};

function collectImageFilesFromDirectory(
  directory: Directory,
  parentPath = ""
): DirectoryImageEntry[] {
  const contents = directory.list();
  const imageEntries: DirectoryImageEntry[] = [];

  for (const entry of contents) {
    if (entry instanceof Directory) {
      const nestedParentPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
      imageEntries.push(...collectImageFilesFromDirectory(entry, nestedParentPath));
      continue;
    }

    const relativePath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    if (!isImagePath(relativePath)) {
      continue;
    }

    imageEntries.push({
      file: entry,
      relativePath,
    });
  }

  return imageEntries;
}

function normalizePageNumber(page: number, pageCount: number): number {
  const safePageCount = Math.max(1, Math.floor(pageCount || 1));
  return Math.max(1, Math.min(safePageCount, Math.floor(page || 1)));
}

function createMangaId(): string {
  return `manga-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isPickerCancellation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return /cancel|canceled|cancelled|abort/i.test(message);
}

function inferSourceType(fileName: string, mimeType?: string | null): MangaFileSourceType | null {
  const extension = getFileExtension(fileName);
  const normalizedMime =
    typeof mimeType === "string" && mimeType.trim().length > 0
      ? mimeType.trim().toLowerCase()
      : "";

  if (["cbz", "zip"].includes(extension)) {
    return "cbz";
  }

  if (extension === "pdf") {
    return "pdf";
  }

  if (
    normalizedMime === "application/vnd.comicbook+zip" ||
    normalizedMime === "application/zip"
  ) {
    return "cbz";
  }

  if (normalizedMime === "application/pdf") {
    return "pdf";
  }

  return null;
}

function removeFileIfPresent(file: File): void {
  try {
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Best-effort cleanup.
  }
}

function removeDirectoryIfPresent(directory: Directory): void {
  try {
    if (directory.exists) {
      directory.delete();
    }
  } catch {
    // Best-effort cleanup.
  }
}

async function ensureLibraryReady(): Promise<void> {
  libraryDirectory.create({ intermediates: true, idempotent: true });

  if (!indexFile.exists) {
    indexFile.create({ intermediates: true, overwrite: true });
    indexFile.write("[]");
  }
}

function ensureMangaDirectories(mangaId: string): void {
  getMangaDirectory(mangaId).create({ intermediates: true, idempotent: true });
  getMangaPagesDirectory(mangaId).create({ intermediates: true, idempotent: true });
  getMangaPdfDirectory(mangaId).create({ intermediates: true, idempotent: true });
  getMangaRenderedDirectory(mangaId).create({ intermediates: true, idempotent: true });
  getMangaOcrDirectory(mangaId).create({ intermediates: true, idempotent: true });
}

async function readIndex(): Promise<MangaLibraryItem[]> {
  await ensureLibraryReady();

  try {
    const rawIndex = await indexFile.text();
    const parsed = JSON.parse(rawIndex) as MangaLibraryItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry) => entry && typeof entry.id === "string")
      .sort((left, right) => right.updatedAt - left.updatedAt);
  } catch (error) {
    console.error("Failed to read manga library index:", error);
    return [];
  }
}

async function writeIndex(entries: MangaLibraryItem[]): Promise<void> {
  await ensureLibraryReady();
  indexFile.write(JSON.stringify(entries, null, 2));
}

async function writeStoredRecord(record: PersistedMangaRecord): Promise<void> {
  const mangaId = record.metadata.id;
  ensureMangaDirectories(mangaId);

  const recordFile = getMangaRecordFile(mangaId);
  if (!recordFile.exists) {
    recordFile.create({ intermediates: true, overwrite: true });
  }

  recordFile.write(JSON.stringify(record, null, 2));
}

async function readStoredRecord(mangaId: string): Promise<PersistedMangaRecord | null> {
  await ensureLibraryReady();

  const recordFile = getMangaRecordFile(mangaId);
  if (!recordFile.exists) {
    return null;
  }

  try {
    const raw = await recordFile.text();
    const parsed = JSON.parse(raw) as PersistedMangaRecord;

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.metadata ||
      typeof parsed.metadata.id !== "string"
    ) {
      return null;
    }

    return {
      schemaVersion: MANGA_LIBRARY_SCHEMA_VERSION,
      metadata: parsed.metadata,
      pageImageFileNames: Array.isArray(parsed.pageImageFileNames)
        ? parsed.pageImageFileNames.filter((value): value is string => typeof value === "string")
        : undefined,
      sourcePdfFileName:
        typeof parsed.sourcePdfFileName === "string" && parsed.sourcePdfFileName.trim().length > 0
          ? parsed.sourcePdfFileName
          : undefined,
    };
  } catch (error) {
    console.error(`Failed to read manga record ${mangaId}:`, error);
    return null;
  }
}

function buildPageFileName(page: number, extension: string): string {
  const safeExtension = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  return `page-${page.toString().padStart(PAGE_NUMBER_PADDING, "0")}.${safeExtension}`;
}

async function parseCachedPageRecord(
  file: File
): Promise<CachedMangaPageRecord | null> {
  try {
    const parsed = JSON.parse(await file.text()) as CachedMangaPageRecord;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.imageUri !== "string" ||
      !Array.isArray(parsed.regions)
    ) {
      return null;
    }

    return {
      page: Math.max(1, Math.floor(Number(parsed.page) || 1)),
      totalPages: Math.max(1, Math.floor(Number(parsed.totalPages) || 1)),
      imageWidth: Math.max(1, Math.floor(Number(parsed.imageWidth) || 1)),
      imageHeight: Math.max(1, Math.floor(Number(parsed.imageHeight) || 1)),
      imageUri: parsed.imageUri,
      regions: parsed.regions,
      updatedAt: Math.max(0, Number(parsed.updatedAt) || Date.now()),
    };
  } catch {
    return null;
  }
}

function writeCachedPageRecord(file: File, record: CachedMangaPageRecord): void {
  if (!file.exists) {
    file.create({ intermediates: true, overwrite: true });
  }

  file.write(JSON.stringify(record));
}

async function updateMetadataInIndex(
  mangaId: string,
  updater: (current: MangaLibraryItem) => MangaLibraryItem
): Promise<void> {
  const currentIndex = await readIndex();
  const target = currentIndex.find((entry) => entry.id === mangaId);
  if (!target) {
    return;
  }

  const updated = updater(target);
  const nextIndex = currentIndex
    .map((entry) => (entry.id === mangaId ? updated : entry))
    .sort((left, right) => right.updatedAt - left.updatedAt);

  await writeIndex(nextIndex);
}

async function updateStoredRecordMetadata(
  mangaId: string,
  updater: (current: MangaLibraryItem) => MangaLibraryItem
): Promise<void> {
  const currentRecord = await readStoredRecord(mangaId);
  if (!currentRecord) {
    return;
  }

  const updatedRecord: PersistedMangaRecord = {
    ...currentRecord,
    metadata: updater(currentRecord.metadata),
  };

  await writeStoredRecord(updatedRecord);
}

export const mangaLibraryService = {
  async importFromPicker(source: MangaPickerSource = "file"): Promise<MangaLibraryItem | null> {
    try {
      if (source === "directory") {
        const pickedDirectory = await Directory.pickDirectoryAsync();
        if (!pickedDirectory) {
          return null;
        }

        return this.importFromDirectory(pickedDirectory);
      }

      const result = await File.pickFileAsync();
      const pickedFile = Array.isArray(result) ? result[0] : result;

      if (!pickedFile) {
        return null;
      }

      const fileName = pickedFile.name?.trim() || stripDirectoryFromPath(pickedFile.uri);
      const sourceType = inferSourceType(fileName, pickedFile.type ?? null);
      if (!sourceType) {
        throw new Error("Unsupported file format. Please choose a CBZ file.");
      }

      return this.importFromFile(pickedFile, sourceType);
    } catch (error) {
      if (isPickerCancellation(error)) {
        return null;
      }

      throw error;
    }
  },

  async importFromFile(file: File, sourceType: MangaFileSourceType): Promise<MangaLibraryItem> {
    await ensureLibraryReady();

    if (sourceType === "pdf") {
      throw new Error(
        "PDF import is not supported in on-device OCR mode yet. Please use a CBZ file or image folder."
      );
    }

    const now = Date.now();
    const mangaId = createMangaId();
    const originalFileName = file.name?.trim() || stripDirectoryFromPath(file.uri);
    const title = normalizeTitleFromFileName(originalFileName);

    ensureMangaDirectories(mangaId);

    let pageCount = 1;
    let coverUri: string | undefined;
    let pageImageFileNames: string[] | undefined;
    let sourcePdfFileName: string | undefined;

    const archiveBytes = await file.bytes();
    const archiveEntries = unzipSync(archiveBytes);

    const imageEntries = Object.entries(archiveEntries)
      .filter(([path, bytes]) => isImagePath(path) && bytes.length > 0)
      .sort((left, right) => naturalCompare(left[0], right[0]));

    if (imageEntries.length === 0) {
      throw new Error("No readable images were found in this CBZ archive.");
    }

    const pagesDirectory = getMangaPagesDirectory(mangaId);
    pageImageFileNames = imageEntries.map(([path], index) => {
      const extension = getFileExtension(path) || "jpg";
      const pageFileName = buildPageFileName(index + 1, extension);
      const pageFile = new File(pagesDirectory, pageFileName);

      if (pageFile.exists) {
        pageFile.delete();
      }

      pageFile.create({ intermediates: true, overwrite: true });
      pageFile.write(Buffer.from(imageEntries[index][1]).toString("base64"), {
        encoding: "base64",
      });

      return pageFileName;
    });

    pageCount = pageImageFileNames.length;
    coverUri = new File(pagesDirectory, pageImageFileNames[0]).uri;

    const metadata: MangaLibraryItem = {
      id: mangaId,
      title,
      fileName: originalFileName,
      sourceType,
      pageCount: Math.max(1, Math.floor(pageCount || 1)),
      lastReadPage: 1,
      coverUri,
      importedAt: now,
      updatedAt: now,
    };

    const record: PersistedMangaRecord = {
      schemaVersion: MANGA_LIBRARY_SCHEMA_VERSION,
      metadata,
      pageImageFileNames,
      sourcePdfFileName,
    };

    await writeStoredRecord(record);

    const currentIndex = await readIndex();
    const nextIndex = [metadata, ...currentIndex.filter((entry) => entry.id !== mangaId)];
    await writeIndex(nextIndex);

    return metadata;
  },

  async importFromDirectory(directory: Directory): Promise<MangaLibraryItem> {
    await ensureLibraryReady();

    const now = Date.now();
    const mangaId = createMangaId();
    const originalDirectoryName = directory.name?.trim() || stripDirectoryFromPath(directory.uri);
    const title = normalizeTitleFromFileName(originalDirectoryName || "Untitled Manga");

    ensureMangaDirectories(mangaId);

    const imageEntries = collectImageFilesFromDirectory(directory).sort((left, right) =>
      naturalCompare(left.relativePath, right.relativePath)
    );

    if (imageEntries.length === 0) {
      throw new Error("No readable image pages were found in this folder.");
    }

    const pagesDirectory = getMangaPagesDirectory(mangaId);
    const pageImageFileNames: string[] = [];
    for (const [index, entry] of imageEntries.entries()) {
      const extension = getFileExtension(entry.relativePath) || "jpg";
      const pageFileName = buildPageFileName(index + 1, extension);
      const pageFile = new File(pagesDirectory, pageFileName);

      if (pageFile.exists) {
        pageFile.delete();
      }

      await entry.file.copy(pageFile);
      pageImageFileNames.push(pageFileName);
    }

    const coverUri = new File(pagesDirectory, pageImageFileNames[0]).uri;
    const metadata: MangaLibraryItem = {
      id: mangaId,
      title,
      fileName: originalDirectoryName || "image-folder",
      sourceType: "images",
      pageCount: pageImageFileNames.length,
      lastReadPage: 1,
      coverUri,
      importedAt: now,
      updatedAt: now,
    };

    const record: PersistedMangaRecord = {
      schemaVersion: MANGA_LIBRARY_SCHEMA_VERSION,
      metadata,
      pageImageFileNames,
    };

    await writeStoredRecord(record);

    const currentIndex = await readIndex();
    const nextIndex = [metadata, ...currentIndex.filter((entry) => entry.id !== mangaId)];
    await writeIndex(nextIndex);

    return metadata;
  },

  async listMangas(): Promise<MangaLibraryItem[]> {
    return readIndex();
  },

  async getManga(mangaId: string): Promise<StoredMangaRecord | null> {
    const record = await readStoredRecord(mangaId);
    if (!record) {
      return null;
    }

    const storedManga: StoredMangaRecord = {
      schemaVersion: MANGA_LIBRARY_SCHEMA_VERSION,
      metadata: record.metadata,
    };

    if (isImageBasedSourceType(record.metadata.sourceType)) {
      const pageImageUris = (record.pageImageFileNames || [])
        .map((pageFileName) => new File(getMangaPagesDirectory(mangaId), pageFileName))
        .filter((file) => file.exists)
        .map((file) => file.uri);

      storedManga.pageImageUris = pageImageUris;
    }

    if (record.metadata.sourceType === "pdf") {
      const sourcePdfFile = getSourcePdfFile(mangaId, record.sourcePdfFileName || "source.pdf");
      if (sourcePdfFile.exists) {
        storedManga.sourcePdfUri = sourcePdfFile.uri;
      }
    }

    return storedManga;
  },

  async getPageData(
    mangaId: string,
    page: number,
    options: GetPageDataOptions = {}
  ): Promise<MangaPageData | null> {
    const storedManga = await this.getManga(mangaId);
    if (!storedManga) {
      return null;
    }

    const forceRefresh = options.forceRefresh === true;
    const normalizedPage = normalizePageNumber(page, storedManga.metadata.pageCount);
    const ocrCacheFile = getCachedOcrFile(mangaId, normalizedPage);

    if (!forceRefresh && ocrCacheFile.exists) {
      const cachedRecord = await parseCachedPageRecord(ocrCacheFile);
      if (cachedRecord) {
        if (isImageBasedSourceType(storedManga.metadata.sourceType)) {
          return {
            ...cachedRecord,
            totalPages: storedManga.metadata.pageCount,
          };
        }

        const renderedPageFile = getRenderedPageFile(mangaId, normalizedPage);
        if (renderedPageFile.exists) {
          return {
            ...cachedRecord,
            imageUri: renderedPageFile.uri,
            totalPages: Math.max(cachedRecord.totalPages, storedManga.metadata.pageCount),
          };
        }
      }
    }

    if (isImageBasedSourceType(storedManga.metadata.sourceType)) {
      const imageUri = storedManga.pageImageUris?.[normalizedPage - 1];
      if (!imageUri) {
        return null;
      }

      const ocrPageResult = await mangaOcrService.ocrImageFile(new File(imageUri));

      const pageRecord: MangaPageData = {
        page: normalizedPage,
        totalPages: storedManga.metadata.pageCount,
        imageWidth: Math.max(1, Math.floor(ocrPageResult.imageWidth || 1)),
        imageHeight: Math.max(1, Math.floor(ocrPageResult.imageHeight || 1)),
        imageUri,
        regions: ocrPageResult.regions,
        updatedAt: Date.now(),
      };

      writeCachedPageRecord(ocrCacheFile, pageRecord);
      return pageRecord;
    }

    throw new Error(
      "PDF OCR is not supported in on-device mode yet. Re-import as CBZ or an image folder."
    );
  },

  async updateReadingProgress(mangaId: string, page: number): Promise<void> {
    const storedManga = await this.getManga(mangaId);
    if (!storedManga) {
      return;
    }

    const normalizedPage = normalizePageNumber(page, storedManga.metadata.pageCount);
    const now = Date.now();

    await updateStoredRecordMetadata(mangaId, (current) => ({
      ...current,
      lastReadPage: normalizedPage,
      updatedAt: now,
    }));

    await updateMetadataInIndex(mangaId, (current) => ({
      ...current,
      lastReadPage: normalizedPage,
      updatedAt: now,
    }));
  },

  async getOcrStatus(mangaId: string): Promise<MangaOcrStatus> {
    const storedManga = await this.getManga(mangaId);
    if (!storedManga) {
      return {
        totalPages: 0,
        completedPages: 0,
        completedPageNumbers: [],
      };
    }

    const totalPages = Math.max(1, Math.floor(storedManga.metadata.pageCount || 1));
    const completedPageNumbers: number[] = [];

    for (let page = 1; page <= totalPages; page += 1) {
      const ocrCacheFile = getCachedOcrFile(mangaId, page);
      if (!ocrCacheFile.exists) {
        continue;
      }

      const cachedRecord = await parseCachedPageRecord(ocrCacheFile);
      if (cachedRecord) {
        completedPageNumbers.push(page);
      }
    }

    return {
      totalPages,
      completedPages: completedPageNumbers.length,
      completedPageNumbers,
    };
  },

  async deleteManga(mangaId: string): Promise<void> {
    const stored = await readStoredRecord(mangaId);

    if (stored?.metadata.coverUri) {
      removeFileIfPresent(new File(stored.metadata.coverUri));
    }

    if (stored?.pageImageFileNames) {
      stored.pageImageFileNames.forEach((fileName) => {
        removeFileIfPresent(new File(getMangaPagesDirectory(mangaId), fileName));
      });
    }

    if (stored?.sourcePdfFileName) {
      removeFileIfPresent(getSourcePdfFile(mangaId, stored.sourcePdfFileName));
    }

    const totalPages = Math.max(1, Number(stored?.metadata.pageCount || 1));
    for (let page = 1; page <= totalPages; page += 1) {
      removeFileIfPresent(getCachedOcrFile(mangaId, page));
      removeFileIfPresent(getRenderedPageFile(mangaId, page));
    }

    removeFileIfPresent(getMangaRecordFile(mangaId));

    removeDirectoryIfPresent(getMangaPagesDirectory(mangaId));
    removeDirectoryIfPresent(getMangaRenderedDirectory(mangaId));
    removeDirectoryIfPresent(getMangaOcrDirectory(mangaId));
    removeDirectoryIfPresent(getMangaPdfDirectory(mangaId));
    removeDirectoryIfPresent(getMangaDirectory(mangaId));

    const currentIndex = await readIndex();
    await writeIndex(currentIndex.filter((entry) => entry.id !== mangaId));
  },
};
