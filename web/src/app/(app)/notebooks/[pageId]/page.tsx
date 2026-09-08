import type { Metadata } from "next";
import { NotebookWorkspace } from "@/features/notebooks/NotebookWorkspace";

export const metadata: Metadata = { title: "Notebook" };
export default async function NotebookPage({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  return <NotebookWorkspace pageId={pageId} />;
}
