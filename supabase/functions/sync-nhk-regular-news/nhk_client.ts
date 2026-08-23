import {
  canonicalArticleUrl,
  isValidArticleId,
  NHK_API_BASE_URL,
} from "./parser.ts";

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 12;
const MAX_JSON_BYTES = 2_000_000;
const MAX_FEED_BYTES = 1_000_000;
const USER_AGENT = "Kakehashi-NHK-News-Importer/1.0";

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  hostOnly: boolean;
  path: string;
  secure: boolean;
  expiresAt: number | null;
}

function isAllowedNhkHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "nhk" ||
    host.endsWith(".nhk") ||
    host === "nhk.or.jp" ||
    host.endsWith(".nhk.or.jp") ||
    host === "nhk.jp" ||
    host.endsWith(".nhk.jp")
  );
}

function defaultCookiePath(pathname: string): string {
  if (!pathname.startsWith("/") || pathname === "/") return "/";
  const finalSlash = pathname.lastIndexOf("/");
  return finalSlash <= 0 ? "/" : pathname.slice(0, finalSlash);
}

export function splitSetCookieHeader(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(/,(?=\s*[^;,=\s]+=[^;,]*)/g)
    .map((cookie) => cookie.trim())
    .filter(Boolean);
}

function responseSetCookies(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof withGetSetCookie.getSetCookie === "function") {
    const values = withGetSetCookie.getSetCookie();
    if (values.length > 0) return values;
  }
  return splitSetCookieHeader(headers.get("set-cookie") ?? "");
}

export class CookieJar {
  private cookies = new Map<string, StoredCookie>();

  absorb(headers: Headers, requestUrl: URL, now = Date.now()): void {
    for (const header of responseSetCookies(headers)) {
      const segments = header.split(";").map((segment) => segment.trim());
      const nameValue = segments.shift();
      if (!nameValue) continue;
      const separator = nameValue.indexOf("=");
      if (separator <= 0) continue;

      const name = nameValue.slice(0, separator).trim();
      const value = nameValue.slice(separator + 1).trim();
      if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) continue;

      let domain = requestUrl.hostname.toLowerCase();
      let hostOnly = true;
      let path = defaultCookiePath(requestUrl.pathname);
      let secure = false;
      let expiresAt: number | null = null;

      for (const segment of segments) {
        const attributeSeparator = segment.indexOf("=");
        const rawName = (
          attributeSeparator === -1
            ? segment
            : segment.slice(0, attributeSeparator)
        )
          .trim()
          .toLowerCase();
        const rawValue = attributeSeparator === -1
          ? ""
          : segment.slice(attributeSeparator + 1).trim();

        if (rawName === "domain") {
          const candidate = rawValue.replace(/^\./, "").toLowerCase();
          if (
            candidate &&
            (requestUrl.hostname === candidate ||
              requestUrl.hostname.endsWith(`.${candidate}`))
          ) {
            domain = candidate;
            hostOnly = false;
          }
        } else if (rawName === "path" && rawValue.startsWith("/")) {
          path = rawValue;
        } else if (rawName === "secure") {
          secure = true;
        } else if (rawName === "max-age") {
          const seconds = Number.parseInt(rawValue, 10);
          if (Number.isFinite(seconds)) expiresAt = now + seconds * 1_000;
        } else if (rawName === "expires" && expiresAt === null) {
          const parsed = Date.parse(rawValue);
          if (Number.isFinite(parsed)) expiresAt = parsed;
        }
      }

      const key = `${domain}\t${path}\t${name}`;
      if (!value || (expiresAt !== null && expiresAt <= now)) {
        this.cookies.delete(key);
        continue;
      }
      this.cookies.set(key, {
        name,
        value,
        domain,
        hostOnly,
        path,
        secure,
        expiresAt,
      });
    }
  }

  header(url: URL, now = Date.now()): string {
    const matches: StoredCookie[] = [];
    for (const [key, cookie] of this.cookies.entries()) {
      if (cookie.expiresAt !== null && cookie.expiresAt <= now) {
        this.cookies.delete(key);
        continue;
      }
      if (cookie.secure && url.protocol !== "https:") continue;
      const domainMatches = cookie.hostOnly
        ? url.hostname === cookie.domain
        : url.hostname === cookie.domain ||
          url.hostname.endsWith(`.${cookie.domain}`);
      if (!domainMatches || !url.pathname.startsWith(cookie.path)) continue;
      matches.push(cookie);
    }

    return matches
      .sort((left, right) => right.path.length - left.path.length)
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");
  }

  has(name: string): boolean {
    return [...this.cookies.values()].some((cookie) => cookie.name === name);
  }
}

async function timedFetch(
  fetcher: FetchLike,
  input: string | URL,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<{ response: Response; finish: () => void }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
  };

  try {
    const response = await fetcher(input, {
      ...init,
      signal: controller.signal,
    });
    return { response, finish };
  } catch (error) {
    finish();
    throw error;
  }
}

