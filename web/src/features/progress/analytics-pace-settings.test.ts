import { describe, expect, it } from "vitest";
import { createDefaultPaceSettings, normalizePaceSettings, paceSettingsStorageKey, parsePaceSettings, type AnalyticsPaceSettings } from "./analytics-pace-settings";

const settings: AnalyticsPaceSettings = { version: 1, goalLevel: 30, paceOverride: 12.5, origin: "started", excludedLevels: [1, 2, 8], targetDate: "2027-09-10", clipOutliers: true };

describe("account pace settings", () => {
  it("round-trips every supported setting", () => {
    expect(parsePaceSettings(JSON.stringify(settings))).toEqual(settings);
    expect(parsePaceSettings(JSON.stringify({ ...settings, scenario: "faster" }))).toEqual({ ...settings, scenario: "faster" });
    expect(parsePaceSettings(JSON.stringify({ ...settings, scenario: "unknown" }))).toEqual(settings);
  });

  it("returns fresh defaults for missing, corrupted, oversized or unsupported versions", () => {
    for (const input of [null, "", "invalid", "[]", "null", "{}", JSON.stringify({ ...settings, version: 2 }), " ".repeat(10_001)]) expect(parsePaceSettings(input)).toEqual(createDefaultPaceSettings());
    const first = createDefaultPaceSettings();
    first.excludedLevels.push(4);
    expect(createDefaultPaceSettings().excludedLevels).toEqual([1, 2]);
  });

  it("normalizes individual fields without discarding valid choices", () => {
    expect(normalizePaceSettings({ ...settings, goalLevel: 61, paceOverride: Infinity, origin: "unknown", excludedLevels: [2, "3", 2, 1, 0, 61, 4.5], targetDate: "2026-02-30", clipOutliers: "true", otherAccount: "not saved" })).toEqual({ ...createDefaultPaceSettings(), excludedLevels: [1, 2] });
    expect(normalizePaceSettings({ ...settings, excludedLevels: [] }).excludedLevels).toEqual([]);
  });

  it.each([0, -1, 5.5, 60.5, 12.25, NaN])("rejects an invalid override %s", (paceOverride) => {
    expect(normalizePaceSettings({ ...settings, paceOverride }).paceOverride).toBeNull();
  });

  it("allows past target dates and rejects malformed or out-of-bounds dates", () => {
    expect(normalizePaceSettings({ ...settings, targetDate: "2020-02-29" }).targetDate).toBe("2020-02-29");
    for (const targetDate of ["02/01/2027", "2027-2-01", "2101-01-01", "1999-12-31", "2027-09-10T12:00:00Z"]) expect(normalizePaceSettings({ ...settings, targetDate }).targetDate).toBe("");
  });

  it("keeps account namespaces distinct and encodes key delimiters", () => {
    expect(paceSettingsStorageKey("demo:42")).toBe("kakehashi:analytics-pace:v1:demo%3A42");
    expect(paceSettingsStorageKey("user:42")).not.toBe(paceSettingsStorageKey("demo:42"));
    expect(paceSettingsStorageKey("user:a/b")).not.toBe(paceSettingsStorageKey("user:a%2Fb"));
  });
});
