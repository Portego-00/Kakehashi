export type MangaOcrWorkerProgressStage = "preparing-model" | "recognizing";

export type MangaOcrProgress =
  | { stage: "downloading-model"; loadedBytes: number; totalBytes: number }
  | { stage: MangaOcrWorkerProgressStage };

export type MangaOcrWorkerRequest =
  | { type: "recognize"; id: string; pixels: Float32Array }
  | { type: "cancel"; id: string };

export type MangaOcrWorkerResponse =
  | { type: "progress"; id: string; stage: MangaOcrWorkerProgressStage }
  | { type: "result"; id: string; text: string }
  | { type: "error"; id: string; message: string };
