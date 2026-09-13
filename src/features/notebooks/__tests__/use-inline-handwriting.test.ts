import { renderHook } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadNotebookDrawing, saveNotebookDrawing } from "../handwriting-api";
import { useInlineHandwriting } from "../use-inline-handwriting";
import { inlineHandwritingDraftKey } from "../inline-handwriting-drafts";
import { encodeInlineInk, type InlineInkDocument } from "../../../../web/src/features/notebooks/inline-ink";

let mockAuth = { apiToken: "token", userData: { id: 42, username: "Portego" } };
jest.mock("../../../utils/store", () => ({ useAuthStore: { getState: () => mockAuth } }));
jest.mock("../handwriting-api", () => ({ ...jest.requireActual("../handwriting-api"), loadNotebookDrawing: jest.fn(), saveNotebookDrawing: jest.fn() }));
const ink: InlineInkDocument = { version: 1, width: 768, height: 384, strokes: [] };
const payload = { inkFormat: "strokes-v1" as const, inkBase64: encodeInlineInk(ink), previewBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", width: 768, height: 384 };
const saved = { inkFormat: "strokes-v1" as const, drawingId: "77e7b1d1-136c-4da5-b69d-e59ec7c878ae", width: 768, height: 384 };
let cache: Map<string, string>;
beforeEach(() => {
  jest.clearAllMocks(); cache = new Map();
  jest.mocked(AsyncStorage.getItem).mockImplementation(async (key) => cache.get(key) ?? null);
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => { cache.set(key, value); });
  jest.mocked(AsyncStorage.removeItem).mockImplementation(async (key) => { cache.delete(key); });
  mockAuth = { apiToken: "token", userData: { id: 42, username: "Portego" } };
  jest.mocked(saveNotebookDrawing).mockResolvedValue(saved);
  jest.mocked(loadNotebookDrawing).mockResolvedValue({ ...saved, ...payload });
});

it("preserves delayed final local strokes after unmount, but rejects all late network actions", async () => {
  const { result, unmount } = renderHook(() => useInlineHandwriting("42", "page", async () => undefined));
  const actions = result.current;
  await actions.onLoadInlineHandwriting("block", "");
  unmount();
  await actions.onPersistInlineHandwriting("block", "", ink);
  expect(cache.has(inlineHandwritingDraftKey("42", "page", "block"))).toBe(true);
  expect(() => actions.onSaveInlineHandwriting("block", "", payload)).toThrow("account or page changed");
  expect(() => actions.onLoadInlineHandwriting("block", saved.drawingId)).toThrow("account or page changed");
  expect(() => actions.onPersistInlineHandwriting("unknown-block", "", ink)).toThrow("account or page changed");
  expect(saveNotebookDrawing).not.toHaveBeenCalled(); expect(loadNotebookDrawing).not.toHaveBeenCalled();
});

it("binds delayed recovery to the original account/page and requires current Portego access for cloud saves", async () => {
  const { result } = renderHook(() => useInlineHandwriting("42", "page", async () => undefined));
  await result.current.onLoadInlineHandwriting("block", "");
  mockAuth.userData.id = 43;
  await result.current.onPersistInlineHandwriting("block", "", ink);
  expect(cache.has(inlineHandwritingDraftKey("42", "page", "block"))).toBe(true);
  expect(cache.has(inlineHandwritingDraftKey("43", "page", "block"))).toBe(false);
  expect(() => result.current.onSaveInlineHandwriting("block", "", payload)).toThrow();
  mockAuth.userData.id = 42; mockAuth.userData.username = "SomeoneElse";
  expect(() => result.current.onSaveInlineHandwriting("block", "", payload)).toThrow();
  expect(saveNotebookDrawing).not.toHaveBeenCalled();
});
