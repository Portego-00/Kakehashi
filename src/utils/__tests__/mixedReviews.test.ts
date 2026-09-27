import { chooseMixedReviewLane, createMixedReviewState, mixedWrapUpLimits, reportMixedReviewError, reportMixedReviewHead, trimMixedWaniKaniQueue } from "../mixedReviews";

describe("mixed review scheduling", () => {
  it("waits for every provider, alternates ready providers, and completes only when all drain", () => {
    let state = createMixedReviewState("grammar");
    state = reportMixedReviewHead(state, "wanikani", { id: "wk:1" }, 0);
    expect(state.started).toBe(false);
    state = reportMixedReviewHead(state, "grammar", { id: "bp:1" }, 0);
    expect(state.active).toBe("wanikani");
    state = reportMixedReviewHead(state, "wanikani", { id: "wk:2" }, 0);
    expect(state.active).toBe("grammar");
    state = reportMixedReviewHead(state, "grammar", null, 0);
    expect(state.active).toBe("wanikani");
    expect(state.complete).toBe(false);
    state = reportMixedReviewHead(state, "wanikani", null, 0);
    expect(state.complete).toBe(true);
  });

  it("ignores duplicate reports and does not switch on an inactive queue update", () => {
    let state = createMixedReviewState("grammar");
    state = reportMixedReviewHead(state, "wanikani", { id: "wk:1" }, 0);
    state = reportMixedReviewHead(state, "grammar", { id: "bp:1" }, 0);
    expect(reportMixedReviewHead(state, "wanikani", { id: "wk:1" }, 0)).toBe(state);
    state = reportMixedReviewHead(state, "grammar", { id: "bp:2" }, 0);
    expect(state.active).toBe("wanikani");
    state = reportMixedReviewHead(state, "wanikani", { id: "wk:1:retry" }, 0);
    expect(state.active).toBe("grammar");
  });

  it("keeps paired WK questions together while alternating the provider's ordered queues", () => {
    const available = [{ lane: "wanikani" as const, head: { id: "wk:reading", keepTurn: true } }, { lane: "grammar" as const, head: { id: "bp:1" } }];
    expect(chooseMixedReviewLane(available, "wanikani", true, 0.9)).toBe("wanikani");
    expect(chooseMixedReviewLane([{ ...available[0], head: { id: "wk:2" } }, available[1]], "wanikani", true, 0)).toBe("grammar");
  });

  it("surfaces provider errors and cannot turn failure into a completed session", () => {
    let state = createMixedReviewState("all");
    state = reportMixedReviewHead(state, "wanikani", null, 0);
    state = reportMixedReviewHead(state, "grammar", null, 0);
    state = reportMixedReviewError(state, "vocab", "Could not load vocabulary");
    state = reportMixedReviewHead(state, "vocab", null, 0);
    expect(state.active).toBe("vocab");
    expect(state.complete).toBe(false);
    state = reportMixedReviewError(state, "vocab", null);
    expect(state.complete).toBe(false);
    state = reportMixedReviewHead(state, "vocab", { id: "bp:retry" }, 0);
    expect(state.started).toBe(true);
    expect(state.active).toBe("vocab");
    state = reportMixedReviewHead(state, "vocab", null, 0);
    expect(state.complete).toBe(true);
  });

  it("runs remaining Bunpro work when WK has no reviews", () => {
    let state = createMixedReviewState("vocab");
    state = reportMixedReviewHead(state, "vocab", { id: "bp:1" }, 0);
    state = reportMixedReviewHead(state, "wanikani", null, 0);
    expect(state.started).toBe(true);
    expect(state.active).toBe("vocab");
  });

  it("keeps a failed occurrence active while retrying the same save", () => {
    let state = createMixedReviewState("grammar");
    state = reportMixedReviewHead(state, "wanikani", { id: "wk:1" }, 0);
    state = reportMixedReviewHead(state, "grammar", { id: "bp:1" }, 0);
    state = reportMixedReviewError(state, "grammar", "Could not save");
    state = reportMixedReviewError(state, "grammar", null);
    state = reportMixedReviewHead(state, "grammar", { id: "bp:1" }, 0);
    expect(state.active).toBe("grammar");
    state = reportMixedReviewHead(state, "grammar", { id: "bp:2" }, 0);
    expect(state.active).toBe("wanikani");
  });

  it("keeps a second provider's error visible after the first provider recovers", () => {
    let state = createMixedReviewState("all");
    state = reportMixedReviewError(state, "grammar", "Grammar failed");
    state = reportMixedReviewError(state, "vocab", "Vocabulary failed");
    state = reportMixedReviewError(state, "vocab", null);
    expect(state.active).toBe("grammar");
    expect(state.complete).toBe(false);
  });

  it("allocates one wrap-up budget across lanes and does not allocate empty lanes", () => {
    expect(mixedWrapUpLimits(["wanikani", "grammar", "vocab"], { wanikani: 20, grammar: 30, vocab: 15 }, "grammar", 10)).toEqual({ wanikani: 3, grammar: 4, vocab: 3 });
    expect(mixedWrapUpLimits(["wanikani", "grammar"], { wanikani: 1, grammar: 30 }, "wanikani", 10)).toEqual({ wanikani: 1, grammar: 9, vocab: 0 });
    expect(mixedWrapUpLimits(["wanikani", "grammar"], { wanikani: 2, grammar: 30 }, "grammar", 1)).toEqual({ wanikani: 0, grammar: 1, vocab: 0 });
  });

  it("wraps up WK without dropping half-completed or previously missed items", () => {
    const questions = [{ itemId: 1, type: "meaning" }, { itemId: 2, type: "reading" }, { itemId: 1, type: "reading" }, { itemId: 3, type: "meaning" }];
    expect(trimMixedWaniKaniQueue(questions, 1, [])).toEqual([questions[0], questions[2]]);
    expect(trimMixedWaniKaniQueue(questions, 0, [2])).toEqual([questions[1]]);
    expect(trimMixedWaniKaniQueue(questions, 0, [])).toEqual([]);
  });
});
