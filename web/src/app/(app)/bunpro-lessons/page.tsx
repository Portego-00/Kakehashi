import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { BUNPRO_COOKIE, bunproIdentity, bunproToken } from "@/lib/server/bunpro";
import { WANIKANI_SESSION_COOKIE } from "@/lib/server/wanikani-session";
import { BunproLessons } from "@/features/bunpro/BunproLessons";
export default async function Page({ searchParams }: { searchParams: Promise<{ deck?: string }> }) {
  const jar = await cookies();
  const identity = await bunproIdentity(jar.get(WANIKANI_SESSION_COOKIE)?.value).catch(() => notFound());
  if (!bunproToken(jar.get(BUNPRO_COOKIE)?.value, identity.id)) redirect("/settings#bunpro-api-key");
  const { deck } = await searchParams;
  const id = Number(deck);
  return <BunproLessons initialDeck={Number.isInteger(id) && id > 0 ? id : undefined} />;
}
