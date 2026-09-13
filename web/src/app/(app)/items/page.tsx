import type { Metadata } from "next";
import { ItemsExplorer, type ItemView } from "@/features/subjects/components/ItemsExplorer";

export const metadata: Metadata = { title: "Items" };
const views = new Set<ItemView>(["unlocks", "critical", "burned"]);

export default async function ItemsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  return <ItemsExplorer initialView={views.has(view as ItemView) ? view as ItemView : "unlocks"} />;
}
