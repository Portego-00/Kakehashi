export type ContentKind = "epub" | "video" | "manga" | "song";

export interface ContentRecord {
  id: string;
  kind: ContentKind;
  title: string;
  fileName?: string;
  mimeType?: string;
  assetIds: string[];
  createdAt: string;
  updatedAt: string;
  progress: number;
  currentPage?: number;
  totalPages?: number;
  text?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface SubtitleCue {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

export interface TimedLyricLine {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

export type NewsSource = "easy" | "regular";
export type NewsSourcePreference = NewsSource | "both";

export interface FuriganaRange {
  /** UTF-16 offsets into the containing text block. */
  start: number;
  end: number;
  reading: string;
}

export interface NewsArticle {
  /** Source-qualified and stable across refreshes, for example `easy:9876`. */
  id: string;
  source: NewsSource;
  title: string;
  publishedAt: string;
  url: string;
  /** False when Standard NHK is available only through its RSS summary. */
  isFullArticle: boolean;
  imageUrl?: string;
  audioUrl?: string;
  summary?: string;
  body?: string;
  content?: Array<
    | { type: "text"; text: string; furigana?: FuriganaRange[] }
    | { type: "image"; url: string; alt?: string }
  >;
}

export interface CommunityPost {
  id: string;
  type: "discussion" | "feedback" | "feature" | "issue";
  title: string;
  body: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  likes: number;
  liked: boolean;
  status: "open" | "resolved";
  replies: Array<{ id: string; author: string; body: string; createdAt: string }>;
}
