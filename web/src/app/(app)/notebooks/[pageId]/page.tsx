import type { Metadata } from "next";
import { NotebookWorkspace } from "@/features/notebooks/NotebookWorkspace";
import { requireNotebooksPageAccess } from "@/lib/server/notebooks-access";

export const metadata: Metadata = { title: "Notebook" };
export default async function NotebookPage({ params }: { params: Promise<{ pageId: string }> }) {
  await requireNotebooksPageAccess();
  const { pageId } = await params;
  return <NotebookWorkspace pageId={pageId} />;
}
