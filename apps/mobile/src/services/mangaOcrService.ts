import { File } from "expo-file-system";
import { Image } from "react-native";
import { filterJapaneseText, performOcr } from "../utils/ocr";

export interface MangaOcrPoint {
  x: number;
  y: number;
}

export interface MangaOcrBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MangaOcrRegion {
  id: string;
  text: string;
  box: MangaOcrBoundingBox;
  polygon: MangaOcrPoint[];
  vertical: boolean;
}

export interface MangaOcrPageResult {
  page: number;
  totalPages?: number;
  imageWidth: number;
  imageHeight: number;
  regions: MangaOcrRegion[];
  renderedImageBase64?: string;
}

export interface MangaPdfMetadata {
  totalPages: number;
  coverImageBase64?: string;
}

type ImageDimensions = {
  width: number;
  height: number;
};

function normalizePositiveNumber(value: unknown, fallback = 0): number {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return fallback;
  }
  return numericValue;
}

function clampNonNegativeNumber(value: unknown): number {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0;
  }
  return numericValue;
}

function getImageDimensions(imageUri: string): Promise<ImageDimensions> {
  return new Promise((resolve) => {
    Image.getSize(
      imageUri,
      (width, height) => {
        resolve({
          width: Math.max(1, Math.floor(width || 1)),
          height: Math.max(1, Math.floor(height || 1)),
        });
      },
      () => {
        resolve({ width: 1, height: 1 });
      }
    );
  });
}

function createRectanglePolygon(box: MangaOcrBoundingBox): MangaOcrPoint[] {
  return [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ];
}

function mapDetectedRegionToMangaRegion(
  detectedRegion: {
    text: string;
    frame: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  },
  index: number
): MangaOcrRegion | null {
  const text = filterJapaneseText(detectedRegion.text || "").trim();
  if (!text) {
    return null;
  }

  const box: MangaOcrBoundingBox = {
    x: clampNonNegativeNumber(detectedRegion.frame.x),
    y: clampNonNegativeNumber(detectedRegion.frame.y),
    width: normalizePositiveNumber(detectedRegion.frame.width, 0),
    height: normalizePositiveNumber(detectedRegion.frame.height, 0),
  };

  if (box.width <= 0 || box.height <= 0) {
    return null;
  }

  return {
    id: `region-${(index + 1).toString().padStart(4, "0")}`,
    text,
    box,
    polygon: createRectanglePolygon(box),
    vertical: box.height > box.width * 1.15,
  };
}

export const mangaOcrService = {
  async ocrImageFile(file: File): Promise<MangaOcrPageResult> {
    const imageUri = file.uri;
    const [ocrResult, imageDimensions] = await Promise.all([
      performOcr(imageUri),
      getImageDimensions(imageUri),
    ]);

    const regions = ocrResult.regions
      .map((detectedRegion, index) =>
        mapDetectedRegionToMangaRegion(detectedRegion, index)
      )
      .filter((region): region is MangaOcrRegion => region !== null);

    return {
      page: 1,
      imageWidth: imageDimensions.width,
      imageHeight: imageDimensions.height,
      regions,
    };
  },

  async ocrPdfPage(_file: File, _page: number): Promise<MangaOcrPageResult> {
    throw new Error(
      "PDF OCR is not available in on-device mode yet. Import a CBZ file or an image folder."
    );
  },

  async getPdfMetadata(_file: File): Promise<MangaPdfMetadata | null> {
    return null;
  },
};
