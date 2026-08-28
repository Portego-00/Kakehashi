import type { Metadata } from "next";
import { TranslatorWorkspace } from "@/features/content/translator";

export const metadata: Metadata = { title: "Translator" };
export default function TranslatorPage() { return <TranslatorWorkspace />; }
