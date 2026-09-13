import type { Metadata } from "next";
import { CustomSrsSession } from "@/features/custom-srs/CustomSrsSession";
import { requireCustomSrsPageAccess } from "@/lib/server/custom-srs-access";

export const metadata: Metadata = { title: "Custom vocabulary reviews" };

export default async function CustomVocabularyReviewsPage() {
  await requireCustomSrsPageAccess();
  return <main><CustomSrsSession mode="reviews" /></main>;
}
