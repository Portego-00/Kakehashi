import type { Metadata } from "next";
import { NotebookWorkspace } from "@/features/notebooks/NotebookWorkspace";
import { requireNotebooksPageAccess } from "@/lib/server/notebooks-access";

export const metadata: Metadata = { title: "Notebooks" };
export default async function NotebooksPage() {
  await requireNotebooksPageAccess();
  return <NotebookWorkspace />;
}
