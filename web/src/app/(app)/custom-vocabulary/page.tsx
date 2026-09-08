import type { Metadata } from "next";
import { CustomVocabularyHub } from "@/features/custom-srs/CustomVocabularyHub";
import { requireCustomSrsPageAccess } from "@/lib/server/custom-srs-access";

export const metadata: Metadata = { title: "Custom Vocabulary" };

export default async function CustomVocabularyPage() {
  await requireCustomSrsPageAccess();
  return <CustomVocabularyHub />;
}
