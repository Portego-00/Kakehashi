import React from "react";
import { act, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { useBunproDashboard } from "../useBunproDashboard";
import { BunproApiError, getActiveBunproApiToken, getBunproAnalytics, getBunproDue, getBunproQueue } from "../../utils/bunproApi";

const mockAuthState = { userData: { username: "Portego", id: 1 }, apiToken: "wk-fixture" };
jest.mock("../../utils/store", () => ({ useAuthStore: (selector: (state: typeof mockAuthState) => unknown) => selector(mockAuthState) }));
jest.mock("expo-router", () => ({ useFocusEffect: (callback: () => (() => void)) => jest.requireActual("react").useEffect(callback, [callback]) }));
jest.mock("../../utils/bunproApi", () => ({ ...jest.requireActual("../../utils/bunproApi"), getActiveBunproApiToken: jest.fn(), getBunproDue: jest.fn(), getBunproQueue: jest.fn(), getBunproAnalytics: jest.fn() }));
let dashboard: ReturnType<typeof useBunproDashboard>;
function Harness({ scope = "home", refreshKey = 0 }: { scope?: "home" | "analytics"; refreshKey?: number }) {
  dashboard = useBunproDashboard({ scope, refreshKey });
  return <Text>{dashboard.status}</Text>;
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(res => { resolve = res; }); return { promise, resolve }; }
const due = { total_due_grammar: 4, total_due_vocab: 8 };

describe("Portego-only Bunpro data", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.userData = { username: "Portego", id: 1 };
    jest.mocked(getActiveBunproApiToken).mockResolvedValue("fixture-key");
    jest.mocked(getBunproDue).mockResolvedValue(due);
    jest.mocked(getBunproQueue).mockResolvedValue({ data: [] });
  });
  it.each([
    ["home", "AnotherUser"], ["analytics", "AnotherUser"],
    ["home", ""], ["analytics", ""],
  ] as const)("does not read credentials or request %s data without access (%s)", async (scope, username) => {
    mockAuthState.userData.username = username;
    render(<Harness scope={scope} />);
    await act(async () => {});
    expect(dashboard.status).toBe("disabled");
    expect(getActiveBunproApiToken).not.toHaveBeenCalled();
    expect(getBunproDue).not.toHaveBeenCalled();
    expect(getBunproQueue).not.toHaveBeenCalled();
    expect(getBunproAnalytics).not.toHaveBeenCalled();
  });
  it("requests only due counts and queue on home, and shows a connection state without a key", async () => {
    const screen = render(<Harness />);
    await act(async () => {});
    expect(dashboard.due).toEqual(due);
    expect(dashboard.status).toBe("ready");
    expect(getBunproAnalytics).not.toHaveBeenCalled();
    jest.mocked(getActiveBunproApiToken).mockResolvedValue(null);
    screen.rerender(<Harness refreshKey={1} />);
    await act(async () => {});
    expect(dashboard.status).toBe("unconfigured");
    expect(dashboard.due).toBeNull();
    expect(getBunproDue).toHaveBeenCalledTimes(1);
  });
  it("aborts requests on account changes and rejects old successful responses", async () => {
    const pending = deferred<typeof due>();
    jest.mocked(getBunproDue).mockReturnValueOnce(pending.promise);
    const screen = render(<Harness />);
    await act(async () => {});
    const signal = jest.mocked(getBunproDue).mock.calls[0][0]?.signal;
    mockAuthState.userData = { username: "AnotherUser", id: 2 };
    screen.rerender(<Harness />);
    await act(async () => { pending.resolve(due); });
    expect(signal?.aborted).toBe(true);
    expect(dashboard.status).toBe("disabled");
    expect(dashboard.due).toBeNull();
  });
  it("keeps only the latest refresh and clears old data when a token is replaced", async () => {
    render(<Harness />);
    await act(async () => {});
    const pending = deferred<typeof due>();
    jest.mocked(getBunproDue).mockReturnValueOnce(pending.promise);
    jest.mocked(getActiveBunproApiToken).mockResolvedValue("replacement-key");
    let refresh: Promise<void>;
    await act(async () => { refresh = dashboard.refresh(); });
    expect(dashboard.due).toBeNull();
    expect(dashboard.status).toBe("loading");
    await act(async () => { pending.resolve({ total_due_grammar: 1, total_due_vocab: 2 }); await refresh!; });
    expect(dashboard.due?.total_due_grammar).toBe(1);
  });
  it("preserves cached data on network errors, but removes it on authentication errors", async () => {
    render(<Harness />);
    await act(async () => {});
    jest.mocked(getBunproDue).mockRejectedValueOnce(new Error("offline"));
    await act(async () => { await dashboard.refresh(); });
    expect(dashboard.due).toEqual(due);
    expect(dashboard.error).toBeTruthy();
    jest.mocked(getBunproDue).mockRejectedValueOnce(new BunproApiError("Unauthorized", 401));
    await act(async () => { await dashboard.refresh(); });
    expect(dashboard.due).toBeNull();
    expect(dashboard.error).toContain("reconnecting");
  });
  it("rejects malformed due counts without publishing an unusable home dashboard", async () => {
    jest.mocked(getBunproDue).mockResolvedValueOnce({ total_due_grammar: -1, total_due_vocab: 2 });
    render(<Harness />);
    await act(async () => {});
    expect(dashboard.status).toBe("error");
    expect(dashboard.due).toBeNull();
  });
});
