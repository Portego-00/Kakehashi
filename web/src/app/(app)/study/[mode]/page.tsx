import { notFound } from "next/navigation";
import { getStudyMode, isStudyModeId, STUDY_MODES } from "@/features/study/catalog";
import { StudyModeClient } from "@/features/study/components/study-mode-client";
import { parseSubjectIds } from "@/features/study/mode-config";

export function generateStaticParams() {
  return STUDY_MODES.map((mode) => ({ mode: mode.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  return isStudyModeId(mode) ? { title: getStudyMode(mode).title } : {};
}

export default async function StudyModePage({ params, searchParams }: { params: Promise<{ mode: string }>; searchParams: Promise<{ subjectIds?: string | string[] }> }) {
  const { mode } = await params;
  if (!isStudyModeId(mode)) notFound();
  const query = await searchParams;
  return <StudyModeClient mode={mode} seedSubjectIds={parseSubjectIds(query.subjectIds)} />;
}
