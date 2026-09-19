import { describe, expect, it } from "vitest";
import type { AnalyticsShareOptions } from "./analytics-export";
import { calculateAnalyticsInsights } from "./analytics-insights";
import { createPublicAnalyticsSnapshot, createPublicAnalyticsSnapshotUrl, encodePublicAnalyticsSnapshot, MAX_PUBLIC_SNAPSHOT_LENGTH, parsePublicAnalyticsSnapshot, type PublicAnalyticsSnapshot } from "./analytics-public-share";

const snapshot: PublicAnalyticsSnapshot = {
  version: 1, username: "Learner 日本", level: 21, accuracy: 92.4, learnedGuruKanji: 200, burned: 50,
  srs: { Apprentice: 100, Guru: 200, Master: 90, Enlightened: 60, Burned: 50 },
  capturedAt: "2026-09-10T12:00:00.000Z", daysStudying: 180,
};

function unvalidatedEncode(value: unknown) {
  return btoa(Array.from(new TextEncoder().encode(JSON.stringify(value)), (byte) => String.fromCharCode(byte)).join("")).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

describe("public progress snapshots", () => {
  it("round-trips a Unicode snapshot entirely in the URL fragment", () => {
    const url = new URL(createPublicAnalyticsSnapshotUrl(snapshot, "https://kakehashi.example/analytics"));
    expect(url.origin).toBe("https://kakehashi.example");
    expect(url.pathname).toBe("/shared-progress");
    expect(url.search).toBe("");
    expect(url.hash).toMatch(/^#snapshot=[A-Za-z0-9_-]+$/);
    expect(parsePublicAnalyticsSnapshot(url.hash)).toEqual(snapshot);
    expect(parsePublicAnalyticsSnapshot(encodePublicAnalyticsSnapshot(snapshot))).toEqual(snapshot);
  });

  it("omits hidden identity and duration and never carries unrelated options", () => {
    const insights = calculateAnalyticsInsights({ assignments: [], subjects: [], statistics: [], progressions: [] });
    const options = { username: "Private name", level: 2, hideUsername: true, hideDays: true, startedAt: "2026-01-01", theme: "dark", format: "stats", apiToken: "must-never-appear" } satisfies AnalyticsShareOptions & { apiToken: string };
    const created = createPublicAnalyticsSnapshot(insights, options, [], [], new Date("2026-09-10T12:00:00.000Z"));
    expect(created).not.toHaveProperty("username");
    expect(created).not.toHaveProperty("daysStudying");
    expect(created).not.toHaveProperty("apiToken");
    expect(JSON.stringify(created)).not.toContain("Private name");
    expect(JSON.stringify(created)).not.toContain("2026-01-01");
    expect(JSON.stringify(created)).not.toContain("must-never-appear");
    expect(parsePublicAnalyticsSnapshot(encodePublicAnalyticsSnapshot(created))).toEqual(created);
  });

  it("includes only the optional days count when the user allows it", () => {
    const insights = calculateAnalyticsInsights({ assignments: [], subjects: [], statistics: [], progressions: [] });
    const options: AnalyticsShareOptions = { username: "Learner", level: 1, hideUsername: false, hideDays: false, startedAt: "2026-09-01T12:00:00Z", theme: "light", format: "stats" };
    const created = createPublicAnalyticsSnapshot(insights, options, [], [], new Date("2026-09-10T12:00:00.000Z"));
    expect(created.username).toBe("Learner");
    expect(created.daysStudying).toBe(9);
    expect(created).not.toHaveProperty("startedAt");
  });

  it.each([
    { ...snapshot, version: 2 },
    { ...snapshot, level: 0 },
    { ...snapshot, level: 61 },
    { ...snapshot, level: 2.5 },
    { ...snapshot, accuracy: 101 },
    { ...snapshot, burned: -1 },
    { ...snapshot, daysStudying: -2 },
    { ...snapshot, learnedGuruKanji: 10000 },
    { ...snapshot, srs: { ...snapshot.srs, Guru: 1_000_000 } },
    { ...snapshot, srs: { ...snapshot.srs, Burned: 12 } },
    { ...snapshot, srs: { ...snapshot.srs, Unexpected: 0 } },
    { ...snapshot, capturedAt: "2026-02-30T12:00:00.000Z" },
    { ...snapshot, capturedAt: "not-a-date" },
    { ...snapshot, username: "A".repeat(81) },
    { ...snapshot, username: "bad\nname" },
    { ...snapshot, username: "\u202ehidden" },
    { ...snapshot, apiToken: "secret" },
  ])("rejects untrusted fields and inconsistent values: %j", (invalid) => {
    expect(parsePublicAnalyticsSnapshot(unvalidatedEncode(invalid))).toBeNull();
  });

  it("rejects malformed, non-JSON and oversized fragments without throwing", () => {
    for (const value of [null, {}, "", "#snapshot=", "#snapshot=@@@", "a".repeat(MAX_PUBLIC_SNAPSHOT_LENGTH + 1), "#snapshot=" + "a".repeat(MAX_PUBLIC_SNAPSHOT_LENGTH + 1), btoa("not json"), "/w", unvalidatedEncode(null), unvalidatedEncode([])]) {
      expect(parsePublicAnalyticsSnapshot(value)).toBeNull();
    }
  });

  it("does not produce links to executable URL schemes", () => {
    expect(() => createPublicAnalyticsSnapshotUrl(snapshot, "javascript:alert(1)")).toThrow();
    expect(() => createPublicAnalyticsSnapshotUrl(snapshot, "ftp://example.com")).toThrow();
  });
});
