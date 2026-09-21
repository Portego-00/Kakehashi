import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { BunproDetails } from "@/features/bunpro/BunproDetails";
import { BUNPRO_COOKIE, bunproIdentity, bunproToken } from "@/lib/server/bunpro";
import { WANIKANI_SESSION_COOKIE } from "@/lib/server/wanikani-session";

export const metadata: Metadata = { title: "Bunpro subject details" };

export default async function Page({ params }: { params: Promise<{ kind: string; slug: string }> }) {
  const jar = await cookies();
  const identity = await bunproIdentity(jar.get(WANIKANI_SESSION_COOKIE)?.value).catch(() => notFound());
  if (!bunproToken(jar.get(BUNPRO_COOKIE)?.value, identity.id)) redirect("/settings#bunpro-api-key");
  const { kind, slug } = await params;
  if ((kind !== "grammar" && kind !== "vocab") || !slug.trim() || slug.length > 500) notFound();
  return <BunproDetails kind={kind} slug={slug} />;
}
