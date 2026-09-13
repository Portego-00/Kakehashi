export type JapaneseVoiceWorkerRequest = { id: string; type: "synthesize"; text: string; speed: number };

export type JapaneseVoiceWorkerResponse =
  | { id: string; type: "progress"; message: string; progress: number }
  | { id: string; type: "audio"; samples: ArrayBuffer; sampleRate: number }
  | { id: string; type: "error"; message: string };
