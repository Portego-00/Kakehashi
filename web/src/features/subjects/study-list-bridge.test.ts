import { beforeEach, describe, expect, it } from "vitest";
import { subjectListsKey } from "@/features/study/storage";
import { bridgeListsToStudy } from "./study-list-bridge";

const list = { id: "list-1", name: "Trouble", subjectIds: [440], createdAt: "2026-08-06", updatedAt: "2026-08-06" };

describe("subject-list study bridge", () => {
  beforeEach(() => window.localStorage.clear());

  it("writes only to the active WaniKani account namespace", () => {
    expect(bridgeListsToStudy(42, [list])).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(subjectListsKey(42)) ?? "[]")).toEqual([list]);
    expect(window.localStorage.getItem(subjectListsKey(99))).toBeNull();
    expect(window.localStorage.getItem("kakehashi:study:v1:subject-lists")).toBeNull();
  });

  it("does not create an anonymous bridge before the session resolves", () => {
    expect(bridgeListsToStudy(undefined, [list])).toBe(false);
    expect(window.localStorage.length).toBe(0);
  });
});
