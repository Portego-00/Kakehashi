import type { Metadata } from "next";
import { NewIssueWorkspace } from "@/features/content/community";
export const metadata: Metadata = { title: "New community issue" };
export default function NewCommunityIssuePage() { return <NewIssueWorkspace />; }
