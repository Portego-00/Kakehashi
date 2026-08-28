import { loadFileHandle } from "./storage";
import type { ContentRecord } from "./types";

export interface LocalFileSelection {
  file: File;
  handle: FileSystemFileHandle;
}

export interface LinkedFilePickerOptions {
  multiple?: boolean;
  description?: string;
  accept?: Record<string, readonly string[]>;
}

type FileSystemPermissionHandle = FileSystemFileHandle & {
  queryPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
};

type LinkedFilePickerWindow = Window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  }) => Promise<FileSystemFileHandle[]>;
};

export type LinkedFileResolution =
  | { status: "ready"; file: File; handle: FileSystemFileHandle }
  | { status: "permission"; handle: FileSystemFileHandle }
  | { status: "missing" }
  | { status: "unavailable"; error: Error };

export type LinkedFilePermissionResult =
  | { status: "granted" }
  | { status: "permission" }
  | { status: "unavailable"; error: Error };

function errorName(error: unknown) {
  if (typeof error !== "object" || error === null || !("name" in error)) return "";
  return String(error.name);
}

function asError(error: unknown) {
  if (error instanceof Error) return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    const normalized = new Error(String(error.message));
    normalized.name = errorName(error) || "Error";
    return normalized;
  }
  return new Error("The linked file is temporarily unavailable.");
}

function normalizedLinkedFileIds(ids: readonly unknown[]) {
  return [...new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0))];
}

export function supportsLinkedLocalFiles() {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") return false;
  return typeof (window as LinkedFilePickerWindow).showOpenFilePicker === "function";
}

export async function openLinkedFilePicker(options: LinkedFilePickerOptions = {}): Promise<LocalFileSelection[] | null> {
  if (!supportsLinkedLocalFiles()) return null;
  const picker = (window as LinkedFilePickerWindow).showOpenFilePicker;
  if (!picker) return null;

  const pickerOptions: Parameters<NonNullable<LinkedFilePickerWindow["showOpenFilePicker"]>>[0] = {
    multiple: options.multiple ?? false,
  };
  const acceptedTypes: Record<string, string[]> = {};
  for (const [mimeType, extensions] of Object.entries(options.accept ?? {})) acceptedTypes[mimeType] = [...extensions];
  if (Object.keys(acceptedTypes).length > 0) {
    pickerOptions.types = [{
      description: options.description,
      accept: acceptedTypes,
    }];
  }

  let handles: FileSystemFileHandle[];
  try {
    handles = await picker.call(window, pickerOptions);
  } catch (error) {
    if (errorName(error) === "AbortError") return [];
    throw error;
  }
  return Promise.all(handles.map(async (handle) => ({ handle, file: await handle.getFile() })));
}

export async function requestLinkedFilePermission(handle: FileSystemFileHandle): Promise<LinkedFilePermissionResult> {
  const permissionHandle = handle as FileSystemPermissionHandle;
  if (!permissionHandle.requestPermission) return { status: "permission" };
  try {
    const permission = await permissionHandle.requestPermission({ mode: "read" });
    return permission === "granted" ? { status: "granted" } : { status: "permission" };
  } catch (error) {
    if (["AbortError", "NotAllowedError", "SecurityError"].includes(errorName(error))) return { status: "permission" };
    return { status: "unavailable", error: asError(error) };
  }
}

export async function resolveLinkedFile(id: string, options: { requestPermission?: boolean } = {}): Promise<LinkedFileResolution> {
  let handle: FileSystemFileHandle | null;
  try {
    handle = await loadFileHandle(id);
  } catch (error) {
    return { status: "unavailable", error: asError(error) };
  }
  if (!handle) return { status: "missing" };

  const permissionHandle = handle as FileSystemPermissionHandle;
  if (permissionHandle.queryPermission) {
    let permission: PermissionState;
    try {
      permission = await permissionHandle.queryPermission({ mode: "read" });
    } catch (error) {
      if (["NotAllowedError", "SecurityError"].includes(errorName(error))) return { status: "permission", handle };
      return { status: "unavailable", error: asError(error) };
    }

    if (permission !== "granted") {
      if (!options.requestPermission) return { status: "permission", handle };
      const requested = await requestLinkedFilePermission(handle);
      if (requested.status === "permission") return { status: "permission", handle };
      if (requested.status === "unavailable") return requested;
    }
  }

  try {
    return { status: "ready", file: await handle.getFile(), handle };
  } catch (error) {
    const name = errorName(error);
    if (name === "NotFoundError") return { status: "missing" };
    if (name === "NotAllowedError" || name === "SecurityError") return { status: "permission", handle };
    return { status: "unavailable", error: asError(error) };
  }
}

export async function requestPersistentLocalStorage() {
  if (typeof navigator === "undefined" || typeof navigator.storage?.persist !== "function") return false;
  try {
    if (typeof navigator.storage.persisted === "function" && await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export function linkedFileIds(record: Pick<ContentRecord, "metadata"> | null | undefined) {
  const serializedIds = record?.metadata?.linkedFileIds;
  if (typeof serializedIds !== "string") return [];
  try {
    const parsed = JSON.parse(serializedIds) as unknown;
    return Array.isArray(parsed) ? normalizedLinkedFileIds(parsed) : [];
  } catch {
    return [];
  }
}

export function linkedMetadata(ids: readonly string[]) {
  return { linkedFileIds: JSON.stringify(normalizedLinkedFileIds(ids)) };
}
