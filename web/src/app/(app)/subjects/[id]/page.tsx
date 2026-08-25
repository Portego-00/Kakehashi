import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SubjectDetail } from "@/features/subjects/components/SubjectDetail";
import { safeInternalPath } from "@/lib/navigation";

export const metadata: Metadata = { title: "Subject details" };

export default async function SubjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const [{ id }, { returnTo }] = await Promise.all([params, searchParams]);
  const subjectId = Number(id);
  if (!Number.isInteger(subjectId) || subjectId <= 0) notFound();
  const requestedReturnPath = safeInternalPath(returnTo, "/search");
  const searchReturnPath = requestedReturnPath === "/search" || requestedReturnPath.startsWith("/search?") ? requestedReturnPath : "/search";
  return <SubjectDetail key={subjectId} id={subjectId} returnTo={searchReturnPath} />;
}
