import type { Metadata } from "next";
import { CustomSrsSession } from "@/features/custom-srs/CustomSrsSession";

export const metadata: Metadata = { title: "Custom vocabulary reviews" };

export default function CustomVocabularyReviewsPage() {
  return <main><CustomSrsSession mode="reviews" /></main>;
}
