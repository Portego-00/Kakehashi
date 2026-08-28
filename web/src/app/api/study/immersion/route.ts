import { NextResponse } from "next/server";
import {
  buildImmersionExamples,
  IMMERSION_KIT_API_BASE,
  immersionKitSearchUrl,
  type ImmersionKitIndexMeta,
  type ImmersionKitSearchPayload,
} from "@/features/study/immersion-kit";

let indexMetaPromise: Promise<ImmersionKitIndexMeta> | null = null;

function getIndexMeta() {
  indexMetaPromise ??= fetch(`${IMMERSION_KIT_API_BASE}/index_meta`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12_000), next: { revalidate: 86_400 } })
    .then((response) => response.ok ? response.json() : { data: {} })
    .then((payload: { data?: ImmersionKitIndexMeta }) => payload.data ?? {})
    .catch(() => ({}));
  return indexMetaPromise;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { query?: unknown; sources?: unknown };
    if (typeof body.query !== "string" || !body.query.trim() || body.query.length > 16) return NextResponse.json({ error: "Invalid query." }, { status: 400 });
    const sourceValues = Array.isArray(body.sources) ? body.sources.filter((value): value is string => typeof value === "string").slice(0, 100) : [];
    if (sourceValues.includes("!")) return NextResponse.json({ example: null });
    const url = immersionKitSearchUrl(body.query.trim());
    const [response, indexMeta] = await Promise.all([fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12_000), cache: "no-store" }), getIndexMeta()]);
    if (!response.ok) {
      const rateLimited = response.status === 429;
      const retryAfter = response.headers.get("Retry-After");
      return NextResponse.json(
        { error: `ImmersionKit returned ${response.status}.` },
        { status: rateLimited ? 429 : 502, headers: rateLimited && retryAfter ? { "Retry-After": retryAfter } : undefined },
      );
    }
    const payload = await response.json() as ImmersionKitSearchPayload;
    const examples = buildImmersionExamples(payload.examples, indexMeta, sourceValues);
    return NextResponse.json({ examples, example: examples[0] ?? null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Immersion lookup failed." }, { status: 502 });
  }
}
