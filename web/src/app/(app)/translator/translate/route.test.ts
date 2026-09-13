import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { clearRateLimitsForTests } from "@/lib/server/rate-limit";
import { POST } from "./route";

function translationRequest(body: string, options: { origin?: string | null; address?: string } = {}) {
  const headers = new Headers({
    "content-type": "application/json",
    host: "localhost:3100",
    "x-forwarded-for": options.address ?? "203.0.113.10",
  });
  if (options.origin !== null) headers.set("origin", options.origin ?? "http://localhost:3100");
  return new Request("http://localhost:3100/translator/translate", { method: "POST", headers, body });
}

describe("translator route request protection", () => {
  beforeEach(() => clearRateLimitsForTests());

  it("rejects an oversized request before parsing or contacting a provider", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await POST(translationRequest(JSON.stringify({ text: "あ".repeat(20_000), target: "en" })));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: "Translation request is too large." });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("rejects a mutation without an Origin header", async () => {
    const response = await POST(translationRequest("{}", { origin: null }));
    expect(response.status).toBe(403);
  });

  it("rejects a cross-origin mutation", async () => {
    const response = await POST(translationRequest("{}", { origin: "https://attacker.example" }));
    expect(response.status).toBe(403);
  });

  it("rate-limits repeated same-origin requests by opaque client identity", async () => {
    let response = new Response();
    for (let attempt = 0; attempt < 31; attempt += 1) {
      response = await POST(translationRequest("{}"));
    }

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(response.headers.get("ratelimit-remaining")).toBe("0");
  });
});
