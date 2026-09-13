import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LevelWrapped } from "@/features/progress/components/LevelWrapped";

export const metadata: Metadata = { title: "Level recap" };

export default async function LevelWrappedPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  const value = Number(level);
  if (!Number.isInteger(value) || value < 1 || value > 60) notFound();
  return <LevelWrapped level={value} />;
}
