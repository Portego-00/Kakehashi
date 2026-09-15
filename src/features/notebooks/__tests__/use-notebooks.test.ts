import AsyncStorage from "@react-native-async-storage/async-storage";
import { requestNotebookCloud } from "../api";
import { notebookCacheKey } from "../client";
import { applyNotebookMutation, createNotebookState, DEFAULT_NOTEBOOK_LIMITS } from "../model";
import { notebookClient } from "../use-notebooks";

type Auth = { apiToken: string | null; userData: { id: number; username: string } | null };
jest.mock("../../../utils/store", () => {
  let auth: Auth = { apiToken: null, userData: null };
  const listeners = new Set<() => void>();
  return {
    useAuthStore: {
      getState: () => auth,
      subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    },
    setMockAuth: (next: Auth) => { auth = next; listeners.forEach((listener) => listener()); },
  };
});
jest.mock("../api", () => ({ ...jest.requireActual("../api"), requestNotebookCloud: jest.fn() }));
const { setMockAuth } = jest.requireMock("../../../utils/store") as { setMockAuth: (auth: Auth) => void };
const initial = applyNotebookMutation(createNotebookState(), { action: "create_page", page: { id: "page", title: "Saved page" } }, new Date("2026-09-15T10:00:00Z")).state;
initial.examples = { version: 1, status: "skipped" };

beforeEach(async () => {
  setMockAuth({ apiToken: null, userData: null });
  await notebookClient.persistDrafts();
  jest.clearAllMocks();
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  jest.mocked(requestNotebookCloud).mockImplementation(async (_token, accountId) => ({ accountId, available: true, state: initial, revision: 1, limits: DEFAULT_NOTEBOOK_LIMITS }));
});
afterEach(async () => {
  setMockAuth({ apiToken: null, userData: null });
  await notebookClient.persistDrafts();
});

it("binds and loads notebooks for an ordinary authenticated account", async () => {
  setMockAuth({ apiToken: "ordinary-token", userData: { id: 42, username: "ordinary-user" } });
  await notebookClient.refresh();
  expect(requestNotebookCloud).toHaveBeenCalledWith("ordinary-token", "42", undefined, expect.any(AbortSignal));
  expect(notebookClient.getSnapshot()).toMatchObject({ accountId: "42", available: true, state: initial });
});

it("keeps drafts in their original account when switching to another signed-in account", async () => {
  setMockAuth({ apiToken: "first-token", userData: { id: 42, username: "first-user" } });
  await notebookClient.refresh();
  notebookClient.updatePageDraft("page", { title: "Private first-account draft" });
  setMockAuth({ apiToken: "second-token", userData: { id: 43, username: "second-user" } });
  expect(notebookClient.getSnapshot()).toMatchObject({ accountId: "43", state: null, drafts: {} });
  await notebookClient.refresh();
  expect(requestNotebookCloud).toHaveBeenLastCalledWith("second-token", "43", undefined, expect.any(AbortSignal));
  expect(notebookClient.getSnapshot().state?.pages[0].title).toBe("Saved page");
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(notebookCacheKey("42"), expect.stringContaining("Private first-account draft"));
  expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(notebookCacheKey("43"), expect.stringContaining("Private first-account draft"));
});

it.each([
  { apiToken: null, userData: { id: 42, username: "ordinary-user" } },
  { apiToken: "token", userData: null },
  { apiToken: null, userData: null },
])("clears notebook data when authentication is incomplete: %j", async (auth) => {
  setMockAuth({ apiToken: "token", userData: { id: 42, username: "ordinary-user" } });
  await notebookClient.refresh();
  setMockAuth(auth);
  expect(notebookClient.getSnapshot()).toMatchObject({ accountId: null, state: null, drafts: {} });
});
