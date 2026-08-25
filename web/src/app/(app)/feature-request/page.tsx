import type { Metadata } from "next";
import { FeedbackWorkspace } from "@/features/content/community";
export const metadata: Metadata = { title: "Request a feature" };
export default function FeatureRequestPage() { return <FeedbackWorkspace kind="Feature Request" />; }
