import type { Metadata } from "next";
import { MusicWorkspace } from "@/features/content/music";

export const metadata: Metadata = { title: "Songs & lyrics" };
export default async function MusicPage({ searchParams }: { searchParams: Promise<{ song?: string | string[] }> }) {
  const query = await searchParams;
  const requestedSongId = Array.isArray(query.song) ? query.song[0] : query.song;
  const initialSongId = requestedSongId && requestedSongId.length <= 200 ? requestedSongId : undefined;
  return <MusicWorkspace initialSongId={initialSongId} />;
}
