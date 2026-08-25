import type { Metadata } from "next";
import { FeedbackWorkspace } from "@/features/content/community";
export const metadata: Metadata = { title: "Send feedback" };
export default function FeedbackPage() { return <FeedbackWorkspace kind="Feedback" />; }
