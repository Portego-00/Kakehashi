import type { Metadata } from "next";
import { SearchWorkspace } from "@/features/subjects/components/SearchWorkspace";
import { searchStateFromParams } from "@/features/subjects/search-state";

export const metadata: Metadata = { title: "Subject search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <SearchWorkspace initialState={searchStateFromParams(await searchParams)} />;
}
