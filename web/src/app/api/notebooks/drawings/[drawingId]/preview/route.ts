import { NextRequest } from "next/server";
import { readNotebookDrawingPreview } from "@/lib/server/notebook-drawings-server";
import { drawingFailure, drawingResponseHeaders, webDrawingIdentity } from "@/lib/server/notebook-drawing-api";

export const runtime = "nodejs";
export async function GET(request: NextRequest, context: { params: Promise<{ drawingId: string }> }) {
  try {
    const user = await webDrawingIdentity(request);
    const { drawingId } = await context.params;
    const appearance = request.nextUrl.searchParams.get("appearance") === "dark" ? "dark" : "light";
    const preview = await readNotebookDrawingPreview(user.id, drawingId, appearance);
    return new Response(new Uint8Array(preview), { headers: { ...drawingResponseHeaders(false), "Content-Type": "image/png", "Content-Length": String(preview.length), "Content-Disposition": "inline" } });
  } catch (cause) { return drawingFailure(cause, false); }
}
