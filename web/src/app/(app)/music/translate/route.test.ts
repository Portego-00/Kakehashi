import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { clearRateLimitsForTests } from "@/lib/server/rate-limit";
import { POST } from "./route";

function request(
  body: unknown,
  options: {
    address?: string;
    origin?: string | null;
    raw?: boolean;
    signal?: AbortSignal;
  } = {},
) {
  const headers = new Headers({
    "content-type": "application/json",
    host: "localhost:3100",
    "x-forwarded-for": options.address ?? "203.0.113.44",
  });
  if (options.origin !== null) {
    headers.set("origin", options.origin ?? "http://localhost:3100");
  }
  return new Request("http://localhost:3100/music/translate", {
    method: "POST",
    headers,
    body: options.raw ? String(body) : JSON.stringify(body),
    signal: options.signal,
  });
}

function jpdbResponse(body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

async function translationPayload(response: Response) {
  if (!response.headers.get("content-type")?.includes("application/x-ndjson")) {
    return response.json() as Promise<Record<string, unknown>>;
  }
  const events = (await response.text())
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  const translations = events
    .filter((event) => event.type === "translation")
    .map(({ source, translation }) => ({ source, translation }));
  const error = events.find((event) => event.type === "error");
  if (error) return { error: error.error, code: error.code };
  const complete = events.find((event) => event.type === "complete");
  return {
    provider: "jpdb",
    translations,
    ...(typeof complete?.warning === "string" ? { warning: complete.warning } : {}),
    ...(typeof complete?.code === "string" ? { code: complete.code } : {}),
  };
}

describe("JPDB lyric translation route", () => {
  beforeEach(() => clearRateLimitsForTests());

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns the response as soon as the first line is ready instead of waiting for the batch", async () => {
    let finishSecondLine: ((response: Response) => void) | undefined;
    const secondLine = new Promise<Response>((resolve) => { finishSecondLine = resolve; });
    const remote = vi.fn<typeof fetch>(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { text: string };
      if (body.text === "一行目") return jpdbResponse({ text: "First line." });
      if (body.text === "二行目") return secondLine;
      throw new Error(`Unexpected JPDB line: ${body.text}`);
    });
    vi.stubGlobal("fetch", remote);

    const responsePromise = POST(request({
      lines: ["一行目", "二行目"],
      apiKey: "private-key",
    }, { address: "203.0.113.60" }));
    let responseResolved = false;
    void responsePromise.then(() => { responseResolved = true; });
    await vi.waitFor(() => expect(remote).toHaveBeenCalledTimes(2));
    await Promise.resolve();
    const resolvedBeforeSecondLine = responseResolved;

    finishSecondLine?.(jpdbResponse({ text: "Second line." }));
    const response = await responsePromise;
    const body = await response.text();

    expect(resolvedBeforeSecondLine).toBe(true);
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    expect(body).toContain(JSON.stringify({ type: "translation", source: "一行目", translation: "First line." }));
    expect(body).toContain(JSON.stringify({ type: "translation", source: "二行目", translation: "Second line." }));
  });

  it("deduplicates Japanese lines and carries cached and fresh context sequentially", async () => {
    const remote = vi.fn<typeof fetch>(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { text: string };
      if (body.text === "二行目") return jpdbResponse({ text: "  Second line.  " });
      if (body.text === "三行目") return jpdbResponse({ text: "Third line." });
      throw new Error(`Unexpected JPDB line: ${body.text}`);
    });
    vi.stubGlobal("fetch", remote);

    const response = await POST(request({
      lines: ["  一行目  ", "二行目", "二行目", "English only", "三行目"],
      cachedTranslations: [{ source: " 一行目 ", translation: " First line. " }],
      apiKey: "  private-key  ",
    }));
    const payload = await translationPayload(response);

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      provider: "jpdb",
      translations: [
        { source: "一行目", translation: "First line." },
        { source: "二行目", translation: "Second line." },
        { source: "三行目", translation: "Third line." },
      ],
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store, no-transform");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(JSON.stringify(payload)).not.toContain("private-key");
    expect(remote).toHaveBeenCalledTimes(2);
    expect(remote.mock.calls.map(([input]) => input)).toEqual([
      "https://jpdb.io/api/v1/ja2en",
      "https://jpdb.io/api/v1/ja2en",
    ]);
    expect(remote.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
      { text: "二行目", context: ["一行目", "First line."] },
      { text: "三行目", context: ["二行目", "Second line."] },
    ]);
    expect(remote.mock.calls.map(([, init]) => new Headers(init?.headers).get("authorization"))).toEqual([
      "Bearer private-key",
      "Bearer private-key",
    ]);
    expect(remote.mock.calls.every(([, init]) => init?.cache === "no-store")).toBe(true);
    expect(remote.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(remote.mock.calls[1]?.[1]?.signal).toBe(remote.mock.calls[0]?.[1]?.signal);
  });

  it("requires a same-origin request and a submitted API key", async () => {
    const remote = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", remote);

    expect((await POST(request(
      { lines: ["猫"], apiKey: "key" },
      { origin: null },
    ))).status).toBe(403);
    expect((await POST(request(
      { lines: ["猫"], apiKey: "key" },
      { origin: "https://attacker.example" },
    ))).status).toBe(403);

    const missingKey = await POST(request({ lines: ["猫"] }));
    expect(missingKey.status).toBe(409);
    await expect(missingKey.json()).resolves.toEqual({
      error: "Add your JPDB API key in Settings to translate lyric lines.",
      code: "missing_key",
    });
    expect(remote).not.toHaveBeenCalled();
  });

  it("rejects malformed, oversized, and structurally invalid requests before contacting JPDB", async () => {
    const remote = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", remote);

    const malformed = await POST(request("{", { raw: true, address: "203.0.113.51" }));
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toEqual({
      error: "Lyric translation request must be valid JSON.",
      code: "invalid_request",
    });

    const oversizedRequest = await POST(request(
      "x".repeat(750_001),
      { raw: true, address: "203.0.113.52" },
    ));
    expect(oversizedRequest.status).toBe(413);

    const tooManyLines = await POST(request({
      lines: Array.from({ length: 121 }, (_, index) => `日本語の行${index}`),
      apiKey: "key",
    }, { address: "203.0.113.53" }));
    expect(tooManyLines.status).toBe(400);
    await expect(tooManyLines.json()).resolves.toEqual({
      error: "Choose no more than 120 unique Japanese lyric lines.",
      code: "invalid_request",
    });

    const overlongLine = await POST(request({
      lines: [`猫${"あ".repeat(2_000)}`],
      apiKey: "key",
    }, { address: "203.0.113.54" }));
    expect(overlongLine.status).toBe(400);
    expect((await overlongLine.json()).code).toBe("text_too_long");

    const tooManySourceCharacters = await POST(request({
      lines: Array.from(
        { length: 101 },
        (_, index) => `日本語${index}${"あ".repeat(500)}`,
      ),
      apiKey: "key",
    }, { address: "203.0.113.55" }));
    expect(tooManySourceCharacters.status).toBe(400);
    expect((await tooManySourceCharacters.json()).code).toBe("text_too_long");

    const overlongKey = await POST(request({
      lines: ["猫"],
      apiKey: "k".repeat(513),
    }, { address: "203.0.113.56" }));
    expect(overlongKey.status).toBe(400);
    expect((await overlongKey.json()).code).toBe("bad_key");

    const unrelatedCache = await POST(request({
      lines: ["猫"],
      cachedTranslations: [{ source: "犬", translation: "Dog." }],
      apiKey: "key",
    }, { address: "203.0.113.57" }));
    expect(unrelatedCache.status).toBe(400);
    await expect(unrelatedCache.json()).resolves.toEqual({
      error: "Cached translations must belong to a requested lyric line.",
      code: "invalid_request",
    });

    const blankCache = await POST(request({
      lines: ["猫"],
      cachedTranslations: [{ source: "猫", translation: "   " }],
      apiKey: "key",
    }, { address: "203.0.113.58" }));
    expect(blankCache.status).toBe(400);

    const overlongCache = await POST(request({
      lines: ["猫"],
      cachedTranslations: [{ source: "猫", translation: "x".repeat(8_001) }],
      apiKey: "key",
    }, { address: "203.0.113.59" }));
    expect(overlongCache.status).toBe(400);

    expect(remote).not.toHaveBeenCalled();
  });

  it("skips provider text-too-long errors and continues translating later lines", async () => {
    const remote = vi.fn<typeof fetch>(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { text: string; context?: unknown };
      if (body.text === "長い行") {
        return jpdbResponse({ error: "text_too_long" }, 400);
      }
      expect(body).toEqual({ text: "次の行" });
      return jpdbResponse({ text: "Next line." });
    });
    vi.stubGlobal("fetch", remote);

    const response = await POST(request({
      lines: ["長い行", "次の行"],
      apiKey: "private-key",
    }));

    expect(response.status).toBe(200);
    await expect(translationPayload(response)).resolves.toEqual({
      provider: "jpdb",
      translations: [{ source: "次の行", translation: "Next line." }],
      warning: "Some lyric lines were too long for JPDB translation.",
      code: "text_too_long",
    });
    expect(remote).toHaveBeenCalledTimes(2);
  });

  it("skips empty successful translations and continues translating later lines", async () => {
    const remote = vi.fn<typeof fetch>(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { text: string; context?: unknown };
      if (body.text === "翻訳できない行") {
        return jpdbResponse({ text: "   ", is_truncated: false });
      }
      expect(body).toEqual({ text: "猫" });
      return jpdbResponse({ text: "Cat." });
    });
    vi.stubGlobal("fetch", remote);

    const response = await POST(request({
      lines: ["翻訳できない行", "猫"],
      apiKey: "private-key",
    }));

    expect(response.status).toBe(200);
    await expect(translationPayload(response)).resolves.toEqual({
      provider: "jpdb",
      translations: [{ source: "猫", translation: "Cat." }],
    });
    expect(remote).toHaveBeenCalledTimes(2);
  });

  it("returns safe partial results when a later provider request fails", async () => {
    const remote = vi.fn<typeof fetch>(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { text: string };
      if (body.text === "一行目") return jpdbResponse({ text: "First line." });
      return jpdbResponse(
        { error: "private-key appeared in a provider diagnostic" },
        429,
        { "retry-after": "7" },
      );
    });
    vi.stubGlobal("fetch", remote);

    const response = await POST(request({
      lines: ["一行目", "二行目", "三行目"],
      apiKey: "private-key",
    }));
    const payload = await translationPayload(response);

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      provider: "jpdb",
      translations: [{ source: "一行目", translation: "First line." }],
      warning: "JPDB's translation rate limit was reached. Try again shortly.",
      code: "too_many_requests",
    });
    expect(response.headers.get("retry-after")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("private, no-store, no-transform");
    expect(JSON.stringify(payload)).not.toContain("private-key");
    expect(remote).toHaveBeenCalledTimes(2);
  });

  it.each([
    [403, { error: "bad_key" }, "bad_key", "JPDB rejected this API key. Update it in Settings."],
    [429, { error: "too_many_requests" }, "too_many_requests", "JPDB's translation rate limit was reached. Try again shortly."],
    [503, { error: "api_unavailable" }, "api_unavailable", "JPDB translation is temporarily unavailable."],
    [400, { error: "private-key leaked in a diagnostic" }, "provider_error", "JPDB could not translate the lyrics."],
  ])(
    "maps JPDB HTTP %i failures to a safe client error",
    async (remoteStatus, remotePayload, code, message) => {
      vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => jpdbResponse(
        remotePayload,
        remoteStatus,
      )));

      const response = await POST(request({ lines: ["猫"], apiKey: "private-key" }));
      const payload = await translationPayload(response);

      expect(response.status).toBe(200);
      expect(payload).toEqual({ error: message, code });
      expect(response.headers.get("cache-control")).toBe("private, no-store, no-transform");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(JSON.stringify(payload)).not.toContain("private-key");
    },
  );

  it("bounds JPDB responses and rejects invalid successful payloads", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(
      JSON.stringify({ text: "Cat." }),
      {
        status: 200,
        headers: {
          "content-length": "100001",
          "content-type": "application/json",
        },
      },
    )));

    const response = await POST(request({ lines: ["猫"], apiKey: "private-key" }));

    expect(response.status).toBe(200);
    await expect(translationPayload(response)).resolves.toEqual({
      error: "JPDB returned no usable translation.",
      code: "provider_error",
    });
  });

  it("maps a whole-operation timeout without leaking request data", async () => {
    const timeout = Object.assign(new Error("private-key"), { name: "TimeoutError" });
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => { throw timeout; }));

    const response = await POST(request({ lines: ["猫"], apiKey: "private-key" }));
    const payload = await translationPayload(response);

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      error: "JPDB lyric translation timed out.",
      code: "timeout",
    });
    expect(JSON.stringify(payload)).not.toContain("private-key");
  });

  it("cancels upstream JPDB work when the browser abandons the response stream", async () => {
    const upstream = { signal: null as AbortSignal | null };
    const remote = vi.fn<typeof fetch>(async (_input, init) => new Promise<Response>((_resolve, reject) => {
      upstream.signal = init?.signal ?? null;
      upstream.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    vi.stubGlobal("fetch", remote);

    const response = await POST(request(
      { lines: ["猫"], apiKey: "private-key" },
      { address: "203.0.113.61" },
    ));
    await vi.waitFor(() => expect(remote).toHaveBeenCalledOnce());

    await response.body?.cancel();

    expect(upstream.signal?.aborted).toBe(true);
    expect(response.status).toBe(200);
  });

  it("rate-limits repeated batch requests by opaque client identity", async () => {
    const remote = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", remote);
    const body = {
      lines: ["猫"],
      cachedTranslations: [{ source: "猫", translation: "Cat." }],
      apiKey: "private-key",
    };

    let response = new Response();
    for (let attempt = 0; attempt < 11; attempt += 1) {
      response = await POST(request(body));
    }

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(response.headers.get("ratelimit-limit")).toBe("10");
    expect(response.headers.get("ratelimit-remaining")).toBe("0");
    await expect(response.json()).resolves.toEqual({
      error: "Too many lyric translation requests. Try again shortly.",
      code: "too_many_requests",
    });
    expect(remote).not.toHaveBeenCalled();
  });
});
