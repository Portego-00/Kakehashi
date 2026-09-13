import { MangaReader } from "@/features/content/manga";

export default async function MangaReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MangaReader mangaId={id} />;
}
