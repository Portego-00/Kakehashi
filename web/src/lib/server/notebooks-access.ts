import "server-only";

import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { DEMO_SESSION_COOKIE } from "@/features/demo/constants";
import { canAccessNotebooks } from "@/features/notebooks/access";
import { analyticsIdentityFromSealedSession } from "@/lib/server/analytics-server";
import { WANIKANI_SESSION_COOKIE } from "@/lib/server/wanikani-session";

/** Check each page request, including direct links and client-side navigation. */
export async function requireNotebooksPageAccess() {
  const cookieStore = await cookies();
  if (cookieStore.get(DEMO_SESSION_COOKIE)?.value === "1") notFound();
  const sealed = cookieStore.get(WANIKANI_SESSION_COOKIE)?.value;
  if (!sealed) notFound();

  const identity = await analyticsIdentityFromSealedSession(sealed).catch(() => null);
  if (!identity || identity.id === "demo-level-21" || !canAccessNotebooks(identity.username)) notFound();
}
