import type { Metadata } from "next";
import { LevelProgress } from "@/features/progress/components/LevelProgress";

export const metadata: Metadata = { title: "Level progress" };

export default function ProgressPage() { return <LevelProgress />; }
