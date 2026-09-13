import type { Metadata } from "next";
import { CustomSrsSession } from "@/features/custom-srs/CustomSrsSession";
import { requireCustomSrsPageAccess } from "@/lib/server/custom-srs-access";

export const metadata: Metadata = { title: "Custom vocabulary lessons" };

export default async function CustomVocabularyLessonsPage() {
  await requireCustomSrsPageAccess();
  return <main><CustomSrsSession mode="lessons" /></main>;
}
