import type { Metadata } from "next";
import { SearchWorkspace } from "@/features/subjects/components/SearchWorkspace";

export const metadata: Metadata = { title: "Subject search" };

export default function SearchPage() { return <SearchWorkspace />; }
