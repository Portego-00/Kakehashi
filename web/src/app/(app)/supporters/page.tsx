import type { Metadata } from "next";
import { SupportersWorkspace } from "@/features/content/community";
export const metadata: Metadata = { title: "Patreon supporters" };
export default function SupportersPage() { return <SupportersWorkspace />; }
