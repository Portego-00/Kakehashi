import { NextResponse } from "next/server";

const API_BASE = "https://apiv2.immersionkit.com";
const MEDIA_BASE = "https://us-southeast-1.linodeobjects.com/immersionkit/media";

type RawExample = { id?: string; sentence?: string; translation?: string; title?: string; sound?: string; image?: string };
type IndexMeta = Record<string, { title?: string; category?: string }>;
let indexMetaPromise: Promise<IndexMeta> | null = null;

function getIndexMeta() {
  indexMetaPromise ??= fetch(`${API_BASE}/index_meta`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12_000), next: { revalidate: 86_400 } })
    .then((response) => response.ok ? response.json() : { data: {} })
    .then((payload: { data?: IndexMeta }) => payload.data ?? {})
    .catch(() => ({}));
  return indexMetaPromise;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { query?: unknown; sources?: unknown };
    if (typeof body.query !== "string" || !body.query.trim() || body.query.length > 16) return NextResponse.json({ error: "Invalid query." }, { status: 400 });
    const sourceValues = Array.isArray(body.sources) ? body.sources.filter((value): value is string => typeof value === "string").slice(0, 100) : [];
    if (sourceValues.includes("!")) return NextResponse.json({ example: null });
    const sources = sourceValues.includes("*") ? new Set<string>() : new Set(sourceValues.filter((value) => value !== "!"));
    const url = `${API_BASE}/search?q=${encodeURIComponent(body.query.trim())}&exactMatch=true&limit=40&offset=0`;
    const [response, indexMeta] = await Promise.all([fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12_000), cache: "no-store" }), getIndexMeta()]);
    if (!response.ok) return NextResponse.json({ error: `ImmersionKit returned ${response.status}.` }, { status: 502 });
    const payload = await response.json() as { examples?: RawExample[] };
    const candidates = (payload.examples ?? []).filter((item) => item.sentence && item.translation && item.title && (!sources.size || sources.has(item.title)));
    const seen = new Set<string>();
    const examples = candidates.flatMap((candidate) => {
      if (!candidate.sentence || !candidate.translation || !candidate.title) return [];
      const dedupeKey = `${candidate.title}\u0000${candidate.sentence}\u0000${candidate.sound ?? ""}`;
      if (seen.has(dedupeKey)) return [];
      seen.add(dedupeKey);
      const meta = indexMeta[candidate.title];
      const category = meta?.category ?? candidate.id?.match(/^(anime|drama|games|literature|news)_/)?.[1] ?? "anime";
      if (category !== "anime") return [];
      const folder = encodeURIComponent(meta?.title ?? candidate.title);
      const base = `${MEDIA_BASE}/${category}/${folder}/media`;
      return [{ sentence: candidate.sentence, translation: candidate.translation, title: meta?.title ?? candidate.title, audio: candidate.sound ? `${base}/${encodeURIComponent(candidate.sound)}` : undefined, imageUrl: candidate.image ? `${base}/${encodeURIComponent(candidate.image)}` : undefined }];
    });
    return NextResponse.json({ examples, example: examples[0] ?? null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Immersion lookup failed." }, { status: 502 });
  }
}
