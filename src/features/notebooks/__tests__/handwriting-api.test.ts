import fetchMock from "jest-fetch-mock";
import { drawingPayload, loadNotebookDrawing, saveNotebookDrawing } from "../handwriting-api";
import { encodeInlineInk } from "../../../../web/src/features/notebooks/inline-ink";

const drawingId = "77e7b1d1-136c-4da5-b69d-e59ec7c878ae";
const payload = { inkBase64: "AA==", previewBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=", width: 1, height: 1 };
const reference = { drawingId, width: 1, height: 1 };
const endpoint = process.env.EXPO_PUBLIC_NOTEBOOKS_API_URL;
beforeEach(() => { fetchMock.resetMocks(); process.env.EXPO_PUBLIC_NOTEBOOKS_API_URL = "https://kakehashi.test/api/notebooks/native"; });
afterEach(() => { process.env.EXPO_PUBLIC_NOTEBOOKS_API_URL = endpoint; });

it("uploads private ink and receives only a portable drawing reference", async () => {
  fetchMock.mockResponseOnce(JSON.stringify({ ...reference, accountId: "42" }));
  expect(await saveNotebookDrawing("private-token", "42", payload)).toEqual(reference);
  expect(fetchMock).toHaveBeenCalledWith("https://kakehashi.test/api/notebooks/native/drawings", expect.objectContaining({
    method: "POST", credentials: "omit", body: JSON.stringify(payload),
    headers: expect.objectContaining({ Authorization: "Bearer private-token", "X-Notebook-Account": "42", "X-Notebook-Features": "handwriting-v1, handwriting-strokes-v1, handwriting-appearance-v1" }),
  }));
});

it("loads original ink and PNG without putting credentials in the URL", async () => {
  fetchMock.mockResponseOnce(JSON.stringify({ ...reference, ...payload, accountId: "42" }));
  expect(await loadNotebookDrawing("private-token", "42", drawingId)).toEqual({ ...reference, ...payload });
  expect(fetchMock.mock.calls[0][0]).toBe(`https://kakehashi.test/api/notebooks/native/drawings/${drawingId}`);
});

it("rejects a different account or drawing and malformed preview responses", async () => {
  for (const change of [{ accountId: "43" }, { drawingId: "2c07ce36-6646-4966-acd6-63eab33d8abf" }, { previewBase64: "not-an-image" }]) {
    fetchMock.mockResponseOnce(JSON.stringify({ ...reference, ...payload, accountId: "42", ...change }));
    await expect(loadNotebookDrawing("token", "42", drawingId)).rejects.toThrow();
  }
});

it("never requests malformed or path-traversal drawing IDs", async () => {
  await expect(loadNotebookDrawing("token", "42", "../../accounts")).rejects.toMatchObject({ status: 400 });
  expect(fetchMock).not.toHaveBeenCalled();
});

it("rejects oversized and non-image drawing payloads before upload", () => {
  for (const change of [{ width: 0 }, { height: 0.5 }, { width: 4097 }, { inkBase64: "A".repeat(1_398_108) }, { previewBase64: "data:image/svg+xml;base64,AA==" }]) {
    expect(() => drawingPayload({ ...payload, ...change })).toThrow();
  }
});

it("preserves quota/auth errors and rejects late cancelled responses", async () => {
  fetchMock.mockResponseOnce(JSON.stringify({ error: "Drawing storage is full.", code: "limit" }), { status: 413 });
  await expect(saveNotebookDrawing("token", "42", payload)).rejects.toMatchObject({ status: 413, code: "limit" });
  const abort = new AbortController(); abort.abort();
  await expect(loadNotebookDrawing("token", "42", drawingId, abort.signal)).rejects.toMatchObject({ status: 0 });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("round-trips editable inline ink with its format through upload and download", async () => {
  const inline = { ...payload, inkFormat: "strokes-v1" as const, inkBase64: encodeInlineInk({ version: 1, width: 1, height: 1, strokes: [] }) };
  const saved = { ...reference, inkFormat: inline.inkFormat };
  fetchMock.mockResponseOnce(JSON.stringify({ ...saved, accountId: "42" }));
  expect(await saveNotebookDrawing("token", "42", inline)).toEqual(saved);
  expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual(inline);
  fetchMock.mockResponseOnce(JSON.stringify({ ...saved, ...inline, accountId: "42" }));
  expect(await loadNotebookDrawing("token", "42", drawingId)).toEqual({ ...saved, ...inline });
});

it("rejects unknown formats, invalid stroke data and mismatched inline dimensions", async () => {
  for (const change of [
    { inkFormat: "future-v2" }, { inkFormat: "strokes-v1" },
    { inkFormat: "strokes-v1", inkBase64: encodeInlineInk({ version: 1, width: 2, height: 1, strokes: [] }) },
  ]) expect(() => drawingPayload({ ...payload, ...change })).toThrow();
  const inline = { ...payload, inkFormat: "strokes-v1" as const, inkBase64: encodeInlineInk({ version: 1, width: 1, height: 1, strokes: [] }) };
  fetchMock.mockResponseOnce(JSON.stringify({ ...reference, accountId: "42" }));
  await expect(saveNotebookDrawing("token", "42", inline)).rejects.toThrow("different handwriting format");
});


it("round-trips both transparent appearance previews without changing original ink", async () => {
  const themed = { ...payload, inkFormat: "pencilkit-v1" as const, previewFormat: "themed-v1" as const, darkPreviewBase64: payload.previewBase64 };
  const saved = { ...reference, inkFormat: themed.inkFormat, previewFormat: themed.previewFormat };
  fetchMock.mockResponseOnce(JSON.stringify({ ...saved, accountId: "42" }));
  expect(await saveNotebookDrawing("token", "42", themed)).toEqual(saved);
  expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual(themed);
  fetchMock.mockResponseOnce(JSON.stringify({ ...saved, ...themed, accountId: "42" }));
  expect(await loadNotebookDrawing("token", "42", drawingId)).toEqual({ ...saved, ...themed });
});

it("retains recovery when the server drops appearance metadata or either preview is invalid", async () => {
  const themed = { ...payload, inkFormat: "pencilkit-v1" as const, previewFormat: "themed-v1" as const, darkPreviewBase64: payload.previewBase64 };
  for (const change of [{ darkPreviewBase64: undefined }, { darkPreviewBase64: "not-a-png" }, { previewFormat: "future" }, { previewFormat: undefined }, { inkFormat: "strokes-v1" }]) {
    expect(() => drawingPayload({ ...themed, ...change })).toThrow();
  }
  fetchMock.mockResponseOnce(JSON.stringify({ ...reference, accountId: "42" }));
  await expect(saveNotebookDrawing("token", "42", themed)).rejects.toThrow("different handwriting preview");
});
