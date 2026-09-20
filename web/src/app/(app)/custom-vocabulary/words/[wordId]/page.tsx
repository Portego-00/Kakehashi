import { PersonalVocabularyDetail } from "@/features/custom-srs/PersonalVocabularyDetail";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CUSTOM_VOCABULARY_PACKS } from "@/features/custom-srs/catalog";
import { CustomVocabularyDetail } from "@/features/custom-srs/CustomVocabularyDetail";
import { requireCustomSrsPageAccess } from "@/lib/server/custom-srs-access";

export const metadata: Metadata = { title: "Custom vocabulary details" };

export default async function CustomVocabularyWordPage({ params }: { params: Promise<{ wordId: string }> }) {
  await requireCustomSrsPageAccess();
  const { wordId } = await params;
  if (/^personal:[0-9a-f-]{36}$/i.test(wordId)) return <PersonalVocabularyDetail key={wordId} wordId={wordId} />;
  const pack = CUSTOM_VOCABULARY_PACKS.find((candidate) => candidate.words.some((word) => word.id === wordId));
  const word = pack?.words.find((candidate) => candidate.id === wordId);
  if (!pack || !word) notFound();

  return <CustomVocabularyDetail key={word.id} word={word} packTitle={pack.title} />;
}
