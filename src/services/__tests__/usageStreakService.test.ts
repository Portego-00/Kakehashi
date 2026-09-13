import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { confirmUsageStreakSession, getCachedUsageStreakHistory, peekUsageStreakHistory, readUsageStreakHistory, subscribeUsageStreakHistory } from "../usageStreakService";

jest.mock("../../lib/supabase", () => ({ supabase: { rpc: jest.fn(), from: jest.fn() } }));
const rpc = jest.mocked(supabase.rpc);
const from = jest.mocked(supabase.from);
const getItem = jest.mocked(AsyncStorage.getItem);
const setItem = jest.mocked(AsyncStorage.setItem);
let sequence = 0;
let user: string;

function rpcResult(data: unknown, error: unknown = null) {
  rpc.mockReturnValue({ abortSignal: jest.fn().mockResolvedValue({ data, error }) } as never);
}
function legacyPages(pages: unknown[][]) {
  const query = { select: jest.fn(), eq: jest.fn(), order: jest.fn(), limit: jest.fn(), or: jest.fn(), abortSignal: jest.fn() };
  for (const method of [query.select, query.eq, query.order, query.limit, query.or]) method.mockReturnValue(query);
  query.abortSignal.mockImplementation(() => Promise.resolve({ data: pages.shift() ?? [], error: null }));
  from.mockReturnValue(query as never);
  return query;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-09-08T12:00:00Z"));
  user = `streak-test-${++sequence}`;
  jest.clearAllMocks();
  getItem.mockResolvedValue(null);
  setItem.mockResolvedValue();
});
afterEach(() => jest.useRealTimers());

it("uses one compact request and stores confirmed history only", async () => {
  rpcResult({ activeDays: ["2026-09-07", "2026-09-06", "2026-09-07"] });
  const result = await readUsageStreakHistory(user, "UTC");
  expect(result.activeDays).toEqual(["2026-09-06", "2026-09-07"]);
  expect(rpc).toHaveBeenCalledWith("get_app_session_active_days", { p_user_id: user, p_timezone: "UTC" });
  expect(from).not.toHaveBeenCalled();
  expect(JSON.parse(setItem.mock.calls[0][1]).activeDays).toEqual(result.activeDays);
  expect(result.activeDays).not.toContain("2026-09-08");
});

it("shares concurrent requests and reuses fresh data", async () => {
  rpcResult({ activeDays: ["2026-09-07"] });
  const [a, b] = await Promise.all([readUsageStreakHistory(user, "UTC"), readUsageStreakHistory(user, "UTC")]);
  expect(a).toBe(b);
  await readUsageStreakHistory(user, "UTC");
  expect(rpc).toHaveBeenCalledTimes(1);
  await readUsageStreakHistory(user, "UTC", { force: true });
  expect(rpc).toHaveBeenCalledTimes(2);
});

it("hydrates persistent history without waiting on the network and isolates account/timezone", async () => {
  getItem.mockResolvedValueOnce(JSON.stringify({ version: 1, userId: user, timezone: "UTC",
    source: "rpc", fetchedAt: Date.now(), activeDays: ["2026-09-07"] }));
  expect((await getCachedUsageStreakHistory(user, "UTC"))?.activeDays).toEqual(["2026-09-07"]);
  expect(rpc).not.toHaveBeenCalled();
  expect(await getCachedUsageStreakHistory(user, "Asia/Tokyo")).toBeNull();
  expect(await getCachedUsageStreakHistory("different-account", "UTC")).toBeNull();
});

it("refreshes at midnight even when its cache is less than five minutes old", async () => {
  jest.setSystemTime(new Date("2026-09-08T23:59:00Z"));
  rpcResult({ activeDays: ["2026-09-08"] });
  await readUsageStreakHistory(user, "UTC");
  jest.setSystemTime(new Date("2026-09-09T00:01:00Z"));
  await readUsageStreakHistory(user, "UTC");
  expect(rpc).toHaveBeenCalledTimes(2);
});

it("keeps the last good data and backs off on network errors without downloading raw history", async () => {
  rpcResult({ activeDays: ["2026-09-07"] });
  const prior = await readUsageStreakHistory(user, "UTC");
  jest.advanceTimersByTime(6 * 60_000);
  rpcResult(null, { code: "500", message: "Offline" });
  await expect(readUsageStreakHistory(user, "UTC")).rejects.toThrow("Offline");
  await expect(readUsageStreakHistory(user, "UTC")).rejects.toThrow("Offline");
  expect(peekUsageStreakHistory(user, "UTC")).toBe(prior);
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(from).not.toHaveBeenCalled();
});

