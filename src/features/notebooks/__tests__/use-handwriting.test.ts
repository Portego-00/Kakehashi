import { act, renderHook } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { cancelHandwriting, clearHandwritingDraft, editHandwriting, isHandwritingAvailable } from "../../../../modules/notebook-handwriting";
import { loadNotebookDrawing, saveNotebookDrawing } from "../handwriting-api";
import { useHandwriting } from "../use-handwriting";

let mockAuth = { apiToken: "token", userData: { id: 42, username: "Portego" } };
jest.mock("../../../utils/store", () => ({ useAuthStore: { getState: () => mockAuth } }));
jest.mock("../../../../modules/notebook-handwriting", () => ({
  isHandwritingAvailable: jest.fn(() => true), editHandwriting: jest.fn(), cancelHandwriting: jest.fn(async () => undefined), clearHandwritingDraft: jest.fn(async () => undefined),
}));
jest.mock("../handwriting-api", () => ({ ...jest.requireActual("../handwriting-api"), loadNotebookDrawing: jest.fn(), saveNotebookDrawing: jest.fn() }));
const payload = { inkBase64: "AA==", previewBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", width: 1, height: 1 };
const saved = { drawingId: "77e7b1d1-136c-4da5-b69d-e59ec7c878ae", width: 1, height: 1 };
beforeEach(() => {
  jest.clearAllMocks();
  const cache = new Map<string, string>();
  jest.mocked(AsyncStorage.getItem).mockImplementation(async (key) => cache.get(key) ?? null);
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => { cache.set(key, value); });
  jest.mocked(AsyncStorage.removeItem).mockImplementation(async (key) => { cache.delete(key); });
  mockAuth = { apiToken: "token", userData: { id: 42, username: "Portego" } };
  jest.mocked(isHandwritingAvailable).mockReturnValue(true);
  jest.mocked(editHandwriting).mockResolvedValue(payload);
  jest.mocked(saveNotebookDrawing).mockResolvedValue(saved);
  jest.mocked(loadNotebookDrawing).mockResolvedValue({ ...saved, ...payload });
});

it("checks the live account before presenting native handwriting", async () => {
  const { result } = renderHook(() => useHandwriting("42", "not-authorized", "light", async () => undefined));
  mockAuth.userData.username = "SomeoneElse";
  await expect(result.current.onEditHandwriting()).rejects.toThrow("account or page changed");
  expect(editHandwriting).not.toHaveBeenCalled();
  expect(saveNotebookDrawing).not.toHaveBeenCalled();
});

it("hides creation in older binaries while allowing handwritten previews", async () => {
  jest.mocked(isHandwritingAvailable).mockReturnValue(false);
  const { result } = renderHook(() => useHandwriting("42", "old-binary", "dark", async () => undefined));
  expect(result.current.handwritingAvailable).toBe(false);
  expect(await result.current.onLoadHandwritingPreview(saved.drawingId)).toBe(`data:image/png;base64,${payload.previewBase64}`);
  await expect(result.current.onEditHandwriting()).rejects.toThrow("latest app build");
  expect(editHandwriting).not.toHaveBeenCalled();
});

it("persists the page before acknowledging native recovery and dismisses on unmount", async () => {
  const persist = jest.fn(async () => undefined);
  const { result, unmount } = renderHook(() => useHandwriting("42", "happy-path", "dark", persist));
  await act(async () => { expect(await result.current.onEditHandwriting()).toEqual(saved); });
  expect(editHandwriting).toHaveBeenCalledWith(expect.objectContaining({ theme: "dark", draftKey: expect.stringContaining("42:happy-path:new") }));
  expect(clearHandwritingDraft).not.toHaveBeenCalled();
  await result.current.onHandwritingCommitted(saved.drawingId);
  expect(persist).toHaveBeenCalledTimes(1);
  expect(clearHandwritingDraft).toHaveBeenCalledTimes(1);
  unmount();
  expect(cancelHandwriting).toHaveBeenCalled();
});

it("does not upload or return another account's late edit after account switching", async () => {
  let finish!: (value: typeof payload) => void;
  jest.mocked(editHandwriting).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const { result } = renderHook(() => useHandwriting("42", "account-switch", "light", async () => undefined));
  const pending = result.current.onEditHandwriting();
  const rejected = expect(pending).rejects.toThrow("account or page changed");
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  mockAuth.userData.id = 43;
  finish(payload);
  await rejected;
  expect(saveNotebookDrawing).not.toHaveBeenCalled();
});
