import { expect, it } from "vitest";
import { rateLimitDelay } from "./retry";
it("accepts seconds, HTTP dates, reset timestamps, and a missing-header fallback", () => {
  const now = Date.parse("2026-09-21T12:00:00Z");
  expect(rateLimitDelay(new Headers({ "Retry-After": "3" }), 5_000, now)).toBe(3_000);
  expect(rateLimitDelay(new Headers({ "Retry-After": "Mon, 21 Sep 2026 12:00:07 GMT" }), 5_000, now)).toBe(7_000);
  expect(rateLimitDelay(new Headers({ "RateLimit-Reset": String(now / 1000 + 12) }), 5_000, now)).toBe(12_000);
  expect(rateLimitDelay(new Headers(), 5_000, now)).toBe(5_000);
});
