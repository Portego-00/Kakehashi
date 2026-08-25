import type { Metadata } from "next";
import { IssueDetailWorkspace } from "@/features/content/community";
export const metadata: Metadata = { title: "Community issue" };
export default async function CommunityIssuePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <IssueDetailWorkspace id={id} />; }
