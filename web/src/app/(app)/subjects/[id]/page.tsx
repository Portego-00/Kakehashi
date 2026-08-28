import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SubjectDetail } from "@/features/subjects/components/SubjectDetail";
import { resolveSubjectReturnPath } from "@/features/subjects/subject-detail-navigation";

export const metadata: Metadata = { title: "Subject details" };

export default async function SubjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const [{ id }, { returnTo }] = await Promise.all([params, searchParams]);
  const subjectId = Number(id);
  if (!Number.isInteger(subjectId) || subjectId <= 0) notFound();
  const subjectReturnPath = resolveSubjectReturnPath(returnTo);
  return <SubjectDetail key={subjectId} id={subjectId} returnTo={subjectReturnPath} />;
}
