import type { Metadata } from "next";
import { AnalyticsOverview } from "@/features/progress/components/AnalyticsOverview";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() { return <AnalyticsOverview />; }
