export type JapaneseVoiceWorkerRequest =
  | { id: string; type: "prepare" }
  | { id: string; type: "synthesize"; text: string };

export type JapaneseVoiceWorkerResponse =
  | { id: string; type: "progress"; message: string; progress: number }
  | { id: string; type: "ready" }
  | { id: string; type: "audio"; samples: ArrayBuffer; sampleRate: number }
  | { id: string; type: "error"; message: string };

