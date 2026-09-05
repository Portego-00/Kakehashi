import type { Metadata } from "next";
import { CustomVocabularyHub } from "@/features/custom-srs/CustomVocabularyHub";

export const metadata: Metadata = { title: "Custom Vocabulary" };

export default function CustomVocabularyPage() {
  return <CustomVocabularyHub />;
}
