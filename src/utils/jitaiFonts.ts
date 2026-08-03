import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Font from "expo-font";

export interface JitaiBundledFont {
  id: string;
  family: string;
  displayName: string;
}

export interface JitaiDownloadableFont {
  id: string;
  family: string;
  displayName: string;
  downloadUrl: string;
  fileName: string;
  sizeBytes: number;
  styleLabel?: string;
}

export interface DownloadedJitaiFont {
  id: string;
  family: string;
  displayName: string;
  fileUri: string;
  downloadedAt: string;
  origin?: "catalog" | "custom";
  originalFileName?: string;
  sizeBytes?: number;
}

export interface InstalledJitaiFont {
  id: string;
  family: string;
  displayName: string;
  source: "bundled" | "downloaded" | "custom";
}

export interface CustomJitaiFontFile {
  uri: string;
  name: string;
  size?: number | null;
}

const JITAI_DOWNLOAD_MANIFEST_KEY = "jitai_downloaded_fonts_v1";
const JITAI_FONT_DIRECTORY = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}jitai-fonts`
  : null;
const CUSTOM_JITAI_FONT_ID_PREFIX = "custom-";
const SUPPORTED_CUSTOM_FONT_EXTENSIONS = new Set(["otf", "ttf"]);

export const DEFAULT_JITAI_FONT_FAMILY = "SourceHanSansJP-Regular";
export const MAX_CUSTOM_JITAI_FONT_SIZE_BYTES = 25 * 1024 * 1024;

export const JITAI_BUNDLED_FONTS: readonly JitaiBundledFont[] = [
  {
    id: "source-han-sans",
    family: "SourceHanSansJP-Regular",
    displayName: "Source Han Sans JP",
  },
  {
    id: "zen-kurenaido",
    family: "ZenKurenaido-Regular",
    displayName: "Zen Kurenaido",
  },
  {
    id: "reggae-one",
    family: "ReggaeOne-Regular",
    displayName: "Reggae One",
  },
  {
    id: "yuji-syuku",
    family: "YujiSyuku-Regular",
    displayName: "Yuji Syuku",
  },
  {
    id: "hachi-maru-pop",
    family: "HachiMaruPop-Regular",
    displayName: "Hachi Maru Pop",
  },
] as const;

export const JITAI_DOWNLOADABLE_FONTS: readonly JitaiDownloadableFont[] = [
  {
    id: "dot-gothic-16",
    family: "DotGothic16-Regular",
    displayName: "DotGothic16",
    downloadUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/dotgothic16/DotGothic16-Regular.ttf",
    fileName: "DotGothic16-Regular.ttf",
    sizeBytes: 2069236,
  },
  {
    id: "mplus-rounded-1c",
    family: "MPLUSRounded1c-Regular",
    displayName: "M PLUS Rounded 1c",
    downloadUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/mplusrounded1c/MPLUSRounded1c-Regular.ttf",
    fileName: "MPLUSRounded1c-Regular.ttf",
    sizeBytes: 3389792,
  },
  {
    id: "rocknroll-one",
    family: "RocknRollOne-Regular",
    displayName: "RocknRoll One",
    downloadUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/rocknrollone/RocknRollOne-Regular.ttf",
    fileName: "RocknRollOne-Regular.ttf",
    sizeBytes: 2682824,
  },
  {
    id: "stick",
    family: "Stick-Regular",
    displayName: "Stick",
    downloadUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/stick/Stick-Regular.ttf",
    fileName: "Stick-Regular.ttf",
    sizeBytes: 2215036,
  },
  {
    id: "kaisei-decol",
    family: "KaiseiDecol-Regular",
    displayName: "Kaisei Decol",
    downloadUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/kaiseidecol/KaiseiDecol-Regular.ttf",
    fileName: "KaiseiDecol-Regular.ttf",
    sizeBytes: 4503152,
  },
  {
    id: "yomogi",
    family: "Yomogi-Regular",
    displayName: "Yomogi",
    downloadUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/yomogi/Yomogi-Regular.ttf",
    fileName: "Yomogi-Regular.ttf",
    sizeBytes: 4039220,
  },
  {
    id: "yuji-mai",
    family: "YujiMai-Regular",
    displayName: "Yuji Mai",
    downloadUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/yujimai/YujiMai-Regular.ttf",
    fileName: "YujiMai-Regular.ttf",
    sizeBytes: 8496292,
    styleLabel: "Brush calligraphy",
  },
  {
    id: "yuji-boku",
    family: "YujiBoku-Regular",
    displayName: "Yuji Boku",
    downloadUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/yujiboku/YujiBoku-Regular.ttf",
    fileName: "YujiBoku-Regular.ttf",
    sizeBytes: 8525588,
    styleLabel: "Brush calligraphy",
  },
  {
    id: "kaisei-harunoumi",
    family: "KaiseiHarunoUmi-Regular",
    displayName: "Kaisei HarunoUmi",
    downloadUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/kaiseiharunoumi/KaiseiHarunoUmi-Regular.ttf",
    fileName: "KaiseiHarunoUmi-Regular.ttf",
    sizeBytes: 4571780,
    styleLabel: "Calligraphy",
  },
] as const;

const bundledFontsById = new Map(JITAI_BUNDLED_FONTS.map((font) => [font.id, font]));
const downloadableFontsById = new Map(
  JITAI_DOWNLOADABLE_FONTS.map((font) => [font.id, font]),
);
const downloadableFontsByFileName = new Map(
  JITAI_DOWNLOADABLE_FONTS.map((font) => [font.fileName, font]),
);

function dedupeStringArray(values: string[]): string[] {
  return Array.from(new Set(values));
}

function isDownloadedJitaiFont(value: unknown): value is DownloadedJitaiFont {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<DownloadedJitaiFont>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.family === "string" &&
    typeof candidate.displayName === "string" &&
    typeof candidate.fileUri === "string" &&
    typeof candidate.downloadedAt === "string" &&
    (candidate.origin === undefined ||
      candidate.origin === "catalog" ||
      candidate.origin === "custom") &&
    (candidate.originalFileName === undefined ||
      typeof candidate.originalFileName === "string") &&
    (candidate.sizeBytes === undefined ||
      (typeof candidate.sizeBytes === "number" &&
        Number.isFinite(candidate.sizeBytes) &&
        candidate.sizeBytes >= 0))
  );
}

async function readDownloadedFontManifest(): Promise<DownloadedJitaiFont[]> {
  try {
    const raw = await AsyncStorage.getItem(JITAI_DOWNLOAD_MANIFEST_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isDownloadedJitaiFont);
  } catch (error) {
    console.error("Failed to read Jitai font manifest:", error);
    return [];
  }
}

async function writeDownloadedFontManifest(
  fonts: DownloadedJitaiFont[],
): Promise<void> {
  await AsyncStorage.setItem(
    JITAI_DOWNLOAD_MANIFEST_KEY,
    JSON.stringify(fonts, null, 2),
  );
}

async function ensureJitaiFontDirectory(): Promise<string> {
  if (!JITAI_FONT_DIRECTORY) {
    throw new Error("Unable to access app document directory.");
  }

  await FileSystem.makeDirectoryAsync(JITAI_FONT_DIRECTORY, {
    intermediates: true,
  });

  return JITAI_FONT_DIRECTORY;
}

async function ensureFontIsLoaded(font: DownloadedJitaiFont): Promise<boolean> {
  try {
    if (!Font.isLoaded(font.family)) {
      await Font.loadAsync({ [font.family]: font.fileUri });
    }
    return true;
  } catch (error) {
    console.error(`Failed to load stored Jitai font ${font.id}:`, error);
    return false;
  }
}

function toDownloadedFont(
  font: JitaiDownloadableFont,
  fileUri: string,
  downloadedAt?: string,
): DownloadedJitaiFont {
  return {
    id: font.id,
    family: font.family,
    displayName: font.displayName,
    fileUri,
    downloadedAt: downloadedAt ?? new Date().toISOString(),
    origin: "catalog",
  };
}

function getExpectedStoredFontUri(font: DownloadedJitaiFont): string | null {
  if (!JITAI_FONT_DIRECTORY) {
    return null;
  }

  const downloadableFont = downloadableFontsById.get(font.id);
  if (downloadableFont) {
    return `${JITAI_FONT_DIRECTORY}/${downloadableFont.fileName}`;
  }

  const fileName = font.fileUri.split(/[?#]/, 1)[0]?.split("/").pop();
  if (!fileName || !/^[a-z0-9._-]+$/i.test(fileName)) {
    return null;
  }

  return `${JITAI_FONT_DIRECTORY}/${fileName}`;
}

async function fileExists(uri: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists;
}

export function getDefaultJitaiSelectedFontIds(): string[] {
  return JITAI_BUNDLED_FONTS.map((font) => font.id);
}

export function formatJitaiFontSize(sizeBytes: number): string {
  const sizeInMb = sizeBytes / (1024 * 1024);
  return `${sizeInMb.toFixed(1)} MB`;
}

export function getCustomJitaiFontFileValidationError(
  file: Pick<CustomJitaiFontFile, "name" | "size">,
): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !SUPPORTED_CUSTOM_FONT_EXTENSIONS.has(extension)) {
    return "Choose a TrueType (.ttf) or OpenType (.otf) font file.";
  }

  if (
    typeof file.size === "number" &&
    file.size > MAX_CUSTOM_JITAI_FONT_SIZE_BYTES
  ) {
    return `Choose a font smaller than ${formatJitaiFontSize(
      MAX_CUSTOM_JITAI_FONT_SIZE_BYTES,
    )}.`;
  }

  return null;
}

export function getInstalledJitaiFonts(
  downloadedFonts: DownloadedJitaiFont[],
): InstalledJitaiFont[] {
  const bundled = JITAI_BUNDLED_FONTS.map((font) => ({
    ...font,
    source: "bundled" as const,
  }));
  const downloaded = downloadedFonts.map((font) => ({
    id: font.id,
    family: font.family,
    displayName: font.displayName,
    source:
      font.origin === "custom" ||
      font.id.startsWith(CUSTOM_JITAI_FONT_ID_PREFIX)
        ? ("custom" as const)
        : ("downloaded" as const),
  }));

  return [...bundled, ...downloaded];
}

export function sanitizeJitaiSelectedFontIds(
  selectedIds: string[],
  downloadedFonts: DownloadedJitaiFont[],
): string[] {
  const validIds = new Set([
    ...JITAI_BUNDLED_FONTS.map((font) => font.id),
    ...downloadedFonts.map((font) => font.id),
  ]);

  const filtered = dedupeStringArray(
    selectedIds.filter((id) => validIds.has(id)),
  );

  if (filtered.length > 0) {
    return filtered;
  }

  return getDefaultJitaiSelectedFontIds();
}

export function getJitaiFontFamiliesForSelection(
  selectedIds: string[],
  downloadedFonts: DownloadedJitaiFont[],
): string[] {
  const selected = sanitizeJitaiSelectedFontIds(selectedIds, downloadedFonts);
  const downloadedById = new Map(downloadedFonts.map((font) => [font.id, font]));

  const families = selected
    .map((id) => {
      const bundled = bundledFontsById.get(id);
      if (bundled) {
        return bundled.family;
      }

      return downloadedById.get(id)?.family ?? null;
    })
    .filter((family): family is string => Boolean(family));

  if (families.length === 0) {
    return [DEFAULT_JITAI_FONT_FAMILY];
  }

  return dedupeStringArray(families);
}

export async function loadDownloadedJitaiFonts(): Promise<DownloadedJitaiFont[]> {
  const manifestFonts = await readDownloadedFontManifest();
  const recoveredFontsById = new Map<string, DownloadedJitaiFont>();
  let manifestNeedsWrite = false;

  for (const font of manifestFonts) {
    if (recoveredFontsById.has(font.id)) {
      manifestNeedsWrite = true;
      continue;
    }

    try {
      let resolvedFont = font;
      let exists = await fileExists(font.fileUri);

      if (!exists) {
        const fallbackUri = getExpectedStoredFontUri(font);
        if (fallbackUri && fallbackUri !== font.fileUri) {
          exists = await fileExists(fallbackUri);
          if (exists) {
            resolvedFont = { ...font, fileUri: fallbackUri };
            manifestNeedsWrite = true;
          }
        }
      }

      if (!exists) {
        // File is genuinely missing; remove this stale manifest entry.
        manifestNeedsWrite = true;
        continue;
      }

      const downloadableMetadata = downloadableFontsById.get(resolvedFont.id);
      if (downloadableMetadata) {
        const normalized = toDownloadedFont(
          downloadableMetadata,
          resolvedFont.fileUri,
          resolvedFont.downloadedAt,
        );
        if (
          normalized.family !== resolvedFont.family ||
          normalized.displayName !== resolvedFont.displayName ||
          normalized.fileUri !== resolvedFont.fileUri
        ) {
          manifestNeedsWrite = true;
        }
        resolvedFont = normalized;
      }

      // Keep the font in manifest even if a transient load fails.
      await ensureFontIsLoaded(resolvedFont);
      recoveredFontsById.set(resolvedFont.id, resolvedFont);
    } catch (error) {
      console.error(`Failed to validate downloaded Jitai font ${font.id}:`, error);
    }
  }

  if (JITAI_FONT_DIRECTORY) {
    try {
      const dirInfo = await FileSystem.getInfoAsync(JITAI_FONT_DIRECTORY);
      if (dirInfo.exists) {
        const fileNames = await FileSystem.readDirectoryAsync(JITAI_FONT_DIRECTORY);
        for (const fileName of fileNames) {
          const downloadableFont = downloadableFontsByFileName.get(fileName);
          if (!downloadableFont) {
            continue;
          }

          if (recoveredFontsById.has(downloadableFont.id)) {
            continue;
          }

          const recoveredFont = toDownloadedFont(
            downloadableFont,
            `${JITAI_FONT_DIRECTORY}/${fileName}`,
          );
          await ensureFontIsLoaded(recoveredFont);
          recoveredFontsById.set(recoveredFont.id, recoveredFont);
          manifestNeedsWrite = true;
        }
      }
    } catch (error) {
      console.error("Failed to recover Jitai fonts from directory scan:", error);
    }
  }

  const recoveredFonts = Array.from(recoveredFontsById.values());

  if (manifestNeedsWrite) {
    await writeDownloadedFontManifest(recoveredFonts);
  }

  return recoveredFonts;
}

export async function downloadJitaiFont(fontId: string): Promise<DownloadedJitaiFont> {
  const fontToDownload = downloadableFontsById.get(fontId);
  if (!fontToDownload) {
    throw new Error("Selected font is not available for download.");
  }

  const directory = await ensureJitaiFontDirectory();
  const manifestFonts = await readDownloadedFontManifest();
  const existingFont = manifestFonts.find((font) => font.id === fontId);

  if (existingFont) {
    const info = await FileSystem.getInfoAsync(existingFont.fileUri);
    if (info.exists) {
      const loaded = await ensureFontIsLoaded(existingFont);
      if (loaded) {
        return existingFont;
      }
    }
  }

  const existingFileUri = `${directory}/${fontToDownload.fileName}`;
  const existingFile = await FileSystem.getInfoAsync(existingFileUri);
  if (existingFile.exists) {
    const recoveredFont = toDownloadedFont(fontToDownload, existingFileUri);
    const loaded = await ensureFontIsLoaded(recoveredFont);
    if (loaded) {
      const nextManifest = [
        ...manifestFonts.filter((font) => font.id !== recoveredFont.id),
        recoveredFont,
      ];
      await writeDownloadedFontManifest(nextManifest);
      return recoveredFont;
    }
  }

  const fileUri = `${directory}/${fontToDownload.fileName}`;
  const result = await FileSystem.downloadAsync(fontToDownload.downloadUrl, fileUri);
  if (result.status !== 200) {
    throw new Error(`Download failed with status ${result.status}.`);
  }

  const downloadedFont = toDownloadedFont(fontToDownload, result.uri);

  const loaded = await ensureFontIsLoaded(downloadedFont);
  if (!loaded) {
    await FileSystem.deleteAsync(result.uri, { idempotent: true });
    throw new Error("Downloaded font could not be loaded.");
  }

  const nextManifest = [
    ...manifestFonts.filter((font) => font.id !== downloadedFont.id),
    downloadedFont,
  ];
  await writeDownloadedFontManifest(nextManifest);

  return downloadedFont;
}

export async function importCustomJitaiFont(
  file: CustomJitaiFontFile,
): Promise<DownloadedJitaiFont> {
  const validationError = getCustomJitaiFontFileValidationError(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const directory = await ensureJitaiFontDirectory();
  const extension = file.name.split(".").pop()!.toLowerCase();
  const manifestFonts = await readDownloadedFontManifest();

  let token = "";
  let id = "";
  do {
    token = `${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    id = `${CUSTOM_JITAI_FONT_ID_PREFIX}${token}`;
  } while (manifestFonts.some((font) => font.id === id));

  const family = `JitaiCustom_${token}`;
  const fileUri = `${directory}/${id}.${extension}`;
  const nameWithoutExtension = file.name.slice(
    0,
    -(extension.length + 1),
  );
  const displayName =
    nameWithoutExtension.replace(/_/g, " ").trim().slice(0, 80) ||
    "Custom font";
  let didCopyFile = false;

  try {
    await FileSystem.copyAsync({ from: file.uri, to: fileUri });
    didCopyFile = true;

    const copiedFile = await FileSystem.getInfoAsync(fileUri);
    if (!copiedFile.exists) {
      throw new Error("The selected font could not be copied.");
    }

    if (
      typeof copiedFile.size === "number" &&
      copiedFile.size > MAX_CUSTOM_JITAI_FONT_SIZE_BYTES
    ) {
      throw new Error(
        `Choose a font smaller than ${formatJitaiFontSize(
          MAX_CUSTOM_JITAI_FONT_SIZE_BYTES,
        )}.`,
      );
    }

    const customFont: DownloadedJitaiFont = {
      id,
      family,
      displayName,
      fileUri,
      downloadedAt: new Date().toISOString(),
      origin: "custom",
      originalFileName: file.name,
      sizeBytes:
        typeof copiedFile.size === "number" ? copiedFile.size : file.size ?? undefined,
    };

    const loaded = await ensureFontIsLoaded(customFont);
    if (!loaded) {
      throw new Error(
        "This font could not be loaded. Try a non-variable TTF or OTF font.",
      );
    }

    await writeDownloadedFontManifest([...manifestFonts, customFont]);
    return customFont;
  } catch (error) {
    if (didCopyFile) {
      try {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
      } catch (cleanupError) {
        console.error("Failed to clean up custom Jitai font:", cleanupError);
      }
    }
    throw error;
  }
}

export async function removeDownloadedJitaiFont(fontId: string): Promise<boolean> {
  const manifestFonts = await readDownloadedFontManifest();
  const fontToRemove = manifestFonts.find((font) => font.id === fontId);
  if (!fontToRemove) {
    return false;
  }

  try {
    await FileSystem.deleteAsync(fontToRemove.fileUri, { idempotent: true });
  } catch (error) {
    console.error(`Failed to remove downloaded Jitai font ${fontId}:`, error);
  }

  const nextManifest = manifestFonts.filter((font) => font.id !== fontId);
  await writeDownloadedFontManifest(nextManifest);
  return true;
}
