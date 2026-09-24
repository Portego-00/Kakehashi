import { describe, expect, it } from "vitest";
import { createBunproReviewSavePolicy } from "./review-save-policy";

describe("Bunpro review save policy", () => {
  it("keeps going after isolated failures and pauses on the third consecutive failure", () => {
    const policy = createBunproReviewSavePolicy();
    const failure = new Error("Bunpro request failed (500).");

    expect(policy.failed(failure)).toEqual({ pause: false, message: failure.message });
    expect(policy.failed(failure)).toEqual({ pause: false, message: failure.message });
    const paused = policy.failed(failure);
    expect(paused.pause).toBe(true);
    expect(paused.message).toContain("3 consecutive save failures");
    expect(paused.message).toContain("Try saving again");
    expect(policy.failed(failure)).toEqual(paused);
  });

  it("resets the failure count after a successful save", () => {
    const policy = createBunproReviewSavePolicy();
    const failure = new Error("Bunpro request failed (500).");
    policy.failed(failure);
    policy.failed(failure);

    policy.succeeded();

    expect(policy.failed(failure).pause).toBe(false);
    expect(policy.failed(failure).pause).toBe(false);
    expect(policy.failed(failure).pause).toBe(true);
  });

  it.each([401, 403])("immediately pauses HTTP %i with an actionable API key message", (status) => {
    const policy = createBunproReviewSavePolicy();
    const failure = Object.assign(new Error("Request was rejected"), { status });

    const result = policy.failed(failure);

    expect(result.pause).toBe(true);
    expect(result.message).toContain("API key");
    expect(result.message).toContain("Settings");
    expect(result.message).toContain("try saving again");
  });

  it.each([401, 403])("recognizes the exact legacy authentication error for HTTP %i", (status) => {
    const policy = createBunproReviewSavePolicy();

    expect(policy.failed(new Error(`Bunpro request failed (${status}).`)).pause).toBe(true);
  });

  it("keeps authentication failures paused until a save succeeds", () => {
    const policy = createBunproReviewSavePolicy();
    const authFailure = Object.assign(new Error("Unauthorized"), { status: 401 });
    const paused = policy.failed(authFailure);
    const networkFailure = new TypeError("Failed to fetch");

    expect(policy.failed(networkFailure)).toEqual(paused);
    expect(policy.failed(networkFailure)).toEqual(paused);
    policy.succeeded();
    expect(policy.failed(networkFailure)).toEqual({ pause: false, message: "Failed to fetch" });
  });

  it("clears an outage pause after a successful save", () => {
    const policy = createBunproReviewSavePolicy();
    const failure = new TypeError("Failed to fetch");
    policy.failed(failure);
    policy.failed(failure);
    expect(policy.failed(failure).pause).toBe(true);

    policy.succeeded();

    expect(policy.failed(failure)).toEqual({ pause: false, message: "Failed to fetch" });
  });

  it("counts failed network requests toward the same threshold", () => {
    const policy = createBunproReviewSavePolicy();

    expect(policy.failed(new TypeError("Failed to fetch"))).toEqual({ pause: false, message: "Failed to fetch" });
    expect(policy.failed(undefined)).toEqual({ pause: false, message: "Bunpro review could not be saved." });
    expect(policy.failed(new TypeError("Failed to fetch")).pause).toBe(true);
  });

  it("does not treat arbitrary messages containing status numbers as authentication failures", () => {
    const policy = createBunproReviewSavePolicy();
    const failure = new Error("Could not save review 401");

    expect(policy.failed(failure)).toEqual({ pause: false, message: failure.message });
  });

  it("shares consecutive failures and recovery across grammar and vocabulary consumers", () => {
    const policy = createBunproReviewSavePolicy();
    const grammar = policy;
    const vocabulary = policy;
    const failure = new Error("Bunpro request failed (500).");

    expect(grammar.failed(failure).pause).toBe(false);
    expect(vocabulary.failed(failure).pause).toBe(false);
    expect(grammar.failed(failure).pause).toBe(true);
    vocabulary.succeeded();
    expect(grammar.failed(failure).pause).toBe(false);
    expect(vocabulary.failed(failure).pause).toBe(false);
  });

  it("keeps failure counts isolated between sessions", () => {
    const firstSession = createBunproReviewSavePolicy();
    const secondSession = createBunproReviewSavePolicy();
    const failure = new Error("Bunpro request failed (500).");
    firstSession.failed(failure);
    firstSession.failed(failure);

    expect(firstSession.failed(failure).pause).toBe(true);
    expect(secondSession.failed(failure).pause).toBe(false);
  });
});
