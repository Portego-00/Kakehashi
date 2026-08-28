import { prepareMangaImport, type MangaImportSource } from "./manga-import";
import { linkedFileIds, resolveLinkedFile } from "./local-file-source";
import type { ContentRecord } from "./types";

export type LinkedMangaSourceResult =
  | { status: "not-linked" }
  | { status: "permission"; handle: FileSystemFileHandle }
  | { status: "missing" }
  | { status: "unavailable"; error: Error }
  | { status: "ready"; kind: "pdf"; file: File }
  | { status: "ready"; kind: "pages"; pages: File[] };

function mangaSource(record: ContentRecord): MangaImportSource {
  const source = record.metadata?.sourceType;
  if (source === "cbz" || source === "epub" || source === "images" || source === "pdf") return source;
  return record.metadata?.isPdf ? "pdf" : "images";
}

export async function resolveLinkedMangaSource(record: ContentRecord): Promise<LinkedMangaSourceResult> {
  const ids = linkedFileIds(record);
  if (!ids.length) return { status: "not-linked" };

  const resolved = await Promise.all(ids.map((id) => resolveLinkedFile(id)));

  if (resolved.some((result) => result.status === "missing")) return { status: "missing" };
  const unavailable = resolved.find((result) => result.status === "unavailable");
  if (unavailable?.status === "unavailable") return { status: "unavailable", error: unavailable.error };
  const permission = resolved.find((result) => result.status === "permission");
  if (permission?.status === "permission") return { status: "permission", handle: permission.handle };

  const files = resolved.flatMap((result) => result.status === "ready" ? [result.file] : []);
  if (files.length !== ids.length) return { status: "unavailable", error: new Error("The linked manga files could not be opened.") };

  const source = mangaSource(record);
  if (source === "pdf") return { status: "ready", kind: "pdf", file: files[0] };
  if (source === "images") return { status: "ready", kind: "pages", pages: files };

  try {
    const prepared = await prepareMangaImport([files[0]]);
    return { status: "ready", kind: "pages", pages: prepared.assets };
  } catch (error) {
    return {
      status: "unavailable",
      error: error instanceof Error ? error : new Error("The linked manga archive could not be opened."),
    };
  }
}
