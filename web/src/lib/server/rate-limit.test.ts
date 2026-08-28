import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { clearRateLimitsForTests, takeRateLimit } from "./rate-limit";

describe("local rate limits", () => {
  beforeEach(() => clearRateLimitsForTests());
  it("allows the configured budget and returns a retry window", () => {
    expect(takeRateLimit("user", 2, 60_000, 1_000).allowed).toBe(true);
    expect(takeRateLimit("user", 2, 60_000, 1_001).allowed).toBe(true);
    expect(takeRateLimit("user", 2, 60_000, 1_002)).toMatchObject({ allowed: false, remaining: 0, retryAfterSeconds: 60 });
    expect(takeRateLimit("user", 2, 60_000, 61_001).allowed).toBe(true);
  });
});