async function readBoundedResponse(
  response: Response,
  maximumBytes: number,
): Promise<Uint8Array> {
  const declaredLengthHeader = response.headers.get("content-length");
  const declaredLength = declaredLengthHeader === null
    ? null
    : Number(declaredLengthHeader);
  if (
    declaredLength !== null &&
    Number.isFinite(declaredLength) &&
    declaredLength > maximumBytes
  ) {
    try {
      await response.body?.cancel();
    } catch {
      // Preserve the deterministic size-limit failure if cancellation races
      // with an upstream abort or an already-closed stream.
    }
    throw new Error("NHK response exceeded the declared size limit");
  }

  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        try {
          await reader.cancel("NHK response exceeded the size limit");
        } catch {
          // Preserve the deterministic size-limit failure if cancellation
          // races with an upstream abort or an already-closed stream.
        }
        throw new Error("NHK response exceeded the size limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function fetchBoundedText(
  url: string,
  maximumBytes = MAX_FEED_BYTES,
  fetcher: FetchLike = fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<string> {
  const parsedUrl = new URL(url);
  if (
    parsedUrl.protocol !== "https:" ||
    !isAllowedNhkHost(parsedUrl.hostname)
  ) {
    throw new Error("Refused a non-NHK upstream URL");
  }
  const timedResponse = await timedFetch(
    fetcher,
    parsedUrl,
    {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept: "application/xml,text/xml;q=0.9,*/*;q=0.1",
        "User-Agent": USER_AGENT,
      },
    },
    timeoutMs,
  );
  try {
    if (!timedResponse.response.ok) {
      await timedResponse.response.body?.cancel();
      throw new Error(
        `NHK feed returned HTTP ${timedResponse.response.status}`,
      );
    }
    return new TextDecoder().decode(
      await readBoundedResponse(timedResponse.response, maximumBytes),
    );
  } finally {
    timedResponse.finish();
  }
}

interface AuthorizationResult {
  ok: boolean;
  finalUrl: URL;
}

async function followNhkRedirects(
  initialUrl: URL,
  jar: CookieJar,
  fetcher: FetchLike,
): Promise<AuthorizationResult> {
  let currentUrl = initialUrl;

  for (
    let redirectCount = 0;
    redirectCount <= MAX_REDIRECTS;
    redirectCount += 1
  ) {
    if (
      currentUrl.protocol !== "https:" ||
      !isAllowedNhkHost(currentUrl.hostname)
    ) {
      throw new Error("NHK authorization redirected outside its allowed hosts");
    }

    const cookie = jar.header(currentUrl);
    const timedResponse = await timedFetch(fetcher, currentUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.1",
        ...(cookie ? { Cookie: cookie } : {}),
        "User-Agent": USER_AGENT,
      },
    });
    try {
      const response = timedResponse.response;
      jar.absorb(response.headers, currentUrl);

      if (![301, 302, 303, 307, 308].includes(response.status)) {
        const finalUrl = new URL(response.url || currentUrl);
        await response.body?.cancel();
        return { ok: response.ok, finalUrl };
      }

      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) {
        throw new Error("NHK authorization returned an empty redirect");
      }
      currentUrl = new URL(location, currentUrl);
    } finally {
      timedResponse.finish();
    }
  }

  throw new Error("NHK authorization exceeded the redirect limit");
}

export class NhkArticleSession {
  constructor(
    private readonly jar: CookieJar,
    private readonly fetcher: FetchLike = fetch,
  ) {}

  async fetchArticle(articleId: string): Promise<unknown> {
    if (!isValidArticleId(articleId)) throw new Error("Invalid NHK article ID");
    const url = new URL(
      `${NHK_API_BASE_URL}/${encodeURIComponent(articleId)}.json`,
    );
    const cookie = this.jar.header(url);
    if (!cookie) throw new Error("NHK article session did not contain cookies");

    const timedResponse = await timedFetch(this.fetcher, url, {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept: "application/json",
        Cookie: cookie,
        "User-Agent": USER_AGENT,
      },
    });
    try {
      const response = timedResponse.response;
      this.jar.absorb(response.headers, url);
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`NHK article API returned HTTP ${response.status}`);
      }
      const contentType = response.headers.get("content-type")?.toLowerCase() ??
        "";
      if (!contentType.includes("application/json")) {
        await response.body?.cancel();
        throw new Error("NHK article API did not return JSON");
      }

      const bytes = await readBoundedResponse(response, MAX_JSON_BYTES);
      return JSON.parse(new TextDecoder().decode(bytes));
    } finally {
      timedResponse.finish();
    }
  }
}

export async function createNhkArticleSession(
  redirectArticleId: string,
  fetcher: FetchLike = fetch,
): Promise<NhkArticleSession> {
  const redirectUri = canonicalArticleUrl(redirectArticleId);
  const authorizationUrl = new URL("https://news.web.nhk/tix/build_authorize");
  authorizationUrl.searchParams.set("idp", "a-alaz");
  authorizationUrl.searchParams.set("profileType", "abroad");
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("entity", "none");
  authorizationUrl.searchParams.set("area", "130");
  authorizationUrl.searchParams.set("pref", "13");
  authorizationUrl.searchParams.set("jisx0402", "13101");
  authorizationUrl.searchParams.set("postal", "1000001");

  const jar = new CookieJar();
  const authorization = await followNhkRedirects(
    authorizationUrl,
    jar,
    fetcher,
  );
  if (!authorization.ok || authorization.finalUrl.hostname !== "news.web.nhk") {
    throw new Error("NHK accountless authorization did not complete");
  }

  if (!jar.has("z_at") || !jar.has("authz_type")) {
    throw new Error(
      "NHK accountless authorization did not issue a reader session",
    );
  }
  return new NhkArticleSession(jar, fetcher);
}
