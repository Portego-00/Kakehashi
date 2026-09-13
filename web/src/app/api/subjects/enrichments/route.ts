import { NextResponse } from "next/server";
import { getSubjectEnrichments } from "@/features/subjects/server-enrichments";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { id?: unknown; level?: unknown; characters?: unknown; readings?: unknown };
    const id = Number(body.id);
    const level = Number(body.level);
    const characters = typeof body.characters === "string" ? body.characters.trim() : "";
    const readings = Array.isArray(body.readings) ? body.readings.filter((reading): reading is string => typeof reading === "string" && reading.length <= 64).slice(0, 32) : [];
    if (!Number.isInteger(id) || id < 1 || !Number.isInteger(level) || level < 1 || level > 60 || !characters || characters.length > 64) {
      return NextResponse.json({ error: "Invalid subject." }, { status: 400 });
    }
    return NextResponse.json(getSubjectEnrichments({ id, level, characters, readings }), { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } });
  } catch {
    return NextResponse.json({ error: "Subject enrichments are unavailable." }, { status: 400 });
  }
}
