import type { Metadata } from "next";
import { CoreStudySession } from "@/features/core-study/CoreStudySession";
export const metadata: Metadata = { title: "Pick lessons" };
export default function LessonPickerPage() { return <main><CoreStudySession mode="lessons" pickLessons /></main>; }
