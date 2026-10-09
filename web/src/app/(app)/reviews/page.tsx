import type { Metadata } from "next";
import { CoreStudySession } from "@/features/core-study/CoreStudySession";
export const metadata: Metadata = { title: "Reviews" };
export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ reviewPresetId?: string | string[] }> }) {
  const { reviewPresetId } = await searchParams;
  const presetId = typeof reviewPresetId === "string" ? reviewPresetId : undefined;
  return <main><CoreStudySession key={presetId ?? "default"} mode="reviews" reviewPresetId={presetId} /></main>;
}
