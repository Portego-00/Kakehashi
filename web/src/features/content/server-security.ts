import "server-only";

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const requestUrl = new URL(request.url);
    const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || requestUrl.protocol.replace(":", "");
    return new URL(origin).origin === `${protocol}://${host}`;
  }
  catch { return false; }
}

type ReadableBody = Pick<Response, "body" | "headers">;

export async function readBoundedText(response: ReadableBody, maxBytes: number) {
  const length = Number(response.headers.get("content-length") || 0);
  if (length > maxBytes) throw new Error("The remote response is too large.");
  if (!response.body) return "";
  const reader = response.body.getReader();
  let received = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) { await reader.cancel(); throw new Error("The remote response is too large."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const headerCharset = response.headers.get("content-type")?.match(/charset\s*=\s*["']?([^;\s"']+)/i)?.[1];
  const prefix = new TextDecoder("latin1").decode(bytes.slice(0, 4096));
  const documentCharset = prefix.match(/(?:charset\s*=\s*["']?|encoding\s*=\s*["'])([\w-]+)/i)?.[1];
  const charset = headerCharset || documentCharset || "utf-8";
  try { return new TextDecoder(charset).decode(bytes); }
  catch { return new TextDecoder("utf-8").decode(bytes); }
}

export async function readBoundedJson(response: ReadableBody, maxBytes: number): Promise<unknown> {
  const text = await readBoundedText(response, maxBytes);
  return text ? JSON.parse(text) : null;
}

export async function readBoundedRequestJson(request: Request, maxBytes: number): Promise<unknown> {
  return readBoundedJson(request, maxBytes);
}
