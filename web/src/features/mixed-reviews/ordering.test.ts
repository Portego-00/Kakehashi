import { expect, it } from "vitest";
import { DEFAULT_WEB_SETTINGS } from "@/features/settings/settings";
import { chooseMixedLane, compareMixedHeads, type MixedHead } from "./ordering";
const wk: MixedHead = { id: "1", source: "wanikani", stage: 3, level: 12, available: 100, interval: 100, subjectType: "kanji" };
const bp: MixedHead = { id: "2", source: "bunpro", stage: 6, level: 2, available: 200, interval: 200, subjectType: "vocabulary" };
it("interleaves random queues and drains a remaining service", () => {
  expect(chooseMixedLane([{lane:"wanikani",head:wk},{lane:"bunpro",head:bp}], DEFAULT_WEB_SETTINGS.study, "wanikani", true, 0)).toBe("bunpro");
  expect(chooseMixedLane([{lane:"wanikani",head:wk},{lane:"bunpro",head:bp}], DEFAULT_WEB_SETTINGS.study, "bunpro", false, .1)).toBe("wanikani");
  expect(chooseMixedLane([{lane:"bunpro",head:bp}], DEFAULT_WEB_SETTINGS.study, "wanikani", false)).toBe("bunpro");
});
it.each(["ascendingSrsStage", "descendingSrsStage", "oldestAvailableFirst", "newestAvailableFirst"] as const)("interleaves already-ordered queues with %s", (reviewOrder) => {
  expect(chooseMixedLane([{lane:"wanikani",head:wk},{lane:"bunpro",head:bp}], { ...DEFAULT_WEB_SETTINGS.study, reviewOrder }, "wanikani", true, 0)).toBe("bunpro");
});
it("keeps back-to-back WaniKani questions together", () => {
  expect(chooseMixedLane([{lane:"wanikani",head:{...wk,keepTurn:true}},{lane:"bunpro",head:bp}], DEFAULT_WEB_SETTINGS.study, "wanikani", true, .9)).toBe("wanikani");
});
it("preserves service-specific levels and compares relative wait", () => {
  expect(compareMixedHeads(wk, bp, { ...DEFAULT_WEB_SETTINGS.study, reviewOrder: "lowestLevelFirst" })).toBe(0);
  expect(compareMixedHeads(wk, bp, { ...DEFAULT_WEB_SETTINGS.study, reviewOrder: "longestRelativeWait" }, 1000)).toBeLessThan(0);
});
