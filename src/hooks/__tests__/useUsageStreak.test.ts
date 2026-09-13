import { act, renderHook } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import { getCachedUsageStreakHistory, peekUsageStreakHistory, readUsageStreakHistory, type UsageStreakHistory } from "../../services/usageStreakService";
import * as calendar from "../../utils/usageStreak";
import { useUsageStreak } from "../useUsageStreak";

jest.mock("../../services/usageStreakService", () => ({
  getCachedUsageStreakHistory: jest.fn(), peekUsageStreakHistory: jest.fn(), readUsageStreakHistory: jest.fn(),
  subscribeUsageStreakHistory: jest.fn(() => () => {}),
}));
const cached = jest.mocked(getCachedUsageStreakHistory);
const peek = jest.mocked(peekUsageStreakHistory);
const read = jest.mocked(readUsageStreakHistory);
const history = (activeDays: string[]): UsageStreakHistory => ({ activeDays, source: "rpc", fetchedAt: Date.now() });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
async function flush() { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); }

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-09-08T12:00:00Z"));
  jest.spyOn(calendar, "getTimezone").mockReturnValue("UTC");
  cached.mockReset().mockResolvedValue(null);
  peek.mockReset().mockReturnValue(null);
  read.mockReset().mockResolvedValue(history(["2026-09-07"]));
  Object.defineProperty(AppState, "currentState", { configurable: true, value: "active" });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

it("shows cached history while refreshing and retains it after a failure", async () => {
  const prior = history(["2026-09-06", "2026-09-07"]);
  cached.mockResolvedValue(prior);
  peek.mockReturnValue(prior);
  const request = deferred<UsageStreakHistory>();
  read.mockReturnValue(request.promise);
  const { result } = renderHook(() => useUsageStreak("account-a"));
  expect(result.current.currentStreak).toBe(3);
  expect(result.current.isLoading).toBe(false);
  await flush();
  expect(read).toHaveBeenCalledTimes(1);
  await act(async () => request.reject(new Error("Offline")));
  expect(result.current.currentStreak).toBe(3);
  expect(result.current.error).toBe("Offline");
  expect(prior.activeDays).toEqual(["2026-09-06", "2026-09-07"]);
});

it("never displays an old account response after switching accounts", async () => {
  const old = deferred<UsageStreakHistory>();
  read.mockImplementation((id) => id === "account-a" ? old.promise : Promise.resolve(history([])));
  const { result, rerender } = renderHook<ReturnType<typeof useUsageStreak>, { user?: string }>(({ user }) => useUsageStreak(user), {
    initialProps: { user: "account-a" },
  });
  await flush();
  rerender({ user: "account-b" });
  await flush();
  expect(result.current.currentStreak).toBe(1);
  await act(async () => old.resolve(history(["2026-09-06", "2026-09-07"])));
  expect(result.current.currentStreak).toBe(1);
  rerender({ user: undefined });
  await flush();
  expect(result.current.currentStreak).toBe(0);
  expect(result.current.activeToday).toBe(false);
});

it("updates day rollover locally and refreshes once, without polling on ordinary ticks", async () => {
  jest.setSystemTime(new Date("2026-09-08T23:59:40Z"));
  read.mockResolvedValue(history(["2026-09-07", "2026-09-08"]));
  const { result } = renderHook(() => useUsageStreak("account-a"));
  await flush();
  expect(result.current.currentStreak).toBe(2);
  await act(async () => { await jest.advanceTimersByTimeAsync(30_000); });
  expect(result.current.currentStreak).toBe(3);
  expect(result.current.recentDays.at(-1)?.dayKey).toBe("2026-09-09");
  expect(read).toHaveBeenCalledTimes(2);
  await act(async () => { await jest.advanceTimersByTimeAsync(90_000); });
  expect(read).toHaveBeenCalledTimes(2);
});

it("regroups history after travel and ignores the old timezone response", async () => {
  const old = deferred<UsageStreakHistory>();
  read.mockImplementation((_id, zone) => zone === "UTC" ? old.promise : Promise.resolve(history(["2026-09-07"])));
  const { result } = renderHook(() => useUsageStreak("account-a"));
  await flush();
  jest.mocked(calendar.getTimezone).mockReturnValue("Asia/Tokyo");
  await act(async () => { await jest.advanceTimersByTimeAsync(30_000); });
  expect(result.current.timezone).toBe("Asia/Tokyo");
  expect(read).toHaveBeenLastCalledWith("account-a", "Asia/Tokyo", { force: false });
  await act(async () => old.resolve(history(["2026-09-05", "2026-09-06", "2026-09-07"])));
  expect(result.current.currentStreak).toBe(2);
});

it("honors manual refresh without hiding the previous result", async () => {
  const { result } = renderHook(() => useUsageStreak("account-a"));
  await flush();
  const next = deferred<UsageStreakHistory>();
  read.mockReturnValue(next.promise);
  act(() => { void result.current.refresh(); });
  await flush();
  expect(result.current.currentStreak).toBe(2);
  expect(result.current.isLoading).toBe(false);
  expect(read).toHaveBeenLastCalledWith("account-a", "UTC", { force: true });
  await act(async () => next.resolve(history(["2026-09-06", "2026-09-07"])));
  expect(result.current.currentStreak).toBe(3);
});

it("refreshes when returning to the foreground and releases listeners on unmount", async () => {
  let onChange: ((status: AppStateStatus) => void) | undefined;
  const remove = jest.fn();
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, callback) => {
    onChange = callback;
    return { remove };
  });
  const { unmount } = renderHook(() => useUsageStreak("account-a"));
  await flush();
  act(() => onChange?.("background"));
  expect(read).toHaveBeenCalledTimes(1);
  act(() => onChange?.("active"));
  await flush();
  expect(read).toHaveBeenCalledTimes(2);
  unmount();
  expect(remove).toHaveBeenCalled();
  jest.setSystemTime(new Date("2026-09-09T12:00:00Z"));
  await act(async () => { await jest.advanceTimersByTimeAsync(30_000); });
  expect(read).toHaveBeenCalledTimes(2);
});
