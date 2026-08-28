import { NextResponse } from "next/server";
import { getNewsFeed } from "@/features/content/news-source";
import type { NewsSourcePreference } from "@/features/content/types";

function requestedSource(request: Request): NewsSourcePreference | null {
  const source = new URL(request.url).searchParams.get("source") || "easy";
  return source === "easy" || source === "regular" || source === "both" ? source : null;
}

export async function GET(request: Request) {
  const source = requestedSource(request);
  if (!source) return NextResponse.json({ error: "News source must be easy, regular, or both." }, { status: 400 });
  let payload: Awaited<ReturnType<typeof getNewsFeed>>;
  try {
    payload = await getNewsFeed(source);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "News is unavailable." }, { status: 503 });
  }
  return NextResponse.json(payload, { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } });
}
