import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_USER, isDemoMode, setDemoMode } from "@/features/demo/runtime";
import { SessionProvider, useSession } from "./session";
const mocks = vi.hoisted(() => ({ seed: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/features/demo/media", () => ({ seedDemoLibrary: mocks.seed }));
vi.mock("@/features/demo/study", () => ({ seedDemoStudy: vi.fn() }));
let session: ReturnType<typeof useSession>;
function Consumer() {
  const value = useSession();
  useEffect(() => { session = value; }, [value]);
  return <span>{value.status}:{value.isDemo ? "demo" : value.user?.data.username ?? "guest"}</span>;
}
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><SessionProvider><Consumer /></SessionProvider></QueryClientProvider>);
  return client;
}
const realUser = { ...DEMO_USER, id: 42, data: { ...DEMO_USER.data, id: "42", username: "Real learner" } };
describe("demo session transitions", () => {
  beforeEach(() => { setDemoMode(false); window.localStorage.clear(); mocks.seed.mockClear(); });
  afterEach(() => { setDemoMode(false); vi.unstubAllGlobals(); });
  it("seeds once on entry, clears stale data on account switches, and does not send a token for demo", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(Response.json({ user: DEMO_USER, demo: true }))
      .mockResolvedValueOnce(Response.json({ user: realUser }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    const client = mount();
    await screen.findByText("anonymous:guest");
    client.setQueryData(["wanikani", "subjects"], ["old account data"]);
    await act(async () => { await session.startDemo(); });
    expect(screen.getByText("authenticated:demo")).toBeInTheDocument();
    expect(isDemoMode()).toBe(true);
    expect(client.getQueryData(["wanikani", "subjects"])).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith("/api/session/demo", { method: "POST" });
    expect(mocks.seed).toHaveBeenCalledTimes(1);
    client.setQueryData(["wanikani", "subjects"], ["demo subjects"]);
    await act(async () => { await session.signIn("user-supplied-token"); });
    expect(screen.getByText("authenticated:Real learner")).toBeInTheDocument();
    expect(isDemoMode()).toBe(false);
    expect(client.getQueryData(["wanikani", "subjects"])).toBeUndefined();
    await act(async () => { await session.signOut(); });
    expect(screen.getByText("anonymous:guest")).toBeInTheDocument();
  });
  it("keeps demo usable if connecting a real key fails", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ user: DEMO_USER, demo: true }))
      .mockResolvedValueOnce(Response.json({ error: "Invalid token" }, { status: 401 })));
    mount();
    await screen.findByText("authenticated:demo");
    await act(async () => { await expect(session.signIn("bad-token")).rejects.toThrow("Invalid token"); });
    expect(isDemoMode()).toBe(true);
    expect(screen.getByText("authenticated:demo")).toBeInTheDocument();
  });
  it("refreshes another tab's sign-out and removes cached demo data", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ user: DEMO_USER, demo: true }))
      .mockResolvedValueOnce(new Response("{}", { status: 401 })));
    const client = mount();
    await screen.findByText("authenticated:demo");
    client.setQueryData(["wanikani", "subjects"], ["demo subjects"]);
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: "kakehashi-web:session-change", newValue: "signed-out" })));
    await waitFor(() => expect(screen.getByText("anonymous:guest")).toBeInTheDocument());
    expect(isDemoMode()).toBe(false);
    expect(client.getQueryData(["wanikani", "subjects"])).toBeUndefined();
  });

  it("serializes a slow demo start before sign-out without restoring the stale session", async () => {
    let finishStart!: (response: Response) => void;
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finishStart = resolve; }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    mount();
    await screen.findByText("anonymous:guest");
    let start!: Promise<unknown>;
    let exit!: Promise<unknown>;
    act(() => { start = session.startDemo(); });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    act(() => { exit = session.signOut(); });
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => {
      finishStart(Response.json({ user: DEMO_USER, demo: true }));
      await Promise.all([start, exit]);
    });
    expect(fetch).toHaveBeenNthCalledWith(3, "/api/session/wanikani", { method: "DELETE" });
    expect(mocks.seed).not.toHaveBeenCalled();
    expect(isDemoMode()).toBe(false);
    expect(screen.getByText("anonymous:guest")).toBeInTheDocument();
  });
});
