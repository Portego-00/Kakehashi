import type { Metadata } from "next";
import { CoreStudySession } from "@/features/core-study/CoreStudySession";
export const metadata: Metadata = { title: "Lessons" };
export default function LessonsPage() { return <main><CoreStudySession mode="lessons" /></main>; }
