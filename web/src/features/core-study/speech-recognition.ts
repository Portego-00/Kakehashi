export interface BrowserSpeechRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

export type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

export function speechRecognitionConstructor(browser: Window = window) {
  const candidate = browser as Window & { SpeechRecognition?: BrowserSpeechRecognitionConstructor; webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor };
  return candidate.SpeechRecognition || candidate.webkitSpeechRecognition || null;
}
