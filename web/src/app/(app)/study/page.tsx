import type { Metadata } from "next";
import { StudyHub } from "@/features/study/components/study-hub";

export const metadata: Metadata = { title: "Extra study" };

export default function StudyPage() {
  return <StudyHub />;
}
