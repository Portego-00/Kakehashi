import type { Metadata } from "next";
import { PersonalVocabularyLibrary } from "@/features/custom-srs/PersonalVocabularyLibrary";
import { requireCustomSrsPageAccess } from "@/lib/server/custom-srs-access";
export const metadata: Metadata = { title: "Your vocabulary library" };
export default async function PersonalVocabularyPage() {
  await requireCustomSrsPageAccess();
  return <PersonalVocabularyLibrary />;
}
