import { advanceReviewRetrySchedule, createReviewRetrySchedule, insertReviewRetry, orderReviewRetries, retainWrapUpReviews } from "../bunpro-review-retries";
import { createMixedReviewState, recordMixedReviewAnswer, reportMixedReviewHead, mixedWrapUpLimits } from "../mixedReviews";

it("spaces retries within two to ten questions and does not drop open items during wrapup", () => {
  const queue = Array.from({ length: 30 }, (_, id) => String(id));
  expect(insertReviewRetry(queue, ["retry"], { random: 0 }).indexOf("retry")).toBe(2);
  expect(insertReviewRetry(queue, ["retry"], { random: .99 }).indexOf("retry")).toBe(10);
  expect(retainWrapUpReviews(queue, new Set(["29"]), id => id, 1)).toEqual(["29"]);
});
it("promotes a due retry before introducing more new items", () => {
  let schedule = advanceReviewRetrySchedule(createReviewRetrySchedule(), ["miss"], false, 0);
  schedule = { ...schedule, turn: 3 };
  expect(orderReviewRetries(["new", "other", "miss"], new Set(["miss"]), id => id, id => id, schedule)[0]).toBe("miss");
});
it("uses mixed questions as the clock for retrying Bunpro and protects all open wrapup subjects", () => {
  let state = createMixedReviewState("grammar");
  state = reportMixedReviewHead(state, "wanikani", { id: "wk:1" }, 0);
  state = reportMixedReviewHead(state, "grammar", { id: "bp:1" }, 0);
  state = recordMixedReviewAnswer(state, "grammar", "bunpro:miss", false, 0);
  state = recordMixedReviewAnswer(state, "wanikani", "wanikani:2", true);
  state = recordMixedReviewAnswer(state, "wanikani", "wanikani:3", true);
  state = reportMixedReviewHead(state, "grammar", { id: "bp:new", retryKey: "new", pending: [{ id: "new", subjectId: "new", open: false }, { id: "miss", subjectId: "miss", open: true }], activate: () => {} }, 0);
  state = reportMixedReviewHead(state, "wanikani", { id: "wk:next" }, 0);
  expect(state.active).toBe("grammar");
  expect(state.promotion).toEqual({ lane: "grammar", id: "miss" });
  expect(mixedWrapUpLimits(["wanikani", "grammar"], { wanikani: 20, grammar: 20 }, "wanikani", 1, { wanikani: 2, grammar: 3 })).toEqual({ wanikani: 2, grammar: 3, vocab: 0 });
});
