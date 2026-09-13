import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyNotebookMutation, createNotebookState, type NotebookMutation } from "@/features/notebooks/model";
import { NOTEBOOK_DRAWING_MAX_INK_BYTES, NOTEBOOK_HANDWRITING_FEATURES } from "@/features/notebooks/handwriting";
import { encodeInlineInk } from "@/features/notebooks/inline-ink";

vi.mock("server-only", () => ({}));
const drawingId = "00a00000-0000-4000-8000-000000000001";
const previewBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
const payload = { inkBase64: Buffer.from("opaque PencilKit drawing").toString("base64"), previewBase64, width: 1, height: 1 };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const row = { id: drawingId, user_id: "123", width: 1, height: 1, status: "ready", ink_bytes: Buffer.from(payload.inkBase64, "base64").length, preview_bytes: Buffer.from(previewBase64, "base64").length };
const state = applyNotebookMutation(createNotebookState(), { action: "create_page", page: { id: "page", content: [{ id: "ink", type: "handwriting", props: { drawingId, width: 1, height: 1 } }] } }).state;

describe("private immutable notebook drawings", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("SUPABASE_URL", "https://supabase.test"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "private-service-key"); vi.stubEnv("SUPABASE_SECRET_KEY", "");
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("reserves quota before writing immutable private objects and makes metadata ready only after both uploads", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(true)).mockResolvedValueOnce(json({})).mockResolvedValueOnce(json({})).mockResolvedValueOnce(json(true));
    vi.stubGlobal("fetch", fetchMock);
    const { saveNotebookDrawing } = await import("./notebook-drawings-server");
    const result = await saveNotebookDrawing("123", payload);
    expect(result).toMatchObject({ drawingId: expect.stringMatching(/^[a-f0-9-]{36}$/), width: 1, height: 1 });
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "https://supabase.test/rest/v1/rpc/reserve_notebook_drawing",
      `https://supabase.test/storage/v1/object/notebook-drawings/123/${result.drawingId}/drawing.ink`,
      `https://supabase.test/storage/v1/object/notebook-drawings/123/${result.drawingId}/preview.png`,
      "https://supabase.test/rest/v1/rpc/complete_notebook_drawing",
    ]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ p_user_id: "123", p_id: result.drawingId, p_ink_bytes: row.ink_bytes, p_preview_bytes: row.preview_bytes });
    expect(fetchMock.mock.calls[1][1].headers).toMatchObject({ "x-upsert": "false", "Content-Type": "application/octet-stream" });
    expect(Buffer.from(fetchMock.mock.calls[1][1].body).toString("base64")).toBe(payload.inkBase64);
    expect(Buffer.from(fetchMock.mock.calls[2][1].body).toString("base64")).toBe(previewBase64);
  });
  it("does not upload any bytes when the database rejects the atomic reservation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(false)); vi.stubGlobal("fetch", fetchMock);
    const { saveNotebookDrawing } = await import("./notebook-drawings-server");
    await expect(saveNotebookDrawing("123", payload)).rejects.toMatchObject({ code: "limit", status: 413 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("reserves the dark preview quota and retains an uncertain third upload without marking it ready", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(true)).mockResolvedValueOnce(json({})).mockResolvedValueOnce(json({})).mockRejectedValueOnce(new Error("third upload timeout")).mockResolvedValueOnce(json([]));
    vi.stubGlobal("fetch", fetchMock);
    const { saveNotebookDrawing } = await import("./notebook-drawings-server");
    await expect(saveNotebookDrawing("123", { ...payload, previewFormat: "themed-v1", darkPreviewBase64: previewBase64 }, NOTEBOOK_HANDWRITING_FEATURES)).rejects.toThrow("third upload timeout");
    expect(String(fetchMock.mock.calls[0][0])).toContain("reserve_notebook_drawing_v3");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ p_dark_preview_bytes: row.preview_bytes, p_preview_format: "themed-v1", p_ink_format: "pencilkit-v1" });
    expect(String(fetchMock.mock.calls[3][0])).toContain("preview-dark.png");
    expect(fetchMock.mock.calls[4][1].method).toBe("DELETE");
    expect(JSON.parse(fetchMock.mock.calls[4][1].body).prefixes).toHaveLength(3);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("complete_notebook_drawing"))).toBe(false);
  });
  it.each([
    { previewFormat: "themed-v1" },
    { darkPreviewBase64: previewBase64 },
    { previewFormat: "unknown", darkPreviewBase64: previewBase64 },
    { previewFormat: "themed-v1", darkPreviewBase64: Buffer.alloc(NOTEBOOK_DRAWING_MAX_INK_BYTES + 1).toString("base64") },
    { previewFormat: "themed-v1", darkPreviewBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=" },
    { previewFormat: "themed-v1", darkPreviewBase64: previewBase64, inkFormat: "strokes-v1", inkBase64: encodeInlineInk({ version: 1, width: 1, height: 1, strokes: [] }) },
  ])("rejects incomplete, corrupted or incompatible themed uploads before storage %#", async (extra) => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const { saveNotebookDrawing } = await import("./notebook-drawings-server");
    await expect(saveNotebookDrawing("123", { ...payload, ...extra }, NOTEBOOK_HANDWRITING_FEATURES)).rejects.toMatchObject({ code: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("keeps opaque legacy images readable for a dark preview request", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json([row])).mockResolvedValueOnce(new Response(Buffer.from(previewBase64, "base64"))); vi.stubGlobal("fetch", fetchMock);
    const { readNotebookDrawingPreview } = await import("./notebook-drawings-server");
    expect((await readNotebookDrawingPreview("123", drawingId, "dark")).toString("base64")).toBe(previewBase64);
    expect(String(fetchMock.mock.calls[1][0])).toContain("/preview.png");
  });
  it.each([
    { ...payload, inkBase64: "data:application/octet-stream;base64,AAAA" },
    { ...payload, inkBase64: "!!!!" },
    { ...payload, inkBase64: "Zh==" },
    { ...payload, inkBase64: Buffer.alloc(NOTEBOOK_DRAWING_MAX_INK_BYTES + 1).toString("base64") },
    { ...payload, previewBase64: Buffer.from("<svg onload=alert(1) />").toString("base64") },
    { ...payload, previewBase64: Buffer.from(previewBase64, "base64").subarray(0, 44).toString("base64") },
    { ...payload, previewBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=" },
    { ...payload, width: 2 },
    { ...payload, height: 0 },
    { ...payload, width: 4096, height: 4096 },
    { ...payload, userId: "attacker-selected-owner" },
  ])("rejects invalid or unbounded content before storage %#", async (input) => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const { saveNotebookDrawing } = await import("./notebook-drawings-server");
    await expect(saveNotebookDrawing("123", input)).rejects.toMatchObject({ code: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("cleans a partial upload without marking it ready, retaining quota for ambiguous remote completion", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(true)).mockResolvedValueOnce(json({})).mockResolvedValueOnce(json({ message: "private upstream details" }, 500)).mockResolvedValueOnce(json([])); vi.stubGlobal("fetch", fetchMock);
    const { saveNotebookDrawing } = await import("./notebook-drawings-server");
    await expect(saveNotebookDrawing("123", payload)).rejects.toThrow("Handwriting storage is unavailable.");
    expect(fetchMock.mock.calls[3][1].method).toBe("DELETE");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("complete_notebook_drawing"))).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("discard_pending"))).toBe(false);
  });
  it("does not delete assets after an uncertain ready commit", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(true)).mockResolvedValueOnce(json({})).mockResolvedValueOnce(json({})).mockRejectedValueOnce(new Error("Timeout")); vi.stubGlobal("fetch", fetchMock);
    const { saveNotebookDrawing } = await import("./notebook-drawings-server");
    await expect(saveNotebookDrawing("123", payload)).rejects.toThrow("Timeout");
    expect(fetchMock.mock.calls.some(([, init]) => init.method === "DELETE")).toBe(false);
  });
  it("checks ownership before downloading and returns original editable bytes", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json([row])).mockResolvedValueOnce(new Response(Buffer.from(payload.inkBase64, "base64"))).mockResolvedValueOnce(new Response(Buffer.from(previewBase64, "base64"))); vi.stubGlobal("fetch", fetchMock);
    const { readNotebookDrawing } = await import("./notebook-drawings-server");
    expect(await readNotebookDrawing("123", drawingId)).toEqual({ drawingId, ...payload, inkFormat: "pencilkit-v1" });
    const query = new URL(fetchMock.mock.calls[0][0]).searchParams;
    expect(query.get("user_id")).toBe("eq.123"); expect(query.get("status")).toBe("eq.ready");
    expect(fetchMock.mock.calls[1][0]).toContain("/storage/v1/object/authenticated/notebook-drawings/123/");
  });
  it("returns the same not-found response for missing or foreign drawings without accessing objects", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([])); vi.stubGlobal("fetch", fetchMock);
    const { readNotebookDrawing } = await import("./notebook-drawings-server");
    await expect(readNotebookDrawing("123", drawingId)).rejects.toMatchObject({ code: "not_found" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(readNotebookDrawing("123", "../other-owner")).rejects.toMatchObject({ code: "not_found" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("bounds downloaded bytes and rejects metadata owner mismatches even if upstream returns them", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json([{ ...row, user_id: "456" }])).mockResolvedValueOnce(json([row])).mockResolvedValueOnce(new Response(Buffer.alloc(row.preview_bytes + 1))); vi.stubGlobal("fetch", fetchMock);
    const { readNotebookDrawingPreview } = await import("./notebook-drawings-server");
    await expect(readNotebookDrawingPreview("123", drawingId)).rejects.toThrow("unavailable");
    await expect(readNotebookDrawingPreview("123", drawingId)).rejects.toThrow("unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("refuses notebook references with missing assets or altered dimensions", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json([])).mockResolvedValueOnce(json([{ ...row, width: 2 }])).mockResolvedValueOnce(json([row])); vi.stubGlobal("fetch", fetchMock);
    const { assertNotebookDrawingOwnership } = await import("./notebook-drawings-server");
    await expect(assertNotebookDrawingOwnership("123", state)).rejects.toMatchObject({ code: "invalid" });
    await expect(assertNotebookDrawingOwnership("123", state)).rejects.toMatchObject({ code: "invalid" });
    await expect(assertNotebookDrawingOwnership("123", state)).resolves.toBeUndefined();
  });
  it("rejects older-client writes before changing handwriting state", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([{ state, revision: 0 }])); vi.stubGlobal("fetch", fetchMock);
    const { mutateRemoteNotebookState } = await import("./notebooks-server");
    const mutation: NotebookMutation = { action: "update_page", pageId: "page", expectedRevision: 0, patch: { title: "Old client" } };
    await expect(mutateRemoteNotebookState("123", mutation)).rejects.toMatchObject({ code: "update_required", status: 426 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("checks ready owner-bound drawing references before committing a supported notebook mutation", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json([{ state, revision: 0 }])).mockResolvedValueOnce(json([])); vi.stubGlobal("fetch", fetchMock);
    const { mutateRemoteNotebookState } = await import("./notebooks-server");
    const mutation: NotebookMutation = { action: "update_page", pageId: "page", expectedRevision: 0, patch: { title: "Changed" } };
    await expect(mutateRemoteNotebookState("123", mutation, undefined, "handwriting-v1")).rejects.toMatchObject({ code: "invalid" });
    expect(fetchMock.mock.calls.some(([, init]) => init.method === "POST")).toBe(false);
  });
  it("validates portable ink contents and dimensions before reserving assets", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const { saveNotebookDrawing } = await import("./notebook-drawings-server");
    for (const extra of [
      { inkFormat: null }, { inkFormat: "strokes-v2" }, { inkFormat: "strokes-v1" },
      { inkFormat: "strokes-v1", inkBase64: encodeInlineInk({ version: 1, width: 2, height: 1, strokes: [] }) },
    ]) await expect(saveNotebookDrawing("123", { ...payload, ...extra }, NOTEBOOK_HANDWRITING_FEATURES)).rejects.toMatchObject({ code: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rechecks portable capability after an optimistic retry instead of erasing a concurrent inline block", async () => {
    const initial = applyNotebookMutation(createNotebookState(), { action: "create_page", page: { id: "page" } }).state;
    const concurrent = applyNotebookMutation(initial, { action: "append_blocks", pageId: "page", blocks: [{ id: "inline", type: "handwriting", props: { drawingId: "", inkFormat: "strokes-v1", width: 768, height: 384 } }] }).state;
    const fetchMock = vi.fn().mockResolvedValueOnce(json([{ state: initial, revision: 0 }])).mockResolvedValueOnce(json(null)).mockResolvedValueOnce(json([{ state: concurrent, revision: 1 }]));
    vi.stubGlobal("fetch", fetchMock);
    const { mutateRemoteNotebookState } = await import("./notebooks-server");
    await expect(mutateRemoteNotebookState("123", { action: "update_page", pageId: "page", expectedRevision: 0, patch: { title: "Old sheet client" } }, undefined, "handwriting-v1")).rejects.toMatchObject({ code: "update_required", status: 426 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });
});
