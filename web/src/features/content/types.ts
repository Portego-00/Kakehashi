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

export interface NewsArticle {
  id: string;
  title: string;
  publishedAt: string;
  url: string;
  imageUrl?: string;
  summary?: string;
  body?: string;
  content?: Array<
    | { type: "text"; text: string }
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
