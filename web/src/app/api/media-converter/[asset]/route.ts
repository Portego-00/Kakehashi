import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";

export const runtime = "nodejs";

const coreDirectory = join(process.cwd(), "node_modules", "@ffmpeg", "core", "dist", "esm");
const ffmpegDirectory = join(process.cwd(), "node_modules", "@ffmpeg", "ffmpeg", "dist", "esm");
const ASSETS = {
  "ffmpeg-core.js": {
    contentType: "text/javascript; charset=utf-8",
    path: join(coreDirectory, "ffmpeg-core.js"),
  },
  "ffmpeg-core.wasm": {
    contentType: "application/wasm",
    path: join(coreDirectory, "ffmpeg-core.wasm"),
  },
  "ffmpeg-worker.js": {
    contentType: "text/javascript; charset=utf-8",
    path: join(ffmpegDirectory, "worker.js"),
  },
  "const.js": {
    contentType: "text/javascript; charset=utf-8",
    path: join(ffmpegDirectory, "const.js"),
  },
  "errors.js": {
    contentType: "text/javascript; charset=utf-8",
    path: join(ffmpegDirectory, "errors.js"),
  },
} as const;

type ConverterAsset = keyof typeof ASSETS;

function isConverterAsset(value: string): value is ConverterAsset {
  return Object.hasOwn(ASSETS, value);
}

export async function GET(_request: Request, context: { params: Promise<{ asset: string }> }) {
  const { asset } = await context.params;
  if (!isConverterAsset(asset)) return new Response("Not found", { status: 404 });

  const selected = ASSETS[asset];
  const details = await stat(/* turbopackIgnore: true */ selected.path);
  const stream = Readable.toWeb(createReadStream(/* turbopackIgnore: true */ selected.path)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(details.size),
      "Content-Type": selected.contentType,
    },
  });
}
