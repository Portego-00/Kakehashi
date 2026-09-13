import type { Metadata } from "next";
import { JLPTWorkspace } from "@/features/jlpt/components/JLPTWorkspace";

export const metadata: Metadata = { title: "JLPT Quiz" };

export default function JlptPage() {
  return <JLPTWorkspace />;
}
