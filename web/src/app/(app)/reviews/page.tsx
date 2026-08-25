import type { Metadata } from "next";
import { CoreStudySession } from "@/features/core-study/CoreStudySession";
export const metadata: Metadata = { title: "Reviews" };
export default function ReviewsPage() { return <main><CoreStudySession mode="reviews" /></main>; }
