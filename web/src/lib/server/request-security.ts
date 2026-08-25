import type { NextRequest } from "next/server";

const HOST_PATTERN = /^(?:\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::\d{1,5})?$/i;

function firstHeaderValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || "";
}

export function requestOrigin(request: Pick<NextRequest, "headers" | "nextUrl">) {
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const host = forwardedHost || firstHeaderValue(request.headers.get("host"));
  if (!host || !HOST_PATTERN.test(host)) return null;

  const forwardedProtocol = firstHeaderValue(request.headers.get("x-forwarded-proto")).toLocaleLowerCase();
  const protocol = forwardedProtocol || request.nextUrl.protocol.replace(":", "").toLocaleLowerCase();
  if (protocol !== "http" && protocol !== "https") return null;
  try { return new URL(`${protocol}://${host}`).origin; }
  catch { return null; }
}

export function isTrustedMutationOrigin(request: Pick<NextRequest, "headers" | "nextUrl">) {
  const supplied = request.headers.get("origin");
  const expected = requestOrigin(request);
  if (!supplied || !expected) return false;
  try {
    return new URL(supplied).origin === expected;
  } catch {
    return false;
  }
}

export function clientAddress(request: Pick<NextRequest, "headers">) {
  const forwarded = firstHeaderValue(request.headers.get("x-forwarded-for"));
  return forwarded || firstHeaderValue(request.headers.get("x-real-ip")) || "unknown";
}
