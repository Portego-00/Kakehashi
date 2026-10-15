import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { bunproIdentity } from "@/lib/server/bunpro";
import { WANIKANI_SESSION_COOKIE } from "@/lib/server/wanikani-session";
import { BunproPractice } from "@/features/bunpro/BunproPractice";
import { BUNPRO_PRACTICE_MODES, canAccessBunproPractice, isBunproPracticeMode } from "@/features/bunpro/practice";

export async function generateMetadata({ params }: { params: Promise<{ mode: string }> }): Promise<Metadata> {
  const { mode } = await params;
  return { title: BUNPRO_PRACTICE_MODES.find(item => item.id === mode)?.title ?? "Bunpro practice" };
}
export default async function Page({ params }: { params: Promise<{ mode: string }> }) {
  const identity = await bunproIdentity((await cookies()).get(WANIKANI_SESSION_COOKIE)?.value).catch(() => notFound());
  if (!canAccessBunproPractice(identity.username)) notFound();
  const { mode } = await params;
  if (!isBunproPracticeMode(mode)) notFound();
  return <BunproPractice mode={mode} />;
}
