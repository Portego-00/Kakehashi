export type AsrLanguage = "ja" | "en";
export type JapaneseAsrRequest = { language: AsrLanguage } & ({ id: number; type: "prepare" } | { id: number; type: "recognize"; samples: Float32Array });
export type JapaneseAsrResponse = { id: number; text?: string; error?: string };
