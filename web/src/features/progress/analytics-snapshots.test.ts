import { afterEach, describe, expect, it, vi } from "vitest";
import { analyticsTestNow as now, testAssignment } from "./analytics-test-fixtures";
import { exportSrsSnapshots, importSrsSnapshots, mergeSrsSnapshots, parseSrsSnapshotBackup, readSrsSnapshots, recordSrsSnapshot, srsSnapshotStorageKey, type SrsSnapshot } from "./analytics-snapshots";

const stages = { Locked: 0, Apprentice: 10, Guru: 20, Master: 30, Enlightened: 40, Burned: 50 };
const snapshot = (date: string): SrsSnapshot => ({ date, stages: { ...stages } });
afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

describe("daily SRS snapshots", () => {
  it("upserts one daily observation, isolates accounts, and exports only snapshot fields", () => {
    recordSrsSnapshot("snapshot-account-a", [testAssignment(1)], now);
    recordSrsSnapshot("snapshot-account-a", [testAssignment(1), testAssignment(2)], now);
    recordSrsSnapshot("snapshot-account-b", [testAssignment(1, { srs_stage: 9 })], now);
    expect(readSrsSnapshots("snapshot-account-a").snapshots).toHaveLength(1);
    expect(readSrsSnapshots("snapshot-account-a").snapshots[0].stages.Apprentice).toBe(2);
    expect(readSrsSnapshots("snapshot-account-b").snapshots[0].stages.Burned).toBe(1);
    expect(Object.keys(JSON.parse(exportSrsSnapshots("snapshot-account-a")))).toEqual(["version", "accountKey", "snapshots"]);
    expect(readSrsSnapshots("snapshot-account-a")).toBe(readSrsSnapshots("snapshot-account-a"));
  });

  it("retains only the last 365 calendar days without filling missing dates", () => {
    const snapshots = mergeSrsSnapshots([snapshot("2024-01-01"), snapshot("2026-01-01")], [snapshot("2026-09-10")], now);
    expect(snapshots.map((entry) => entry.date)).toEqual(["2026-01-01", "2026-09-10"]);
  });

  it("rejects foreign accounts, unknown fields, impossible dates, and invalid counts", () => {
    const backup = { version: 1, accountKey: "validated-account", snapshots: [snapshot("2026-09-09")] };
    expect(() => parseSrsSnapshotBackup(JSON.stringify(backup), "other-account", now)).toThrow("different account");
    expect(() => parseSrsSnapshotBackup(JSON.stringify({ ...backup, unexpected: "secret" }), "validated-account", now)).toThrow("not a Kakehashi");
    expect(() => parseSrsSnapshotBackup(JSON.stringify({ ...backup, snapshots: [snapshot("2026-02-30")] }), "validated-account", now)).toThrow("invalid, or future");
    expect(() => parseSrsSnapshotBackup(JSON.stringify({ ...backup, snapshots: [{ date: "2026-09-09", stages: { ...stages, Burned: -1 } }] }), "validated-account", now)).toThrow("whole numbers");
    expect(() => parseSrsSnapshotBackup(JSON.stringify({ ...backup, snapshots: [snapshot("2026-09-09"), snapshot("2026-09-09")] }), "validated-account", now)).toThrow("duplicate");
  });

  it("merges imported dates but preserves the device's existing observations", () => {
    recordSrsSnapshot("merge-account", [testAssignment(1)], now);
    const backup = JSON.stringify({ version: 1, accountKey: "merge-account", snapshots: [snapshot("2026-09-09"), snapshot("2026-09-10")] });
    const result = importSrsSnapshots(backup, "merge-account", now);
    expect(result.snapshots).toHaveLength(2);
    expect(result.snapshots[1].stages.Apprentice).toBe(1);
  });

  it("retains observations in memory when browser storage reaches capacity", () => {
    recordSrsSnapshot("quota-account", [testAssignment(1)], now);
    const stored = localStorage.getItem(srsSnapshotStorageKey("quota-account"));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Quota exceeded", "QuotaExceededError"); });
    const result = recordSrsSnapshot("quota-account", [testAssignment(1), testAssignment(2)], now);
    expect(result.persistence).toBe("memory");
    expect(readSrsSnapshots("quota-account").snapshots[0].stages.Apprentice).toBe(2);
    expect(localStorage.getItem(srsSnapshotStorageKey("quota-account"))).toBe(stored);
  });
});
