import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CUSTOM_VOCABULARY_PACKS } from "@/features/custom-srs/catalog";
import { CustomVocabularyDetail } from "@/features/custom-srs/CustomVocabularyDetail";

export const metadata: Metadata = { title: "Custom vocabulary details" };

export default async function CustomVocabularyWordPage({ params }: { params: Promise<{ wordId: string }> }) {
  const { wordId } = await params;
  const pack = CUSTOM_VOCABULARY_PACKS.find((candidate) => candidate.words.some((word) => word.id === wordId));
  const word = pack?.words.find((candidate) => candidate.id === wordId);
  if (!pack || !word) notFound();

  return <CustomVocabularyDetail key={word.id} word={word} packTitle={pack.title} />;
}
