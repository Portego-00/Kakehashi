import { NextRequest } from "next/server";
import { readNotebookDrawing } from "@/lib/server/notebook-drawings-server";
import { drawingFailure, drawingResponse, nativeDrawingIdentity } from "@/lib/server/notebook-drawing-api";

export const runtime = "nodejs";
export async function GET(request: NextRequest, context: { params: Promise<{ drawingId: string }> }) {
  try {
    const user = await nativeDrawingIdentity(request, "read");
    const { drawingId } = await context.params;
    return drawingResponse({ accountId: user.id, ...await readNotebookDrawing(user.id, drawingId, request.headers.get("X-Notebook-Features")) });
  } catch (cause) { return drawingFailure(cause); }
}
