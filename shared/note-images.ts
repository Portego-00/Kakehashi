/** Image references travel with the existing note string on both clients. */
export function normalizeNoteImageUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed) || /[\u0000-\u001f\u007f]/.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (!url.hostname || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function unescapeAttribute(value: string) {
  return value.replace(/&(amp|quot|lt|gt);/g, (entity) => ({
    "&amp;": "&", "&quot;": '"', "&lt;": "<", "&gt;": ">",
  })[entity]!);
}

export function splitNoteImages(note: string): { text: string; images: string[] } {
  const images: string[] = [];
  // Recognize only our inert image syntax, leaving other/literal markup intact.
  const text = note.replace(/(?:\r?\n)?<img src="([^"]*)"\s*\/?\s*>/g, (tag, source: string) => {
    const url = normalizeNoteImageUrl(unescapeAttribute(source));
    if (!url) return tag;
    images.push(url);
    return "";
  });
  return { text, images };
}

export function joinNoteImages(text: string, images: readonly string[]): string {
  const tags = images.map((image) => {
    const url = normalizeNoteImageUrl(image);
    if (!url) throw new Error("Use a complete http:// or https:// image URL.");
    return `<img src="${escapeAttribute(url)}">`;
  });
  return [text, ...tags].filter((part) => part !== "").join("\n");
}
