import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchUsageStreak } from "./usage-streak";
import { useUsageStreak } from "./use-usage-streak";

const timezone = vi.hoisted(() => vi.fn(() => "UTC"));
vi.mock("./usage-streak", async (importOriginal) => ({ ...await importOriginal<typeof import("./usage-streak")>(), browserTimezone: timezone }));
const now = new Date("2026-08-25T12:00:00Z");
const days = ["2026-08-23", "2026-08-24", "2026-08-25"];
function response(userId = "123") { return new Response(JSON.stringify({ activeDays: days, available: true, userId })); }
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; };
}
const initialProps = { userId: "123", username: "Tester", now, enabled: true };

describe("streak dashboard cache lifecycle", () => {
  beforeEach(() => { localStorage.clear(); timezone.mockReturnValue("UTC"); vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => vi.unstubAllGlobals());

  it("renders a stale persisted streak immediately while refreshing in the background", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response());
    await fetchUsageStreak({ ...initialProps, timezone: "UTC", now: new Date(now.getTime() - 10 * 60_000) });
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(() => {}));
    const { result } = renderHook(() => useUsageStreak(initialProps), { wrapper: wrapper() });
    expect(result.current.data?.current).toBe(3);
    expect(result.current.isLoading).toBe(false);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(result.current.isFetching).toBe(true);
  });

  it("shares one in-flight request for duplicate dashboard consumers", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response());
    const { result } = renderHook(() => [useUsageStreak(initialProps), useUsageStreak(initialProps)], { wrapper: wrapper() });
    await waitFor(() => expect(result.current[0].data?.current).toBe(3));
    expect(result.current[1].data?.current).toBe(3);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("cancels the previous account request and does not display its history", async () => {
    let finishFirst!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((resolve) => { finishFirst = resolve; }));
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ activeDays: ["2026-08-25"], available: true, userId: "456" })));
    const { result, rerender } = renderHook((props) => useUsageStreak(props), { initialProps, wrapper: wrapper() });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const oldSignal = vi.mocked(fetch).mock.calls[0][1]?.signal;
    rerender({ ...initialProps, userId: "456", username: "Other" });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data?.current).toBe(1));
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => finishFirst(response()));
    expect(result.current.data?.current).toBe(1);
    expect([...Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))].some((key) => key?.includes(":123:"))).toBe(false);
  });

  it("recomputes cached data at midnight and refreshes after timezone changes", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response()).mockResolvedValueOnce(response()).mockResolvedValueOnce(response());
    const { result, rerender } = renderHook((props) => useUsageStreak(props), { initialProps, wrapper: wrapper() });
    await waitFor(() => expect(result.current.data?.current).toBe(3));
    rerender({ ...initialProps, now: new Date("2026-08-26T00:01:00Z") });
    expect(result.current.data?.current).toBe(4);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    timezone.mockReturnValue("Asia/Tokyo");
    rerender({ ...initialProps, now: new Date("2026-08-26T00:02:00Z") });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    expect(String(vi.mocked(fetch).mock.calls[2][0])).toContain("Asia%2FTokyo");
  });
});
