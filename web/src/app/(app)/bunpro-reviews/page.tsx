import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { bunproIdentity } from "@/lib/server/bunpro";
import { WANIKANI_SESSION_COOKIE } from "@/lib/server/wanikani-session";
import { BunproReviews } from "@/features/bunpro/BunproReviews";
export default async function Page({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  await bunproIdentity((await cookies()).get(WANIKANI_SESSION_COOKIE)?.value).catch(() => notFound());
  const { mode } = await searchParams;
  return <BunproReviews initialMode={mode === "grammar" || mode === "vocab" || mode === "all" ? mode : undefined} />;
}
