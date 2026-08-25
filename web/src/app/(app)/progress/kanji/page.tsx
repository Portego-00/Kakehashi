import type { Metadata } from "next";
import { KanjiProgressExplorer } from "@/features/progress/components/KanjiProgressExplorer";

export const metadata: Metadata = { title: "Kanji progress" };

export default function KanjiProgressPage() { return <KanjiProgressExplorer />; }
