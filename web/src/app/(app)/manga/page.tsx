import type { Metadata } from "next";
import { MangaLibrary } from "@/features/content/manga";

export const metadata: Metadata = { title: "Manga library" };
export default function MangaPage() { return <MangaLibrary />; }
