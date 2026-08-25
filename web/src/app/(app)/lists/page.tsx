import type { Metadata } from "next";
import { ListsWorkspace } from "@/features/subjects/components/ListsWorkspace";

export const metadata: Metadata = { title: "Subject lists" };

export default function ListsPage() { return <ListsWorkspace />; }
