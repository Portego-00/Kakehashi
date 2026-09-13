import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { DEMO_SESSION_COOKIE } from "@/features/demo/constants";
import { DEMO_JPDB_KEY } from "@/features/demo/jpdb";
import { opaqueRateLimitKey, takeRateLimit } from "./rate-limit";
import { clientAddress } from "./request-security";
import { WANIKANI_SESSION_COOKIE } from "./wanikani-session";

export interface DemoJpdbFailure {
  code: "api_unavailable" | "bad_key" | "too_many_requests";
  message: string;
  status: number;
  headers?: HeadersInit;
}

type JpdbCredential = { apiKey: string; isDemo: boolean; failure?: never }
  | { apiKey?: never; isDemo: boolean; failure: DemoJpdbFailure };

type SharedBudget = { count: number; resetsAt: number };
const shared = globalThis as typeof globalThis & { __kakehashiDemoJpdbBudgets?: { minute?: SharedBudget; day?: SharedBudget } };
const sharedBudgets = shared.__kakehashiDemoJpdbBudgets ??= {};

// Fixed slots keep these provider-wide caps outside the evictable client-bucket LRU.
function takeSharedBudget(name: "minute" | "day", limit: number, windowMs: number) {
  const now = Date.now();
  let budget = sharedBudgets[name];
  if (!budget || budget.resetsAt <= now) budget = sharedBudgets[name] = { count: 0, resetsAt: now + windowMs };
  budget.count += 1;
  return { allowed: budget.count <= limit, retryAfterSeconds: Math.max(1, Math.ceil((budget.resetsAt - now) / 1_000)) };
}

function unavailableFailure(): DemoJpdbFailure {
  return { code: "api_unavailable", message: "The demo's Japanese tools are temporarily unavailable. Please try again later.", status: 503 };
}

export function demoJpdbProviderFailure(isDemo: boolean, status: number, providerCode?: unknown): DemoJpdbFailure | null {
  return isDemo && (status === 401 || status === 403 || providerCode === "bad_key") ? unavailableFailure() : null;
}

/** Only the read-only parse and ja2en handlers may resolve this credential. */
export function resolveJpdbCredential(request: Request, submittedKey: string, allowServerFallback = false): JpdbCredential {
  if (submittedKey !== DEMO_JPDB_KEY) {
    return { apiKey: submittedKey || (allowServerFallback ? process.env.JPDB_API_KEY?.trim() : "") || "", isDemo: false };
  }

  const cookies = new NextRequest(request.url, { headers: request.headers }).cookies;
  if (cookies.get(DEMO_SESSION_COOKIE)?.value !== "1" || cookies.has(WANIKANI_SESSION_COOKIE)) {
    return { isDemo: false, failure: { code: "bad_key", message: "Start the demo to use its Japanese tools.", status: 403 } };
  }

  const apiKey = process.env.JPDB_DEMO_API_KEY?.trim() || "";
  if (!apiKey) {
    return { isDemo: true, failure: unavailableFailure() };
  }
  return { apiKey, isDemo: true };
}

/** Count actual upstream calls, including every line in a translation stream. */
export function takeDemoJpdbBudget(request: Request, isDemo: boolean): DemoJpdbFailure | null {
  if (!isDemo) return null;
  const budgets = [
    () => takeRateLimit(opaqueRateLimitKey("jpdb-demo-client", clientAddress(request)), 120, 60_000),
    () => takeSharedBudget("minute", 300, 60_000),
    () => takeSharedBudget("day", 5_000, 24 * 60 * 60_000),
  ];
  for (const takeBudget of budgets) {
    const result = takeBudget();
    if (!result.allowed) return {
      code: "too_many_requests",
      message: "The demo's Japanese tools are busy. Please try again shortly.",
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    };
  }
  return null;
}

export function clearDemoJpdbBudgetsForTests() {
  delete sharedBudgets.minute;
  delete sharedBudgets.day;
}

export function demoJpdbErrorResponse(failure: DemoJpdbFailure) {
  const headers = new Headers(failure.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status, headers });
}
