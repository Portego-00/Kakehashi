import type {
  JpdbParsedTokenAnnotation,
  KanjiMatch,
  VocabularyMatch,
} from "./textHighlighting";

export type AnimeTranscriptSubtitleCue = {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  startOffset: number;
};

export type AnimeTranscriptVideoSourceType = "mp4" | "mkv";

export type AnimeTranscriptDevSession = {
  videoUri: string;
  videoFileName: string;
  videoSourceType: AnimeTranscriptVideoSourceType;
  subtitleFileName: string;
  subtitleCues: AnimeTranscriptSubtitleCue[];
  vocabularyMatches: VocabularyMatch[];
  kanjiMatches: KanjiMatch[];
  jpdbParsedTokens: JpdbParsedTokenAnnotation[];
  videoDurationSeconds?: number;
  historyEntryId?: string;
  lastPlaybackPositionSeconds?: number;
  initialPlaybackPositionSeconds?: number;
  updatedAt: number;
};

let activeSession: AnimeTranscriptDevSession | null = null;

export function setAnimeTranscriptDevSession(
  session: AnimeTranscriptDevSession
): void {
  activeSession = session;
}

export function getAnimeTranscriptDevSession(): AnimeTranscriptDevSession | null {
  return activeSession;
}

export function clearAnimeTranscriptDevSession(): void {
  activeSession = null;
}
