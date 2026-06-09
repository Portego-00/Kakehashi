import * as FileSystem from "expo-file-system";

import { supabase } from "../lib/supabase";

export type UploadableIssueMedia = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  type?: string | null;
};

export type UploadedIssueMedia = {
  url: string;
  mediaType: "image" | "video";
  sizeBytes: number | null;
};

export const ISSUE_MEDIA_MAX_BYTES = 10 * 1024 * 1024;
export const ISSUE_MEDIA_TOO_LARGE_ERROR = "ISSUE_MEDIA_TOO_LARGE";
export const ISSUE_MEDIA_BUCKET_NOT_FOUND_ERROR = "ISSUE_MEDIA_BUCKET_NOT_FOUND";

const CONFIGURED_ISSUE_MEDIA_BUCKET =
  process.env.EXPO_PUBLIC_SUPABASE_ISSUE_MEDIA_BUCKET?.trim() ?? "";
const ISSUE_MEDIA_BUCKET_CANDIDATES = Array.from(
  new Set(
    [
      CONFIGURED_ISSUE_MEDIA_BUCKET,
      "issue-media",
      "issues-media",
      "issues",
    ].filter(Boolean)
  )
);

function normalizeExtension(extension: string) {
  return extension.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function getExtensionFromMimeType(mimeType?: string | null): string | null {
  if (!mimeType) return null;
  const slashIndex = mimeType.indexOf("/");
  if (slashIndex === -1 || slashIndex === mimeType.length - 1) return null;

  const rawExtension = mimeType.slice(slashIndex + 1).split(";")[0];
  if (!rawExtension) return null;

  if (rawExtension === "jpeg") return "jpg";
  if (rawExtension === "quicktime") return "mov";
  if (rawExtension === "x-m4v") return "m4v";
  return normalizeExtension(rawExtension);
}

function getExtensionFromName(fileName?: string | null): string | null {
  if (!fileName) return null;
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === fileName.length - 1) return null;
  return normalizeExtension(fileName.slice(dotIndex + 1));
}

function inferMediaType(media: UploadableIssueMedia): "image" | "video" {
  if (media.type === "video") return "video";
  if (media.mimeType?.startsWith("video/")) return "video";
  return "image";
}

function inferContentType(
  mediaType: "image" | "video",
  mimeType?: string | null
): string {
  if (mimeType) return mimeType;
  return mediaType === "video" ? "video/mp4" : "image/jpeg";
}

function createStoragePath(media: UploadableIssueMedia, mediaType: "image" | "video") {
  const extension =
    getExtensionFromMimeType(media.mimeType) ||
    getExtensionFromName(media.fileName) ||
    (mediaType === "video" ? "mp4" : "jpg");
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `issues/${mediaType}/${timestamp}-${randomPart}.${extension}`;
}

async function resolveMediaSizeBytes(media: UploadableIssueMedia) {
  if (typeof media.fileSize === "number" && Number.isFinite(media.fileSize)) {
    return media.fileSize;
  }

  try {
    const info = await FileSystem.getInfoAsync(media.uri);
    if ("size" in info && typeof info.size === "number") {
      return info.size;
    }
  } catch (error) {
    console.warn("Could not read selected media size:", error);
  }

  return null;
}

function createIssueMediaTooLargeError() {
  const error = new Error(
    `Selected file exceeds the ${ISSUE_MEDIA_MAX_BYTES} byte upload limit.`
  ) as Error & { code?: string };
  error.code = ISSUE_MEDIA_TOO_LARGE_ERROR;
  return error;
}

function isBucketNotFoundStorageError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message = String((error as { message?: unknown }).message ?? "").toLowerCase();
  const code = String((error as { statusCode?: unknown }).statusCode ?? "");
  return message.includes("bucket not found") || code === "404";
}

function createIssueMediaBucketNotFoundError() {
  const configuredPart = CONFIGURED_ISSUE_MEDIA_BUCKET
    ? ` (configured via EXPO_PUBLIC_SUPABASE_ISSUE_MEDIA_BUCKET="${CONFIGURED_ISSUE_MEDIA_BUCKET}")`
    : "";
  const candidates = ISSUE_MEDIA_BUCKET_CANDIDATES.join(", ");
  const error = new Error(
    `Supabase storage bucket not found${configuredPart}. Tried buckets: ${candidates}.`
  ) as Error & { code?: string };
  error.code = ISSUE_MEDIA_BUCKET_NOT_FOUND_ERROR;
  return error;
}

export function isIssueMediaTooLargeError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  return (
    (error as { code?: unknown }).code === ISSUE_MEDIA_TOO_LARGE_ERROR
  );
}

export function isIssueMediaBucketNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  return (
    (error as { code?: unknown }).code === ISSUE_MEDIA_BUCKET_NOT_FOUND_ERROR
  );
}

export const imageUploadService = {
  async getMediaSizeBytes(media: UploadableIssueMedia): Promise<number | null> {
    return resolveMediaSizeBytes(media);
  },

  async uploadMedia(media: UploadableIssueMedia): Promise<UploadedIssueMedia> {
    const mediaType = inferMediaType(media);
    const contentType = inferContentType(mediaType, media.mimeType);
    const filePath = createStoragePath(media, mediaType);
    const fileSize = await resolveMediaSizeBytes(media);

    if (
      typeof fileSize === "number" &&
      Number.isFinite(fileSize) &&
      fileSize > ISSUE_MEDIA_MAX_BYTES
    ) {
      throw createIssueMediaTooLargeError();
    }

    const fileResponse = await fetch(media.uri);
    const arrayBuffer = await fileResponse.arrayBuffer();
    const uploadSize = arrayBuffer.byteLength;

    if (uploadSize > ISSUE_MEDIA_MAX_BYTES) {
      throw createIssueMediaTooLargeError();
    }

    let uploadBucket: string | null = null;
    let uploadError: unknown = null;

    for (const bucket of ISSUE_MEDIA_BUCKET_CANDIDATES) {
      const { error } = await supabase.storage.from(bucket).upload(filePath, arrayBuffer, {
        cacheControl: "3600",
        contentType,
        upsert: false,
      });

      if (!error) {
        uploadBucket = bucket;
        uploadError = null;
        break;
      }

      if (isBucketNotFoundStorageError(error)) {
        uploadError = error;
        continue;
      }

      throw error;
    }

    if (!uploadBucket) {
      throw createIssueMediaBucketNotFoundError();
    }

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
      .from(uploadBucket)
      .getPublicUrl(filePath);

    if (!publicUrlData?.publicUrl) {
      throw new Error("Failed to retrieve uploaded media URL.");
    }

    return {
      mediaType,
      sizeBytes: fileSize ?? uploadSize,
      url: publicUrlData.publicUrl,
    };
  },

  async uploadImage(uri: string): Promise<string> {
    const uploaded = await this.uploadMedia({ uri, type: "image" });
    return uploaded.url;
  },
};
