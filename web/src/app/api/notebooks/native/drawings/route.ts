import { NextRequest } from "next/server";
import { saveNotebookDrawing } from "@/lib/server/notebook-drawings-server";
import { drawingFailure, drawingResponse, nativeDrawingIdentity, readDrawingUploadBody } from "@/lib/server/notebook-drawing-api";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const user = await nativeDrawingIdentity(request, "write");
    const payload = await readDrawingUploadBody(request);
    request.signal.throwIfAborted();
    const drawing = await saveNotebookDrawing(user.id, payload, request.headers.get("X-Notebook-Features"));
    return drawingResponse({ accountId: user.id, ...drawing });
  } catch (cause) { return drawingFailure(cause); }
}
