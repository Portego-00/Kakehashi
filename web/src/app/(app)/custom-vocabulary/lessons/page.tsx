import type { Metadata } from "next";
import { CustomSrsSession } from "@/features/custom-srs/CustomSrsSession";

export const metadata: Metadata = { title: "Custom vocabulary lessons" };

export default function CustomVocabularyLessonsPage() {
  return <main><CustomSrsSession mode="lessons" /></main>;
}
