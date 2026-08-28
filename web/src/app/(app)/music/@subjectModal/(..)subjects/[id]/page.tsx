import { notFound } from "next/navigation";
import { SubjectDetail } from "@/features/subjects/components/SubjectDetail";
import { SubjectDetailDialog } from "@/features/subjects/components/SubjectDetailDialog";
import { resolveSubjectReturnPath, subjectReturnLabel } from "@/features/subjects/subject-detail-navigation";

export default async function MusicSubjectDetails({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const subjectId = Number(id);
  if (!Number.isInteger(subjectId) || subjectId <= 0) notFound();
  const returnTo = resolveSubjectReturnPath(Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo);

  return (
    <SubjectDetailDialog returnLabel={subjectReturnLabel(returnTo)}>
      <SubjectDetail key={subjectId} id={subjectId} returnTo={returnTo} presentation="panel" />
    </SubjectDetailDialog>
  );
}
