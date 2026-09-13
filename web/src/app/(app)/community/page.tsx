import type { Metadata } from "next";
import { CommunityWorkspace } from "@/features/content/community";

export const metadata: Metadata = { title: "Community board" };
export default function CommunityPage() { return <CommunityWorkspace />; }
