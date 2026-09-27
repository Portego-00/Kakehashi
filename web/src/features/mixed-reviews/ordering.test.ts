import { expect, it } from "vitest";
import { DEFAULT_WEB_SETTINGS } from "@/features/settings/settings";
import { chooseMixedLane, compareMixedHeads, type MixedHead } from "./ordering";
const wk: MixedHead = { id: "1", source: "wanikani", stage: 3, level: 12, available: 100, interval: 100, subjectType: "kanji" };
const bp: MixedHead = { id: "2", source: "bunpro", stage: 6, level: 2, available: 200, interval: 200, subjectType: "vocabulary" };
it("can repeat a source and drains a remaining service", () => {
  expect(chooseMixedLane([{lane:"wanikani",head:wk},{lane:"bunpro",head:bp}], DEFAULT_WEB_SETTINGS.study, "wanikani", true, 0)).toBe("wanikani");
  expect(chooseMixedLane([{lane:"wanikani",head:wk},{lane:"bunpro",head:bp}], DEFAULT_WEB_SETTINGS.study, "bunpro", false, .1)).toBe("wanikani");
  expect(chooseMixedLane([{lane:"bunpro",head:bp}], DEFAULT_WEB_SETTINGS.study, "wanikani", false)).toBe("bunpro");
});
it.each(["ascendingSrsStage", "descendingSrsStage", "oldestAvailableFirst", "newestAvailableFirst"] as const)("interleaves already-ordered queues with %s", (reviewOrder) => {
  expect(chooseMixedLane([{lane:"wanikani",head:wk},{lane:"bunpro",head:bp}], { ...DEFAULT_WEB_SETTINGS.study, reviewOrder }, "wanikani", true, 0)).toBe("wanikani");
});
it("keeps back-to-back WaniKani questions together", () => {
  expect(chooseMixedLane([{lane:"wanikani",head:{...wk,keepTurn:true}},{lane:"bunpro",head:bp}], DEFAULT_WEB_SETTINGS.study, "wanikani", true, .9)).toBe("wanikani");
});
it("preserves service-specific levels and compares relative wait", () => {
  expect(compareMixedHeads(wk, bp, { ...DEFAULT_WEB_SETTINGS.study, reviewOrder: "lowestLevelFirst" })).toBe(0);
  expect(compareMixedHeads(wk, bp, { ...DEFAULT_WEB_SETTINGS.study, reviewOrder: "longestRelativeWait" }, 1000)).toBeLessThan(0);
});


it("shares a single wrap-up budget across all mixed lanes", async () => {
  const { mixedWrapUpLimits } = await import("./ordering");
  expect(mixedWrapUpLimits(["wanikani", "grammar", "vocab"], { wanikani: 20, grammar: 30, vocab: 15 }, "grammar", 10)).toEqual({ wanikani: 3, grammar: 4, vocab: 3 });
  expect(mixedWrapUpLimits(["wanikani", "grammar"], { wanikani: 1, grammar: 30 }, "wanikani", 10)).toEqual({ wanikani: 1, grammar: 9 });
  expect(mixedWrapUpLimits(["wanikani", "grammar"], { wanikani: 2, grammar: 30 }, "grammar", 1)).toEqual({ wanikani: 0, grammar: 1 });
});


it("weights source selection by remaining reviews instead of alternating", () => {
  const available = [{ lane: "wanikani", head: { ...wk, remaining: 200 } }, { lane: "bunpro", head: { ...bp, remaining: 8 } }];
  const counts = { wanikani: 0, bunpro: 0 };
  for (let i = 0; i < 208; i++) {
    const lane = chooseMixedLane(available, DEFAULT_WEB_SETTINGS.study, "wanikani", true, (i + .5) / 208);
    counts[lane as keyof typeof counts]++;
  }
  expect(counts).toEqual({ wanikani: 200, bunpro: 8 });
});

it("does not overrepresent Bunpro when grammar and vocabulary are both enabled", () => {
  const available = [{ lane: "wanikani", head: { ...wk, remaining: 200 } }, { lane: "grammar", head: { ...bp, remaining: 3 } }, { lane: "vocab", head: { ...bp, remaining: 5 } }];
  const counts: Record<string, number> = {};
  for (let i = 0; i < 208; i++) {
    const lane = chooseMixedLane(available, DEFAULT_WEB_SETTINGS.study, "wanikani", true, (i + .5) / 208);
    counts[lane] = (counts[lane] ?? 0) + 1;
  }
  expect(counts).toEqual({ wanikani: 200, grammar: 3, vocab: 5 });
});

it("spreads a small queue throughout a seeded complete session", () => {
  let seed = 42;
  const remaining = { wanikani: 200, bunpro: 8 };
  let previous: keyof typeof remaining = "wanikani";
  const bunproPositions: number[] = [];
  for (let index = 0; index < 208; index++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const available = (Object.keys(remaining) as (keyof typeof remaining)[]).filter(lane => remaining[lane] > 0).map(lane => ({ lane, head: { ...(lane === "wanikani" ? wk : bp), remaining: remaining[lane] } }));
    previous = chooseMixedLane(available, DEFAULT_WEB_SETTINGS.study, previous, true, seed / 2 ** 32);
    remaining[previous]--;
    if (previous === "bunpro") bunproPositions.push(index);
  }
  expect(remaining).toEqual({ wanikani: 0, bunpro: 0 });
  expect(bunproPositions).toHaveLength(8);
  expect(bunproPositions.at(-1)).toBeGreaterThan(104);
  expect(bunproPositions.filter(index => index < 16).length).toBeLessThan(4);
});
