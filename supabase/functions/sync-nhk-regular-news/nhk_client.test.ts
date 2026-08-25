import {
  CookieJar,
  fetchBoundedText,
  type FetchLike,
  splitSetCookieHeader,
} from "./nhk_client.ts";

const FEED_URL = "https://news.web.nhk/n-data/conf/na/rss/cat0.xml";

describe("NHK server cookie handling", () => {
  it("splits combined Set-Cookie values without splitting Expires dates", () => {
    expect(
      splitSetCookieHeader(
        "z_at=reader-token; Domain=.web.nhk; Path=/; Secure, authz_type=a-alaz; Expires=Wed, 21 Oct 2030 07:28:00 GMT; Path=/",
      ),
    ).toEqual([
      "z_at=reader-token; Domain=.web.nhk; Path=/; Secure",
      "authz_type=a-alaz; Expires=Wed, 21 Oct 2030 07:28:00 GMT; Path=/",
    ]);
  });

  it("sends domain cookies only to matching HTTPS NHK hosts", () => {
    const headers = new Headers();
    headers.append(
      "set-cookie",
      "z_at=reader-token; Domain=.web.nhk; Path=/; Secure; Max-Age=3600",
    );
    headers.append(
      "set-cookie",
      "authz_type=a-alaz; Domain=.web.nhk; Path=/; Secure; Max-Age=3600",
    );
    const jar = new CookieJar();
    jar.absorb(headers, new URL("https://news.web.nhk/tix/callback"), 1_000);

    expect(jar.header(new URL("https://api.web.nhk/r8/example"), 2_000)).toBe(
      "z_at=reader-token; authz_type=a-alaz",
    );
    expect(jar.header(new URL("https://example.com/"), 2_000)).toBe("");
    expect(jar.header(new URL("http://api.web.nhk/r8/example"), 2_000)).toBe(
      "",
    );
  });
});

describe("bounded NHK response reads", () => {
  it("stops a chunked response as soon as it exceeds the byte limit", async () => {
    let cancelReason = "";
    const chunks = [
      new TextEncoder().encode("1234"),
      new TextEncoder().encode("5678"),
    ];
    let nextChunk = 0;
    const body = {
      getReader: () => ({
        read: async () =>
          nextChunk < chunks.length
            ? { done: false, value: chunks[nextChunk++] }
            : { done: true, value: undefined },
        cancel: async (reason: unknown) => {
          cancelReason = String(reason);
        },
        releaseLock: () => undefined,
      }),
    };
    const fetcher: FetchLike = async () =>
      ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/xml" }),
        body,
      }) as unknown as Response;

    await expect(fetchBoundedText(FEED_URL, 5, fetcher)).rejects.toThrow(
      "exceeded the size limit",
    );
    expect(cancelReason).toContain("exceeded the size limit");
  });

  it("accepts a multi-chunk response exactly at the byte limit", async () => {
    const chunks = [
      new TextEncoder().encode("1234"),
      new TextEncoder().encode("5678"),
    ];
    let nextChunk = 0;
    const body = {
      getReader: () => ({
        read: async () =>
          nextChunk < chunks.length
            ? { done: false, value: chunks[nextChunk++] }
            : { done: true, value: undefined },
        cancel: async () => undefined,
        releaseLock: () => undefined,
      }),
    };
    const fetcher: FetchLike = async () =>
      ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/xml" }),
        body,
      }) as unknown as Response;

    await expect(fetchBoundedText(FEED_URL, 8, fetcher)).resolves.toBe(
      "12345678",
    );
  });

  it("rejects an oversized declared length before reading the body", async () => {
    let cancelled = false;
    const body = {
      cancel: async () => {
        cancelled = true;
      },
      getReader: () => {
        throw new Error("body must not be read");
      },
    };
    const fetcher: FetchLike = async () =>
      ({
        ok: true,
        status: 200,
        headers: new Headers({
          "content-length": "9",
          "content-type": "application/xml",
        }),
        body,
      }) as unknown as Response;

    await expect(fetchBoundedText(FEED_URL, 8, fetcher)).rejects.toThrow(
      "declared size limit",
    );
    expect(cancelled).toBe(true);
  });

  it("keeps the request timeout active while a response body is stalled", async () => {
    let sawAbort = false;
    const fetcher: FetchLike = async (_input, init) => {
      const signal = init?.signal;
      let rejectRead: ((reason: Error) => void) | undefined;
      signal?.addEventListener(
        "abort",
        () => {
          sawAbort = true;
          rejectRead?.(new Error("body read aborted"));
        },
        { once: true },
      );
      const body = {
        getReader: () => ({
          read: () =>
            new Promise<never>((_resolve, reject) => {
              rejectRead = reject;
            }),
          cancel: async () => undefined,
          releaseLock: () => undefined,
        }),
      };
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/xml" }),
        body,
      } as unknown as Response;
    };

    await expect(fetchBoundedText(FEED_URL, 100, fetcher, 10)).rejects.toThrow(
      "body read aborted",
    );
    expect(sawAbort).toBe(true);
  });
});
