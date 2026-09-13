import type { Metadata } from "next";
import { EpubLibrary } from "@/features/content/epubs";

export const metadata: Metadata = { title: "Book library" };
export default function EpubsPage() { return <EpubLibrary />; }
