import type { Metadata } from "next";
import { Dashboard } from "@/features/dashboard/Dashboard";

export const metadata: Metadata = { title: "Dashboard" };
export default function DashboardPage() { return <Dashboard />; }
