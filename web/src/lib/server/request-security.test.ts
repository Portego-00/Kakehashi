import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { isTrustedMutationOrigin, requestOrigin } from "./request-security";

function request(headers: Record<string, string>, url = "http://localhost:3100/api/session/wanikani") {
  return { headers: new Headers(headers), nextUrl: new URL(url) } as unknown as Pick<NextRequest, "headers" | "nextUrl">;
}

describe("trusted mutation origins", () => {
  it("uses the actual host header instead of Next's canonical development URL", () => {
    const value = request({ host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100" });
    expect(requestOrigin(value)).toBe("http://127.0.0.1:3100");
    expect(isTrustedMutationOrigin(value)).toBe(true);
  });

  it("rejects missing, malformed, and cross-origin values", () => {
    expect(isTrustedMutationOrigin(request({ host: "localhost:3100" }))).toBe(false);
    expect(isTrustedMutationOrigin(request({ host: "localhost:3100", origin: "https://attacker.example" }))).toBe(false);
    expect(requestOrigin(request({ host: "bad host" }))).toBeNull();
  });
});
