const TRANSCRIPT_TIMESTAMP_RE = /^\[((?:(?:\d{1,2}):)?\d{1,3}:\d{2}(?:[.,]\d{1,3})?)\]\s*(.*)$/;
const LANGUAGE_RE = /^Language:\s*([^\s·]+)/i;
const TITLE_RE = /^#\s*Transcript:\s*(.+)$/i;

export interface ParsedYouTubeTranscript {
  title: string;
  language: string;
  transcript: string;
  cueCount: number;
}

export function parseYouTubeTranscriptMarkdown(markdown: string): ParsedYouTubeTranscript {
  const lines = markdown.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n");
  const title = lines.map((line) => line.match(TITLE_RE)?.[1]?.trim()).find(Boolean)?.slice(0, 200) || "";
  const language = lines.map((line) => line.match(LANGUAGE_RE)?.[1]?.trim()).find(Boolean)?.slice(0, 20) || "";
  const cues: Array<{ timestamp: string; text: string }> = [];
  let current: { timestamp: string; text: string } | null = null;

  const commit = () => {
    if (current?.text.trim()) cues.push({ ...current, text: current.text.trim() });
    current = null;
  };

  for (const rawLine of lines) {
    if (current && rawLine.trim() === "---") {
      commit();
      break;
    }
    const match = rawLine.match(TRANSCRIPT_TIMESTAMP_RE);
    if (match) {
      commit();
      current = { timestamp: match[1].replace(",", "."), text: match[2].trim() };
      continue;
    }
    if (current && rawLine.trim()) current.text += `${current.text ? " " : ""}${rawLine.trim()}`;
  }
  commit();

  if (!cues.length) throw new Error("No timed captions were found in the transcript response.");
  return {
    title,
    language,
    transcript: cues.map((cue) => `[${cue.timestamp}]${cue.text}`).join("\n"),
    cueCount: cues.length,
  };
}
