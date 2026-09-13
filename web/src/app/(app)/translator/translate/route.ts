import { NextResponse } from "next/server";
import { isSameOriginRequest, readBoundedJson, readBoundedRequestJson } from "@/features/content/server-security";
import { PUBLIC_TRANSLATION_MAX_BYTES, PUBLIC_TRANSLATION_MAX_CHARACTERS, readMyMemoryTranslation, splitTranslationText, translationAvailability, utf8Length } from "@/features/content/translation";
import { opaqueRateLimitKey, takeRateLimit } from "@/lib/server/rate-limit";
import { clientAddress } from "@/lib/server/request-security";

export const runtime = "nodejs";

const TARGETS = new Set(["en", "es", "fr", "de", "ko", "zh"]);
const PUBLIC_TRANSLATION_ENDPOINT = "https://api.mymemory.translated.net/get";
const TRANSLATION_REQUEST_MAX_BYTES = 50_000;
const TRANSLATION_RATE_LIMIT = 30;
const TRANSLATION_RATE_WINDOW_MS = 60_000;

export async function GET() {
  return NextResponse.json(translationAvailability(Boolean(process.env.TRANSLATION_API_URL)));
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin translation requests are blocked." }, { status: 403 });
    const limit = takeRateLimit(opaqueRateLimitKey("translation", clientAddress(request)), TRANSLATION_RATE_LIMIT, TRANSLATION_RATE_WINDOW_MS);
    if (!limit.allowed) return NextResponse.json({ error: "Too many translation requests. Try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "RateLimit-Limit": String(limit.limit), "RateLimit-Remaining": String(limit.remaining), "RateLimit-Reset": String(Math.ceil(limit.resetAt / 1_000)) } });
    let body: { text?: unknown; target?: unknown };
    try {
      body = await readBoundedRequestJson(request, TRANSLATION_REQUEST_MAX_BYTES) as { text?: unknown; target?: unknown };
    } catch (error) {
      const tooLarge = error instanceof Error && error.message.includes("too large");
      return NextResponse.json({ error: tooLarge ? "Translation request is too large." : "Translation request must be valid JSON." }, { status: tooLarge ? 413 : 400 });
    }
    if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 10_000 || typeof body.target !== "string" || !TARGETS.has(body.target)) return NextResponse.json({ error: "Enter up to 10,000 characters and a supported target language." }, { status: 400 });
    const endpoint = process.env.TRANSLATION_API_URL;
    if (!endpoint) {
      if (body.text.length > PUBLIC_TRANSLATION_MAX_CHARACTERS || utf8Length(body.text) > PUBLIC_TRANSLATION_MAX_BYTES) return NextResponse.json({ configured: false, error: `The public translator accepts short passages up to ${PUBLIC_TRANSLATION_MAX_CHARACTERS} characters. Split longer text into smaller sections.` }, { status: 400 });
      const chunks = splitTranslationText(body.text);
      const translated = await Promise.all(chunks.map(async (chunk) => {
        const query = new URLSearchParams({ q: chunk, langpair: `ja|${body.target}`, mt: "1" });
        const response = await fetch(`${PUBLIC_TRANSLATION_ENDPOINT}?${query}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000), cache: "no-store" });
        const payload = await readBoundedJson(response, 500_000).catch(() => null);
        if (!response.ok) throw new Error(`The public translation service returned HTTP ${response.status}.`);
        return readMyMemoryTranslation(payload);
      }));
      return NextResponse.json({ configured: false, mode: "public", provider: "MyMemory", translation: translated.join(" ") });
    }
    const apiKey = process.env.TRANSLATION_API_KEY;
    const response = await fetch(endpoint, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}`, "X-API-Key": apiKey } : {}) }, body: JSON.stringify({ q: body.text, source: "ja", target: body.target, format: "text", ...(apiKey ? { api_key: apiKey } : {}) }), signal: AbortSignal.timeout(20_000), cache: "no-store" });
    const payload = await readBoundedJson(response, 1_000_000).catch(() => null) as Record<string, unknown> | null;
    if (!response.ok) throw new Error(payload && typeof payload.error === "string" ? payload.error : `Translation backend returned HTTP ${response.status}.`);
    const nested = payload?.data && typeof payload.data === "object" ? payload.data as { translations?: Array<{ translatedText?: string }> } : null;
    const translation = typeof payload?.translatedText === "string" ? payload.translatedText : nested?.translations?.[0]?.translatedText;
    if (!translation) throw new Error("The configured backend returned no translation.");
    return NextResponse.json({ configured: true, mode: "configured", provider: "Site translation backend", translation });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Translation failed." }, { status: 502 }); }
}
