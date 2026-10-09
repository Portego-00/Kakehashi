import AsyncStorage from "@react-native-async-storage/async-storage";
import { isUnreadIssueActivity, loadIssueVisits, markIssueRead } from "../issueReadState";
import type { IssueActivity } from "../../services/issueActivityService";
const item = { issue: { id: "thread" }, participatedAt: "2026-10-01T12:00:00Z", latestReply: { id: "reply", createdAt: "2026-10-08T12:00:00Z", username: "Other" } } as IssueActivity;
it("persists observed replies per account and flags subsequent replies", async () => {
  expect(isUnreadIssueActivity(item, {})).toBe(true);
  await markIssueRead("reader", "thread", item.latestReply!.createdAt);
  expect(isUnreadIssueActivity(item, await loadIssueVisits("reader"))).toBe(false);
  expect(isUnreadIssueActivity({ ...item, latestReply: { ...item.latestReply!, createdAt: "2026-10-08T12:01:00Z" } }, await loadIssueVisits("reader"))).toBe(true);
  expect(await loadIssueVisits("other-reader")).toEqual({});
  expect(AsyncStorage.setItem).toHaveBeenCalledWith("community:read:reader:v1", JSON.stringify({ thread: item.latestReply!.createdAt }));
});
it("does not move markers backwards or discard other threads on concurrent reads", async () => {
  await Promise.all([markIssueRead("concurrent", "a", "2026-10-08T12:00:00Z"), markIssueRead("concurrent", "b", "2026-10-08T13:00:00Z")]);
  await markIssueRead("concurrent", "a", "2026-10-07T12:00:00Z");
  expect(await loadIssueVisits("concurrent")).toEqual({ a: "2026-10-08T12:00:00Z", b: "2026-10-08T13:00:00Z" });
});
