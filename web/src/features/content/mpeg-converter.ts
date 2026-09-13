import type { FFmpeg as FFmpegInstance } from "@ffmpeg/ffmpeg";

type ProgressCallback = (progress: number) => void;

const CORE_URL = "/api/media-converter/ffmpeg-core.js";
const WASM_URL = "/api/media-converter/ffmpeg-core.wasm";
const WORKER_URL = "/api/media-converter/ffmpeg-worker.js";

let ffmpegPromise: Promise<FFmpegInstance> | null = null;
let conversionQueue: Promise<void> = Promise.resolve();

async function loadFfmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = import("@ffmpeg/ffmpeg").then(async ({ FFmpeg }) => {
      const ffmpeg = new FFmpeg();
      const appUrl = (path: string) => new URL(path, window.location.origin).toString();
      await ffmpeg.load({
        classWorkerURL: appUrl(WORKER_URL),
        coreURL: appUrl(CORE_URL),
        wasmURL: appUrl(WASM_URL),
      });
      return ffmpeg;
    }).catch((error) => {
      ffmpegPromise = null;
      throw error;
    });
  }
  return ffmpegPromise;
}

async function runTranscode(source: Blob, onProgress: ProgressCallback) {
  const ffmpeg = await loadFfmpeg();
  const token = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const inputPath = `input-${token}.mpeg`;
  const outputPath = `output-${token}.mp4`;
  const reportProgress = ({ progress }: { progress: number }) => {
    onProgress(Math.max(0, Math.min(1, progress)));
  };

  ffmpeg.on("progress", reportProgress);
  onProgress(0);
  try {
    await ffmpeg.writeFile(inputPath, new Uint8Array(await source.arrayBuffer()));
    const exitCode = await ffmpeg.exec([
      "-i", inputPath,
      "-map", "0:v:0",
      "-map", "0:a:0?",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-pix_fmt", "yuv420p",
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
      "-c:a", "aac",
      "-movflags", "+faststart",
      outputPath,
    ]);
    if (exitCode !== 0) throw new Error(`MPEG conversion stopped with code ${exitCode}.`);
    const output = await ffmpeg.readFile(outputPath);
    if (typeof output === "string") throw new Error("MPEG conversion produced an invalid video.");
    onProgress(1);
    return new Blob([new Uint8Array(output)], { type: "video/mp4" });
  } finally {
    ffmpeg.off("progress", reportProgress);
    await Promise.allSettled([
      ffmpeg.deleteFile(inputPath),
      ffmpeg.deleteFile(outputPath),
    ]);
  }
}

export function transcodeMpegToMp4(source: Blob, onProgress: ProgressCallback): Promise<Blob> {
  const conversion = conversionQueue.then(() => runTranscode(source, onProgress));
  conversionQueue = conversion.then(() => undefined, () => undefined);
  return conversion;
}
