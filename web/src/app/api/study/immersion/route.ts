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
    const sources = Array.isArray(body.sources) ? new Set(body.sources.filter((value): value is string => typeof value === "string").slice(0, 20)) : new Set<string>();
    const url = `${API_BASE}/search?q=${encodeURIComponent(body.query.trim())}&exactMatch=true&limit=40&offset=0`;
    const [response, indexMeta] = await Promise.all([fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12_000), cache: "no-store" }), getIndexMeta()]);
    if (!response.ok) return NextResponse.json({ error: `ImmersionKit returned ${response.status}.` }, { status: 502 });
    const payload = await response.json() as { examples?: RawExample[] };
    const candidates = (payload.examples ?? []).filter((item) => item.sentence && item.translation && item.title && (!sources.size || sources.has(item.title)));
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    if (!picked?.sentence || !picked.translation || !picked.title) return NextResponse.json({ example: null });
    const meta = indexMeta[picked.title];
    const category = meta?.category ?? picked.id?.match(/^(anime|drama|games|literature|news)_/)?.[1] ?? "anime";
    const folder = encodeURIComponent(meta?.title ?? picked.title);
    const base = `${MEDIA_BASE}/${category}/${folder}/media`;
    return NextResponse.json({ example: { sentence: picked.sentence, translation: picked.translation, title: meta?.title ?? picked.title, audio: picked.sound ? `${base}/${encodeURIComponent(picked.sound)}` : undefined, imageUrl: picked.image ? `${base}/${encodeURIComponent(picked.image)}` : undefined } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Immersion lookup failed." }, { status: 502 });
  }
}
