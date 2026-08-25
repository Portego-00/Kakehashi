import type { Metadata } from "next";
import { MusicWorkspace } from "@/features/content/music";

export const metadata: Metadata = { title: "Songs & lyrics" };
export default function MusicPage() { return <MusicWorkspace />; }
