export const IMMERSION_KIT_API_BASE = "https://apiv2.immersionkit.com";

const IMMERSION_KIT_MEDIA_BASE = "https://us-southeast-1.linodeobjects.com/immersionkit/media";

export interface ImmersionExample {
  sentence: string;
  translation: string;
  title: string;
  audio?: string;
  imageUrl?: string;
}

export type ImmersionKitIndexMeta = Record<string, { title?: string; category?: string }>;

export interface ImmersionKitSearchPayload {
  examples?: unknown[];
}

export function immersionKitSearchUrl(query: string) {
  return `${IMMERSION_KIT_API_BASE}/search?q=${encodeURIComponent(query)}&exactMatch=true&limit=50&offset=0`;
}

export function buildImmersionExamples(rawExamples: unknown, indexMeta: ImmersionKitIndexMeta, sourceValues: readonly string[]): ImmersionExample[] {
  if (!Array.isArray(rawExamples)) return [];
  const sources = sourceValues.includes("*") ? new Set<string>() : new Set(sourceValues.filter((value) => value !== "!"));
  const seen = new Set<string>();
  const examples: ImmersionExample[] = [];

  for (const raw of rawExamples) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as Record<string, unknown>;
    const sentence = typeof candidate.sentence === "string" ? candidate.sentence : "";
    const translation = typeof candidate.translation === "string" ? candidate.translation : "";
    const sourceTitle = typeof candidate.title === "string" ? candidate.title : "";
    const sound = typeof candidate.sound === "string" ? candidate.sound : undefined;
    const image = typeof candidate.image === "string" ? candidate.image : undefined;
    const id = typeof candidate.id === "string" ? candidate.id : undefined;
    if (!sentence || !translation || !sourceTitle || (sources.size && !sources.has(sourceTitle))) continue;

    const dedupeKey = `${sourceTitle}\u0000${sentence}\u0000${sound ?? ""}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const meta = indexMeta[sourceTitle];
    const category = meta?.category ?? id?.match(/^(anime|drama|games|literature|news)_/)?.[1] ?? "anime";
    if (category !== "anime") continue;
    const title = meta?.title || sourceTitle;
    const mediaBase = `${IMMERSION_KIT_MEDIA_BASE}/${category}/${encodeURIComponent(title)}/media`;
    examples.push({
      sentence,
      translation,
      title,
      audio: sound ? `${mediaBase}/${encodeURIComponent(sound)}` : undefined,
      imageUrl: image ? `${mediaBase}/${encodeURIComponent(image)}` : undefined,
    });
  }

  return examples.sort((left, right) => left.sentence.length - right.sentence.length).slice(0, 50);
}
