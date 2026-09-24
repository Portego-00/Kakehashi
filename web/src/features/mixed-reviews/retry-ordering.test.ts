import { expect, it } from "vitest";
import type { MixedHead } from "./ordering";
import { mixedWrapUpLimits } from "./ordering";
import { mixedRetryCandidates, mixedRetryKey } from "./retry-ordering";

function head(ids: string[], open: string[] = []): MixedHead {
  return { id: ids[0], source: "wanikani", stage: 1, level: 1, available: 0, interval: 0, subjectType: "vocabulary", pending: ids.map(id => ({ id, subjectId: id, open: open.includes(id) })) };
}

it("counts questions from either service and retrieves a buried retry when its random gap expires", () => {
  const available = [{ lane: "wanikani", head: head(["new", "missed"], ["missed"]) }, { lane: "grammar", head: head(["grammar"]) }];
  const retries = new Map([[mixedRetryKey("wanikani", "missed"), { earliest: 3, after: 7, latest: 11 }]]);
  for (let turn = 1; turn < 7; turn++) expect(mixedRetryCandidates(available, retries, turn).map(entry => entry.question.id)).toEqual(["new", "grammar"]);
  expect(mixedRetryCandidates(available, retries, 7).map(entry => entry.question.id)).toEqual(["missed"]);
});

it("waits through other services when the retry is the only question in its own queue", () => {
  const available = [{ lane: "grammar", head: head(["missed"], ["missed"]) }, { lane: "wanikani", head: head(["new"]) }];
  const retries = new Map([[mixedRetryKey("grammar", "missed"), { earliest: 2, after: 6, latest: 10 }]]);
  expect(mixedRetryCandidates(available, retries, 1).map(entry => entry.lane)).toEqual(["wanikani"]);
  expect(mixedRetryCandidates(available, retries, 6).map(entry => entry.lane)).toEqual(["grammar"]);
  expect(mixedRetryCandidates(available.slice(0, 1), retries, 1).map(entry => entry.lane)).toEqual(["grammar"]);
});

it("shares the ten-open-subject cap and wrap-up budget across all providers", () => {
  const wk = Array.from({ length: 7 }, (_, i) => `wk${i}`);
  const bp = ["bp0", "bp1", "bp2"];
  const choices = mixedRetryCandidates([{ lane: "wanikani", head: head(["new", ...wk], wk) }, { lane: "grammar", head: head(["new-bp", ...bp], bp) }], new Map(), 20);
  expect(choices.map(entry => entry.question.id)).toEqual(["wk0", "bp0"]);
  expect(mixedWrapUpLimits(["wanikani", "grammar"], { wanikani: 200, grammar: 8 }, "grammar", 10, { wanikani: 7, grammar: 3 })).toEqual({ wanikani: 7, grammar: 3 });
});
