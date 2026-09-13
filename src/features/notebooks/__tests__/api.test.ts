import fetchMock from "jest-fetch-mock";
import { notebookEndpoint, parseNotebookResponse, requestNotebookCloud } from "../api";
import { createNotebookState, DEFAULT_NOTEBOOK_LIMITS } from "../model";

const token = "private-wanikani-token";
const accountId = "opaque-account-id";
const envelope = { available: true, accountId, state: createNotebookState(), revision: -1, limits: DEFAULT_NOTEBOOK_LIMITS };

describe("native notebook transport", () => {
  const originalEndpoint = process.env.EXPO_PUBLIC_NOTEBOOKS_API_URL;
  beforeEach(() => {
    fetchMock.resetMocks();
    process.env.EXPO_PUBLIC_NOTEBOOKS_API_URL = "https://kakehashi.test/api/notebooks/native";
  });
  afterEach(() => { process.env.EXPO_PUBLIC_NOTEBOOKS_API_URL = originalEndpoint; jest.useRealTimers(); });

  it("sends native bearer reads with cookies omitted and no credentials in the URL", async () => {
    fetchMock.mockResponseOnce(JSON.stringify(envelope));
    expect(await requestNotebookCloud(token, accountId)).toEqual(envelope);
    expect(fetchMock).toHaveBeenCalledWith("https://kakehashi.test/api/notebooks/native", expect.objectContaining({
      method: "GET", credentials: "omit", headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "X-Notebook-Features": "handwriting-v1, handwriting-strokes-v1, handwriting-appearance-v1" }, signal: expect.any(AbortSignal),
    }));
    expect(fetchMock.mock.calls[0][0]).not.toContain(token);
  });

  it("sends the verified account header and shared JSON mutation on writes", async () => {
    fetchMock.mockResponseOnce(JSON.stringify(envelope));
    const mutation = { action: "create_page", page: { id: "page", title: "日本語" } } as const;
    await requestNotebookCloud(token, accountId, mutation);
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      method: "POST", headers: expect.objectContaining({ "Content-Type": "application/json", "X-Notebook-Account": accountId }), body: JSON.stringify(mutation),
    }));
  });

  it.each([undefined, "", "   "])("connects a device build to the deployed notebooks when its override is %p", async (configured) => {
    if (configured === undefined) delete process.env.EXPO_PUBLIC_NOTEBOOKS_API_URL;
    else process.env.EXPO_PUBLIC_NOTEBOOKS_API_URL = configured;
    fetchMock.mockResponseOnce(JSON.stringify(envelope));
    expect(await requestNotebookCloud(token, accountId)).toEqual(envelope);
    expect(fetchMock).toHaveBeenCalledWith("https://kakehashiapp.com/api/notebooks/native", expect.objectContaining({
      method: "GET", credentials: "omit", headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
    }));
  });

  it("preserves an explicit trusted notebook deployment override", () => {
    expect(notebookEndpoint("  https://preview.kakehashi.test/api/notebooks/native  ")).toBe("https://preview.kakehashi.test/api/notebooks/native");
  });

  it("rejects account-mismatched responses instead of sharing another account's state", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ ...envelope, accountId: "different-account" }));
    await expect(requestNotebookCloud(token, accountId)).rejects.toMatchObject({ status: 409, code: "account_changed" });
  });

  it("preserves server conflict and authorization error status", async () => {
    for (const [status, code] of [[409, "conflict"], [401, "unauthorized"], [403, "forbidden"]] as const) {
      fetchMock.mockResponseOnce(JSON.stringify({ error: "Action failed", code }), { status });
      await expect(requestNotebookCloud(token, accountId)).rejects.toMatchObject({ status, code });
    }
  });

  it("identifies malformed document responses as server failures, not offline failures", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ ...envelope, state: { version: 99, pages: [], sentences: [] } }));
    await expect(requestNotebookCloud(token, accountId)).rejects.toMatchObject({ status: 502 });
    fetchMock.mockResponseOnce("not json");
    await expect(requestNotebookCloud(token, accountId)).rejects.toMatchObject({ status: 502 });
  });

  it("validates connection configuration before passing a token to fetch", async () => {
    for (const configured of ["bad url", "http://outside.test/api", "https://user:password@outside.test/api", "file:///tmp/notebook.json"]) {
      expect(() => notebookEndpoint(configured)).toThrow();
      process.env.EXPO_PUBLIC_NOTEBOOKS_API_URL = configured;
      await expect(requestNotebookCloud(token, accountId)).rejects.toMatchObject({ status: 503, code: "not_configured" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not start requests that were already cancelled", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(requestNotebookCloud(token, accountId, undefined, controller.signal)).rejects.toMatchObject({ status: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not accept a response completed after external cancellation", async () => {
    const controller = new AbortController();
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => {
      controller.abort();
      return { ok: true, status: 200, json: async () => envelope } as Response;
    });
    try {
      await expect(requestNotebookCloud(token, accountId, undefined, controller.signal)).rejects.toMatchObject({ status: 0 });
    } finally { global.fetch = originalFetch; }
  });

  it("aborts network requests at the deadline and retains the offline recovery contract", async () => {
    jest.useFakeTimers();
    const originalFetch = global.fetch;
    global.fetch = jest.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));
    try {
      const pending = requestNotebookCloud(token, accountId);
      const rejected = expect(pending).rejects.toMatchObject({ status: 0, code: "offline", message: expect.stringContaining("timed out") });
      await jest.advanceTimersByTimeAsync(25_000); await rejected;
      expect(jest.getTimerCount()).toBe(0);
    } finally { global.fetch = originalFetch; }
  });

  it("keeps unavailable storage explicit while accepting the server's null-state envelope", () => {
    expect(parseNotebookResponse({ ...envelope, available: false, state: null })).toEqual({ ...envelope, available: false });
    for (const invalid of [{ ...envelope, accountId: "bad,id" }, { ...envelope, revision: -2 }, { ...envelope, available: true, state: null }]) {
      expect(() => parseNotebookResponse(invalid)).toThrow();
    }
  });
});
