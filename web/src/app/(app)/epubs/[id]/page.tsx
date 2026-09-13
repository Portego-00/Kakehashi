import { EpubReader } from "@/features/content/epubs";

export default async function EpubReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EpubReader bookId={id} />;
}
