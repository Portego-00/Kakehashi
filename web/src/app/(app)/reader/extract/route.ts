import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { extractReadableTextFromHtml, extractTitleFromHtml } from "@/features/content/parsers";
import { isSameOriginRequest, readBoundedText } from "@/features/content/server-security";

const MAX_RESPONSE_BYTES = 2_000_000;

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");
  if (isIP(normalized) === 4) {
    const [a, b] = normalized.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
}

async function assertPublicUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error("Only public HTTP and HTTPS pages can be imported.");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("Only standard web ports are supported.");
  if (url.hostname === "localhost" || url.hostname.endsWith(".local")) throw new Error("Private-network addresses are blocked.");
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("Private-network addresses are blocked.");
  return url;
}

async function fetchPublicPage(rawUrl: string) {
  let url = await assertPublicUrl(rawUrl);
  for (let redirect = 0; redirect < 4; redirect += 1) {
    const response = await fetch(url, { redirect: "manual", headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "KakehashiReader/1.0" }, signal: AbortSignal.timeout(12_000) });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The page redirected without a destination.");
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`The page returned HTTP ${response.status}.`);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) throw new Error("That address is not an HTML article.");
    const html = await readBoundedText(response, MAX_RESPONSE_BYTES);
    return { html, url: url.toString() };
  }
  throw new Error("The page redirected too many times.");
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin imports are blocked." }, { status: 403 });
    const body = await request.json() as { url?: unknown };
    if (typeof body.url !== "string" || body.url.length > 2048) return NextResponse.json({ error: "Enter a valid public URL." }, { status: 400 });
    const { html, url } = await fetchPublicPage(body.url);
    const text = extractReadableTextFromHtml(html);
    if (text.length < 40) return NextResponse.json({ error: "No readable article text was found. The page may require JavaScript." }, { status: 422 });
    return NextResponse.json({ title: extractTitleFromHtml(html), text: text.slice(0, 40_000), truncated: text.length > 40_000, url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The article could not be imported." }, { status: 400 });
  }
}
