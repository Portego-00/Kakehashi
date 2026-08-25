import { NextResponse } from "next/server";
import { getNewsFeed } from "@/features/content/news-source";

export async function GET() {
  try { return NextResponse.json(await getNewsFeed(), { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "News is unavailable." }, { status: 503 }); }
}
