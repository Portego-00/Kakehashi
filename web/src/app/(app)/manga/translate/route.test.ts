import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { clearRateLimitsForTests } from "@/lib/server/rate-limit";
import { POST } from "./route";

function request(
  body: unknown,
  options: { address?: string; origin?: string | null; raw?: boolean } = {},
) {
  const headers = new Headers({
    "content-type": "application/json",
    host: "localhost:3100",
    "x-forwarded-for": options.address ?? "203.0.113.24",
  });
  if (options.origin !== null) headers.set("origin", options.origin ?? "http://localhost:3100");
  return new Request("http://localhost:3100/manga/translate", {
    method: "POST",
    headers,
    body: options.raw ? String(body) : JSON.stringify(body),
  });
}

describe("JPDB manga translation route", () => {
  beforeEach(() => {
    clearRateLimitsForTests();
    vi.stubEnv("JPDB_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("forwards selected Japanese to JPDB without exposing the API key", async () => {
    const remote = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      text: "  I am a cat.  ",
      is_truncated: true,
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", remote);

    const response = await POST(request({ text: "  吾輩は猫である。  ", apiKey: "private-key" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ provider: "jpdb", translation: "I am a cat.", isTruncated: true });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(JSON.stringify(payload)).not.toContain("private-key");
    expect(remote).toHaveBeenCalledTimes(1);
    expect(remote.mock.calls[0]?.[0]).toBe("https://jpdb.io/api/v1/ja2en");
    const init = remote.mock.calls[0]?.[1];
    expect(init).toMatchObject({ method: "POST", cache: "no-store" });
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer private-key");
    expect(JSON.parse(String(init?.body))).toEqual({ text: "吾輩は猫である。" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("can use the server JPDB key without returning it", async () => {
    vi.stubEnv("JPDB_API_KEY", "server-private-key");
    const remote = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ text: "Cat." }), { status: 200 }));
    vi.stubGlobal("fetch", remote);

    const response = await POST(request({ text: "猫。" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(new Headers(remote.mock.calls[0]?.[1]?.headers).get("authorization")).toBe("Bearer server-private-key");
    expect(JSON.stringify(payload)).not.toContain("server-private-key");
  });

  it("requires a same-origin request and an available JPDB key", async () => {
    const remote = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", remote);

    expect((await POST(request({ text: "猫", apiKey: "key" }, { origin: null }))).status).toBe(403);
    expect((await POST(request({ text: "猫", apiKey: "key" }, { origin: "https://attacker.example" }))).status).toBe(403);

    const missingKey = await POST(request({ text: "猫" }));
    expect(missingKey.status).toBe(409);
    await expect(missingKey.json()).resolves.toEqual({
      error: "Add your JPDB API key in Settings to translate manga text.",
      code: "missing_key",
    });
    expect(remote).not.toHaveBeenCalled();
  });

  it("rejects malformed and oversized requests before contacting JPDB", async () => {
    const remote = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", remote);

    const malformed = await POST(request("{", { raw: true }));
    expect(malformed.status).toBe(400);

    const oversized = await POST(request({ text: "あ".repeat(20_000), apiKey: "private-key" }));
    expect(oversized.status).toBe(413);
    await expect(oversized.json()).resolves.toEqual({ error: "The translation request is too large.", code: "text_too_long" });
    expect(remote).not.toHaveBeenCalled();
  });

  it.each([
    [403, { error: "bad_key" }, 401, "bad_key", "JPDB rejected this API key. Update it in Settings."],
    [429, { error: "too_many_requests" }, 429, "too_many_requests", "JPDB's translation rate limit was reached. Try again shortly."],
    [400, { error: "text_too_long" }, 400, "text_too_long", "The selected text is too long for JPDB translation."],
    [503, { error: "api_unavailable" }, 502, "api_unavailable", "JPDB translation is temporarily unavailable."],
  ])("maps JPDB HTTP %i failures to a safe client error", async (remoteStatus, remotePayload, status, code, message) => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(JSON.stringify(remotePayload), {
      status: remoteStatus,
      headers: { "content-type": "application/json", ...(remoteStatus === 429 ? { "retry-after": "9" } : {}) },
    })));

    const response = await POST(request({ text: "猫", apiKey: "private-key" }));

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error: message, code });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    if (remoteStatus === 429) expect(response.headers.get("retry-after")).toBe("9");
  });

  it("does not pass through unknown provider messages that could contain secrets", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      error: "private-key appeared in a provider diagnostic",
    }), { status: 400, headers: { "content-type": "application/json" } })));

    const response = await POST(request({ text: "猫", apiKey: "private-key" }));
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload).toEqual({ error: "JPDB could not translate the selected text.", code: "provider_error" });
    expect(JSON.stringify(payload)).not.toContain("private-key");
  });

  it("bounds JPDB responses and rejects an invalid successful payload", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ text: "Cat." }), {
      status: 200,
      headers: { "content-length": "500001", "content-type": "application/json" },
    })));

    const response = await POST(request({ text: "猫", apiKey: "private-key" }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "JPDB returned no usable translation.", code: "provider_error" });
  });

  it("maps a provider timeout without leaking request data", async () => {
    const timeout = Object.assign(new Error("private-key"), { name: "TimeoutError" });
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => { throw timeout; }));

    const response = await POST(request({ text: "猫", apiKey: "private-key" }));
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload).toEqual({ error: "JPDB translation timed out.", code: "timeout" });
    expect(JSON.stringify(payload)).not.toContain("private-key");
  });

  it("rate-limits repeated requests by opaque client identity", async () => {
    let response = new Response();
    for (let attempt = 0; attempt < 31; attempt += 1) {
      response = await POST(request({ text: "猫" }));
    }

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(response.headers.get("ratelimit-remaining")).toBe("0");
    await expect(response.json()).resolves.toEqual({ error: "Too many translation requests. Try again shortly.", code: "too_many_requests" });
  });
});
