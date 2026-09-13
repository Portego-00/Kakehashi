import { NextResponse } from "next/server";
import { getAnimeCatalog } from "@/features/anime/server";

export async function GET() {
  const anime = await getAnimeCatalog();
  return NextResponse.json({ anime }, { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } });
}
