import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearRateLimitsForTests } from "@/lib/server/rate-limit";

vi.mock("server-only", () => ({}));

describe("community GET rate limit", () => {
  beforeEach(() => clearRateLimitsForTests());

  it("limits reads by an opaque client-address bucket without blocking a different address", async () => {
    const { GET } = await import("./route");
    const request = (address: string) => new NextRequest("http://localhost/community/api?action=unsupported", { headers: { host: "localhost", "x-forwarded-for": address } });
    for (let index = 0; index < 240; index += 1) expect((await GET(request("192.0.2.10"))).status).toBe(404);
    const limited = await GET(request("192.0.2.10"));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
    expect((await GET(request("192.0.2.11"))).status).toBe(404);
  });
});
