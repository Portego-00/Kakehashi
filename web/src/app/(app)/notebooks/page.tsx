import type { Metadata } from "next";
import { NotebookWorkspace } from "@/features/notebooks/NotebookWorkspace";

export const metadata: Metadata = { title: "Notebooks" };
export default function NotebooksPage() { return <NotebookWorkspace />; }
