import "server-only";

import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { canAccessCustomSrs } from "@/features/custom-srs/access";
import { analyticsIdentityFromSealedSession } from "@/lib/server/analytics-server";
import { WANIKANI_SESSION_COOKIE } from "@/lib/server/wanikani-session";

/** Check each page request, including direct links and client-side navigation. */
export async function requireCustomSrsPageAccess() {
  const sealed = (await cookies()).get(WANIKANI_SESSION_COOKIE)?.value;
  if (!sealed) notFound();

  const identity = await analyticsIdentityFromSealedSession(sealed).catch(() => null);
  if (!identity || !canAccessCustomSrs(identity.username)) notFound();
}
