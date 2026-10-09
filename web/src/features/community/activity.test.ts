import { beforeEach, describe, expect, it } from "vitest";
import { hasUnreadReply, markCommunityRead, readCommunityVisits } from "./activity";

const reply = { id: "reply", createdAt: "2026-10-08T12:00:00Z", username: "Another learner" };
const participation = "2026-10-07T12:00:00Z";
beforeEach(() => localStorage.clear());
describe("community reply visits", () => {
  it("clears observed replies, persists across reloads, and flags later replies", () => {
    expect(hasUnreadReply(reply, undefined, participation)).toBe(true);
    markCommunityRead(localStorage, "Viewer", "thread", reply.createdAt);
    const visits = readCommunityVisits(localStorage, "viewer");
    expect(hasUnreadReply(reply, visits.thread, participation)).toBe(false);
    expect(hasUnreadReply({ ...reply, createdAt: "2026-10-08T12:01:00Z" }, visits.thread, participation)).toBe(true);
  });
  it("isolates accounts and never moves a read marker backwards", () => {
    markCommunityRead(localStorage, "Viewer", "thread", reply.createdAt);
    markCommunityRead(localStorage, "Viewer", "thread", participation);
    expect(readCommunityVisits(localStorage, "viewer").thread).toBe(reply.createdAt);
    expect(readCommunityVisits(localStorage, "other")).toEqual({});
  });
  it("ignores replies made before joining and malformed saved visits", () => {
    expect(hasUnreadReply({ ...reply, createdAt: participation }, undefined, participation)).toBe(false);
    localStorage.setItem("kakehashi-web:community-read:viewer:v1", '{"thread":42,"other":"broken"}');
    expect(readCommunityVisits(localStorage, "viewer")).toEqual({});
  });
});
