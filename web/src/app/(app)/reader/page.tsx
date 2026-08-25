import type { Metadata } from "next";
import { ReaderWorkspace } from "@/features/content/reader";

export const metadata: Metadata = { title: "Reading desk" };
export default function ReaderPage() { return <ReaderWorkspace />; }
