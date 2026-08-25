import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SubjectConstellation } from "@/features/subjects/components/SubjectConstellation";

export const metadata: Metadata = { title: "Subject constellation" };

export default async function SubjectConstellationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const value = Number(id);
  if (!Number.isInteger(value) || value <= 0) notFound();
  return <SubjectConstellation id={value} />;
}
