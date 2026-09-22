import "server-only";
import { wkCacheKey } from "./wk-cache";
import { rateLimitDelay } from "@/lib/wanikani/retry";

type Budget = { requests: number[]; notBefore: number };
const shared = globalThis as typeof globalThis & { __kakehashiWkBudgets?: Map<string, Budget> };
const budgets = shared.__kakehashiWkBudgets ??= new Map<string, Budget>();
const WINDOW_MS = 60_000;
// Leave room for other WaniKani clients. This budget is shared by session and proxy reads/writes.
const REQUEST_BUDGET = 55;

export async function fetchWaniKani(token: string, url: string | URL, init: RequestInit) {
  const key = wkCacheKey(token, "request-budget");
  const now = Date.now();
  const budget = budgets.get(key) ?? { requests: [], notBefore: 0 };
  budget.requests = budget.requests.filter((at) => at > now - WINDOW_MS);
  budgets.delete(key);
  budgets.set(key, budget);
  while (budgets.size > 2_000) budgets.delete(budgets.keys().next().value!);
  const nextSlot = budget.requests.length >= REQUEST_BUDGET ? budget.requests[0] + WINDOW_MS : 0;
  const notBefore = Math.max(nextSlot, budget.notBefore);
  if (notBefore > now) {
    return Response.json({ error: "WaniKani’s rate limit is active. Retrying shortly.", code: 429 }, { status: 429, headers: {
      "Retry-After": String(Math.max(1, Math.ceil((notBefore - now) / 1_000))),
      "RateLimit-Reset": String(Math.ceil(notBefore / 1_000)),
    } });
  }
  budget.requests.push(now); // Reserve before awaiting so concurrent requests share the limit.
  const response = await fetch(url, init);
  if (response.status === 429 || response.headers.get("ratelimit-remaining") === "0") {
    budget.notBefore = Math.max(budget.notBefore, Date.now() + rateLimitDelay(response.headers));
  }
  return response;
}

export function clearWkBudgetsForTests() { budgets.clear(); }
