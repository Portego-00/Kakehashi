import type { Metadata } from "next";
import { NewsIndex } from "@/features/content/news";

export const metadata: Metadata = { title: "NHK news" };
export default function NewsPage() { return <NewsIndex />; }