it("falls back only for a missing function, paginates completely, and caches that download", async () => {
  rpcResult(null, { code: "PGRST202", message: "Missing function" });
  const query = legacyPages([Array.from({ length: 1000 }, () => ({ id: "00000000-0000-4000-8000-000000000001", session_started_at: "2026-09-07T00:30:00Z" })),
    [{ id: "00000000-0000-4000-8000-000000000001", session_started_at: "2026-09-06T00:30:00Z" }]]);
  const result = await readUsageStreakHistory(user, "America/Los_Angeles");
  expect(result.activeDays).toEqual(["2026-09-05", "2026-09-06"]);
  expect(query.limit.mock.calls).toEqual([[1000], [1000]]);
  expect(query.or).toHaveBeenCalledWith("session_started_at.lt.2026-09-07T00:30:00Z,and(session_started_at.eq.2026-09-07T00:30:00Z,id.lt.00000000-0000-4000-8000-000000000001)");
  expect(query.order).toHaveBeenCalledWith("id", { ascending: false });
  await readUsageStreakHistory(user, "America/Los_Angeles", { force: true });
  expect(rpc).toHaveBeenCalledTimes(1);
});

it("rejects incomplete legacy history at the former 30000-session cap", async () => {
  rpcResult(null, { code: "PGRST202", message: "Missing function" });
  const page = Array.from({ length: 1000 }, () => ({ id: "00000000-0000-4000-8000-000000000001", session_started_at: "2026-09-07T12:00:00Z" }));
  legacyPages([...Array.from({ length: 30 }, (_, i) => page.map((row) => ({ ...row, id: `00000000-0000-4000-8000-${String(100 - i).padStart(12, "0")}` }))), [page[0]]]);
  await expect(readUsageStreakHistory(user, "UTC")).rejects.toThrow("updated database reader");
  expect(peekUsageStreakHistory(user, "UTC")).toBeNull();
  expect(setItem).not.toHaveBeenCalled();
});

it.each([{}, { activeDays: ["2026-02-30"] }, { activeDays: null }])("does not cache a malformed response: %j", async (payload) => {
  rpcResult(payload);
  await expect(readUsageStreakHistory(user, "UTC")).rejects.toThrow("complete streak history");
  expect(setItem).not.toHaveBeenCalled();
  expect(from).not.toHaveBeenCalled();
});

it("returns new confirmed dates on refresh, including backdated inserts", async () => {
  rpcResult({ activeDays: ["2026-09-06", "2026-09-08"] });
  await readUsageStreakHistory(user, "UTC");
  rpcResult({ activeDays: ["2026-09-06", "2026-09-07", "2026-09-08"] });
  expect((await readUsageStreakHistory(user, "UTC", { force: true })).activeDays).toHaveLength(3);
});

it("does not turn a cache write failure into a streak failure", async () => {
  setItem.mockRejectedValueOnce(new Error("Storage full"));
  rpcResult({ activeDays: [] });
  await expect(readUsageStreakHistory(user, "UTC")).resolves.toMatchObject({ activeDays: [] });
});

it("preserves a server-confirmed startup session even if a pending read predates it", async () => {
  rpcResult({ activeDays: ["2026-09-07"] });
  const previous = await readUsageStreakHistory(user, "UTC");
  jest.advanceTimersByTime(1000);
  let resolve!: (value: unknown) => void;
  rpc.mockReturnValue({ abortSignal: () => new Promise((done) => { resolve = done; }) } as never);
  const pending = readUsageStreakHistory(user, "UTC", { force: true });
  await Promise.resolve();
  await Promise.resolve();
  const listener = jest.fn();
  const unsubscribe = subscribeUsageStreakHistory(listener);
  await confirmUsageStreakSession(user, "2026-09-08T11:00:00Z");
  expect(peekUsageStreakHistory(user, "UTC")).toMatchObject({
    activeDays: ["2026-09-07", "2026-09-08"], fetchedAt: previous.fetchedAt,
  });
  expect(listener).toHaveBeenCalledWith(user);
  resolve({ data: { activeDays: ["2026-09-07"] }, error: null });
  expect((await pending).activeDays).toEqual(["2026-09-07", "2026-09-08"]);
  expect(JSON.parse(setItem.mock.calls.at(-1)![1]).activeDays).toEqual(["2026-09-07", "2026-09-08"]);
  unsubscribe();
});

it("does not mistake one confirmed session for a complete history", async () => {
  await confirmUsageStreakSession(user, "2026-09-08T11:00:00Z");
  expect(peekUsageStreakHistory(user, "UTC")).toBeNull();
  expect(setItem).not.toHaveBeenCalled();
  rpcResult({ activeDays: ["2026-09-07"] });
  expect((await readUsageStreakHistory(user, "UTC")).activeDays).toEqual(["2026-09-07", "2026-09-08"]);
});

it("merges confirmed timestamps into each loaded timezone without changing another account", async () => {
  rpcResult({ activeDays: [] });
  await readUsageStreakHistory(user, "UTC");
  await readUsageStreakHistory(user, "America/Los_Angeles");
  await readUsageStreakHistory(`${user}-other`, "UTC");
  await confirmUsageStreakSession(user, "2026-09-08T00:30:00Z");
  expect(peekUsageStreakHistory(user, "UTC")?.activeDays).toEqual(["2026-09-08"]);
  expect(peekUsageStreakHistory(user, "America/Los_Angeles")?.activeDays).toEqual(["2026-09-07"]);
  expect(peekUsageStreakHistory(`${user}-other`, "UTC")?.activeDays).toEqual([]);
});
