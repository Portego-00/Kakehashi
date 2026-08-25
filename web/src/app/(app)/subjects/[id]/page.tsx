import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SubjectDetail } from "@/features/subjects/components/SubjectDetail";

export const metadata: Metadata = { title: "Subject details" };

export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const subjectId = Number(id);
  if (!Number.isInteger(subjectId) || subjectId <= 0) notFound();
  return <SubjectDetail id={subjectId} />;
}
