import { loadLibrary, loadMangaOcrPage, readLocal, saveLibrary, saveMangaOcrPage, writeLocal } from "@/features/content/storage";
import type { ContentKind, ContentRecord } from "@/features/content/types";
import { DEMO_BOOK_TEXT_ASSET, DEMO_MANGA_ID, DEMO_MANGA_PAGE_COUNT } from "./media-assets";
import { isDemoMode } from "./runtime";

const CREATED_AT = "2026-09-07T00:00:00.000Z";

const common = { assetIds: [], createdAt: CREATED_AT, updatedAt: CREATED_AT, progress: 0 };

/** URLs and Japanese caption excerpts verified against the existing importer on 2026-09-07. */
export const DEMO_VIDEOS: readonly ContentRecord[] = [
  {
    ...common,
    id: "demo-video-japanese-with-shun",
    kind: "video",
    title: "A Day in Japan / Easy Japanese for Beginners (N5–N4)",
    fileName: "https://www.youtube.com/watch?v=K5RfTVZH-1g",
    text: "[0:04]今日は、、、 はい、皆さん おはようございます\n[0:47]はい。ええ 皆さん、おはようございます",
    metadata: {
      sourceType: "youtube", youtubeId: "K5RfTVZH-1g", videoUrl: "https://www.youtube.com/watch?v=K5RfTVZH-1g",
      creator: "Japanese with Shun", duration: 1451, transcriptFormat: "lrc", transcriptSource: "youtube",
      transcriptLanguage: "ja", demoCaptionExcerpt: true,
    },
  },
  {
    ...common,
    id: "demo-video-nihongo-learning-sendai",
    kind: "video",
    title: "A Day in my Life in Sendai, Japan!【Comprehensible Japanese】",
    fileName: "https://www.youtube.com/watch?v=P24Rtgi22FI",
    text: "[0:33]僕は今、公園に来ています。\n[1:08]日本では、夏に必ずセミの なき声 が聞こえます。",
    metadata: {
      sourceType: "youtube", youtubeId: "P24Rtgi22FI", videoUrl: "https://www.youtube.com/watch?v=P24Rtgi22FI",
      creator: "Nihongo-Learning", duration: 183, transcriptFormat: "lrc", transcriptSource: "youtube",
      transcriptLanguage: "ja", demoCaptionExcerpt: true,
    },
  },
];

const DEMO_BOOK: ContentRecord = {
  ...common,
  id: "demo-book-rainy-afternoon",
  kind: "epub",
  title: "雨の日の図書館",
  fileName: "雨の日の図書館.txt",
  mimeType: "text/plain",
  assetIds: [DEMO_BOOK_TEXT_ASSET],
  currentPage: 1,
  totalPages: 1,
  metadata: { format: "text", textAssetId: DEMO_BOOK_TEXT_ASSET, language: "ja", writingMode: "vertical-rl", author: "Kakehashi · original demo story" },
};

const DEMO_MANGA: ContentRecord = {
  ...common,
  id: DEMO_MANGA_ID,
  kind: "manga",
  title: "葬送のフリーレン（１）・冒頭サンプル",
  mimeType: "image/jpeg",
  assetIds: Array.from({ length: DEMO_MANGA_PAGE_COUNT }, (_, index) => `${DEMO_MANGA_ID}-page-${index + 1}`),
  currentPage: 13,
  totalPages: DEMO_MANGA_PAGE_COUNT,
  metadata: {
    sourceType: "images", readingDirection: "rtl", demoSample: true,
    pagePlacements: JSON.stringify(Array.from({ length: DEMO_MANGA_PAGE_COUNT }, (_, index) => index === 0 ? "center" : index % 2 ? "right" : "left")),
  },
};

const FRIEREN_PAGE_13 = "まったく。クソみたいな思い出しかないな。\nでも楽しかったよ。\n僕は君たちと冒険ができてよかった。\nそうですね。";

/** Seeding never overwrites progress, imports, edits, or intentionally removed samples. */
export async function seedDemoLibrary(): Promise<void> {
  if (!isDemoMode()) return;
  const groups: Array<[ContentKind, readonly ContentRecord[]]> = [
    ["video", DEMO_VIDEOS], ["epub", [DEMO_BOOK]], ["manga", [DEMO_MANGA]],
  ];
  for (const [kind, samples] of groups) {
    const marker = `demo-seeded:${kind}:v1`;
    if (readLocal(marker, false)) continue;
    const existing = loadLibrary(kind);
    const ids = new Set(existing.map((item) => item.id));
    const added = samples.filter((sample) => !ids.has(sample.id));
    if (!saveLibrary(kind, [...existing, ...added])) throw new Error("The demo library could not be saved. Allow browser storage and try again.");
    if (kind === "manga" && !loadMangaOcrPage(DEMO_MANGA_ID, 13)) saveMangaOcrPage(DEMO_MANGA_ID, 13, FRIEREN_PAGE_13);
    if (!writeLocal(marker, true)) throw new Error("The demo library could not be saved. Allow browser storage and try again.");
  }
}
