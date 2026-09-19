import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analyticsTestNow as now, testReview } from "./analytics-test-fixtures";
import { captureReviewRecordingContext, MAX_RECORDED_REVIEWS, readReviewLedger, recordCompletedWaniKaniReview, reviewLedgerStorageKey, setReviewRecordingAccount, useReviewLedger } from "./analytics-review-ledger";

afterEach(() => { setReviewRecordingAccount(null); vi.restoreAllMocks(); localStorage.clear(); });

describe("official review recording", () => {
  it("starts coverage at authentication and only stores validated response fields", () => {
    setReviewRecordingAccount("account:ledger-a", now);
    expect(readReviewLedger("account:ledger-a")).toMatchObject({ recordingStartedAt: now.toISOString(), reviews: [] });
    const context = captureReviewRecordingContext();
    expect(recordCompletedWaniKaniReview(context, { ...testReview(1, 10), unrelatedSecret: "must-not-be-recorded", url: "secret-url" })).toBe(true);
    const stored = localStorage.getItem(reviewLedgerStorageKey("account:ledger-a"))!;
    expect(stored).not.toContain("must-not-be-recorded");
    expect(stored).not.toContain("secret-url");
    expect(readReviewLedger("account:ledger-a").reviews[0].data.subject_id).toBe(10);
    expect(recordCompletedWaniKaniReview(context, testReview(1, 10))).toBe(false);
    expect(readReviewLedger("account:ledger-a").reviews).toHaveLength(1);
  });

  it("rejects in-flight results after logout, account switch, or reauthentication", () => {
    setReviewRecordingAccount("account:ledger-old", now);
    const old = captureReviewRecordingContext();
    setReviewRecordingAccount(null);
    expect(recordCompletedWaniKaniReview(old, testReview(1, 10))).toBe(false);
    setReviewRecordingAccount("account:ledger-new", now);
    expect(recordCompletedWaniKaniReview(old, testReview(1, 10))).toBe(false);
    setReviewRecordingAccount("account:ledger-old", now);
    expect(recordCompletedWaniKaniReview(old, testReview(1, 10))).toBe(false);
    expect(readReviewLedger("account:ledger-new").reviews).toEqual([]);
    expect(readReviewLedger("account:ledger-old").reviews).toEqual([]);
  });

  it("publishes successful observations immediately to subscribed analytics", () => {
    setReviewRecordingAccount("account:ledger-subscriber", now);
    const { result, rerender } = renderHook(({ account }) => useReviewLedger(account), { initialProps: { account: "account:ledger-subscriber" } });
    act(() => { recordCompletedWaniKaniReview(captureReviewRecordingContext(), testReview(1, 10)); });
    expect(result.current.reviews).toHaveLength(1);
    rerender({ account: "account:different-subscriber" });
    expect(result.current.reviews).toEqual([]);
    expect(result.current.recordingStartedAt).toBeNull();
  });

  it("rejects incomplete resources and unofficial local study objects", () => {
    setReviewRecordingAccount("account:ledger-validation", now);
    const context = captureReviewRecordingContext();
    expect(recordCompletedWaniKaniReview(context, { object: "session", data: {} })).toBe(false);
    expect(recordCompletedWaniKaniReview(context, { ...testReview(1, 10), data: { created_at: now.toISOString() } })).toBe(false);
    expect(recordCompletedWaniKaniReview(context, testReview(1, 10, { incorrect_meaning_answers: -1 }))).toBe(false);
    expect(readReviewLedger("account:ledger-validation").reviews).toEqual([]);
  });

  it("caps records and exposes the actual boundary removed", () => {
    const account = "account:ledger-cap";
    setReviewRecordingAccount(account, now);
    const dates = Array.from({ length: MAX_RECORDED_REVIEWS }, (_, index) => new Date(now.getTime() - (MAX_RECORDED_REVIEWS - index) * 1000).toISOString());
    const records = dates.map((date, index) => [index + 1, 101, 1, 4, 5, 0, 0, date]);
    localStorage.setItem(reviewLedgerStorageKey(account), JSON.stringify({ version: 1, accountKey: account, recordingStartedAt: dates[0], truncatedBefore: null, records }));
    expect(recordCompletedWaniKaniReview(captureReviewRecordingContext(), testReview(MAX_RECORDED_REVIEWS + 1, 1))).toBe(true);
    const ledger = readReviewLedger(account);
    expect(ledger.reviews).toHaveLength(MAX_RECORDED_REVIEWS);
    expect(ledger.reviews[0].id).toBe(2);
    expect(ledger.truncatedBefore).toBe(dates[0]);
    expect(ledger.recordingStartedAt).toBe(dates[0]);
    recordCompletedWaniKaniReview(captureReviewRecordingContext(), testReview(MAX_RECORDED_REVIEWS + 2, 1, { created_at: "2026-01-01T00:00:00Z" }));
    expect(readReviewLedger(account).truncatedBefore).toBe(dates[0]);
  });

  it("keeps the current visit's observations when persistent storage fails", () => {
    setReviewRecordingAccount("account:ledger-quota", now);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
    expect(recordCompletedWaniKaniReview(captureReviewRecordingContext(), testReview(1, 10))).toBe(true);
    expect(readReviewLedger("account:ledger-quota")).toMatchObject({ persistence: "memory", reviews: [expect.objectContaining({ id: 1 })] });
  });
});
