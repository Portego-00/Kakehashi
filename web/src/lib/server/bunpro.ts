import "server-only";
import { canAccessBunpro } from "@/features/bunpro/access";
import { analyticsIdentityFromSealedSession } from "./analytics-server";
import { unsealToken } from "./session-crypto";

export const BUNPRO_COOKIE = "kakehashi_bunpro";
export class BunproError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}
export async function bunproIdentity(sealed?: string) {
  if (!sealed) throw new BunproError("Sign in to continue.", 401);
  const identity = await analyticsIdentityFromSealedSession(sealed).catch(() => null);
  if (!identity || !canAccessBunpro(identity.username)) throw new BunproError("Bunpro is only available to Portego.", 403);
  return identity;
}
export function bunproToken(sealed: string | undefined, owner: string): string | null {
  if (!sealed) return null;
  try {
    const value = JSON.parse(unsealToken(sealed));
    return value.owner === owner && typeof value.token === "string" ? value.token : null;
  } catch { return null; }
}
export async function bunproRequest<T>(token: string, path: string, body?: unknown, method?: "PATCH"): Promise<T> {
  const url = new URL(`https://api.bunpro.jp/api/frontend${path}`);
  url.searchParams.set("dangerously_authenticate_using_api_token", "true");
  let response: Response;
  try {
    response = await fetch(url, {
      method: method ?? (body === undefined ? "GET" : "POST"), cache: "no-store", redirect: "error",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20_000),
    });
  } catch { throw new BunproError("Bunpro could not be reached. Please try again."); }
  if (!response.ok) throw new BunproError(response.status === 401 || response.status === 403 ? "Bunpro rejected this API key. Reconnect in Settings." : `Bunpro request failed (${response.status}).`, response.status);
  return response.json();
}
