import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { browserSherpaGlue } from "@/features/speech/sherpa-browser-runtime";
export const runtime = "nodejs";
const root = join(process.cwd(), "node_modules");
const sherpa = join(root, "sherpa-onnx");
const headers = (type: string) => ({
  "Content-Type": type,
  "Cache-Control": "public, max-age=31536000, immutable",
});
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ asset: string }> },
) {
  const { asset } = await params;
  if (asset === "silero-v5.onnx") {
    const response = await fetch(
      "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx",
      { cache: "force-cache", credentials: "omit" },
    );
    if (!response.ok)
      return new Response("Speech detector download unavailable", {
        status: 502,
      });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (
      bytes.length !== 643_854 ||
      createHash("sha256").update(bytes).digest("hex") !==
        "9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6"
    )
      return new Response("Speech detector integrity check failed", {
        status: 502,
      });
    return new Response(bytes, {
      headers: {
        ...headers("application/octet-stream"),
        "Content-Length": String(bytes.length),
      },
    });
  }
  if (asset === "sherpa-1.13.8.js") {
    const [source, path] = await Promise.all([
      readFile(join(sherpa, "sherpa-onnx-wasm-nodejs.js"), "utf8"),
      readFile(join(root, "path-browserify", "index.js"), "utf8"),
    ]);
    return new Response(browserSherpaGlue(source, path), {
      headers: headers("text/javascript; charset=utf-8"),
    });
  }
  if (asset === "sherpa-1.13.8.wasm") {
    const path = join(sherpa, "sherpa-onnx-wasm-nodejs.wasm");
    const details = await stat(path);
    return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream, {
      headers: { ...headers("application/wasm"), "Content-Length": String(details.size) },
    });
  }
  if (asset === "asr-1.13.8.js" || asset === "vad-1.13.8.js") {
    const name = asset.startsWith("asr") ? "asr" : "vad";
    const source = await readFile(
      join(sherpa, `sherpa-onnx-${name}.js`),
      "utf8",
    );
    return new Response(
      `(function(){\n${source}\nself.Review${name === "asr" ? "Recognizer=OfflineRecognizer" : "Vad=Vad"};\n})();`,
      { headers: headers("text/javascript; charset=utf-8") },
    );
  }
  return new Response("Not found", { status: 404 });
}
