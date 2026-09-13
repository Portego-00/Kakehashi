import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyNotebookMutation, createNotebookState, type NotebookState } from "./model";
import { useNotebooks, type NotebookResponse } from "./use-notebooks";
import { usePageDraft } from "./use-page-draft";
import NotebookHandwriting from "./NotebookHandwriting";

vi.mock("@/lib/session", () => ({ useSession: () => ({ status: "authenticated", user: { data: { id: "101", username: "Portego" } }, isDemo: false }) }));
const drawingId = "00a00000-0000-4000-8000-000000000077";
const blank = { id: "area", type: "handwriting", props: { drawingId: "", inkFormat: "strokes-v1", width: 768, height: 384 } };
let initial: NotebookState;
let cloud: NotebookResponse;
let client: QueryClient;
let fetchMock: ReturnType<typeof vi.fn>;
const save = vi.fn<() => Promise<NotebookState>>();
async function tick(ms = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }

function ReadingNotebook() {
  const store = useNotebooks();
  const drawingPage = store.state.pages.find((page) => page.id === "drawing") ?? initial.pages[0];
  const otherPage = store.state.pages.find((page) => page.id === "grammar") ?? initial.pages[1];
  const drawingDraft = usePageDraft(drawingPage, store.scope, save);
  const otherDraft = usePageDraft(otherPage, store.scope, save);
  const props = drawingDraft.draft.content[0].props!;
  return <>
    <NotebookHandwriting key={drawingDraft.editorEpoch} drawingId={String(props.drawingId)} width={Number(props.width)} height={Number(props.height)} inkFormat={props.inkFormat === "strokes-v1" ? "strokes-v1" : "pencilkit-v1"} />
    <input aria-label="Drawing page title" value={drawingDraft.draft.title} onChange={(event) => drawingDraft.update({ title: event.target.value })} />
    <output aria-label="Drawing draft status">{drawingDraft.status}</output>
    <input aria-label="Other page draft" value={otherDraft.draft.title} onChange={(event) => otherDraft.update({ title: event.target.value })} />
    <output aria-label="Other draft status">{otherDraft.status}</output>
  </>;
}
function mount() { return render(<QueryClientProvider client={client}><ReadingNotebook /></QueryClientProvider>); }
function savePencilKitFromIPad() {
  cloud = { available: true, revision: 2, state: applyNotebookMutation(initial, { action: "update_page", pageId: "drawing", expectedRevision: 0, patch: { content: [{ ...blank, props: { ...blank.props, drawingId, inkFormat: "pencilkit-v1" } }] } }).state };
}
function recoveryEntries() {
  return Object.entries(localStorage).filter(([key]) => key.startsWith("kakehashi:notebooks:draft:101:"));
}

beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear(); sessionStorage.clear(); save.mockReset();
  focusManager.setFocused(true);
  initial = applyNotebookMutation(createNotebookState(), { action: "create_page", page: { id: "drawing", title: "Writing practice", content: [blank] } }).state;
  initial = { ...applyNotebookMutation(initial, { action: "create_page", page: { id: "grammar", title: "Grammar notes" } }).state, examples: { version: 1, status: "removed" } };
  cloud = { available: true, state: initial, revision: 1 };
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  client.setQueryData(["notebooks", "101"], cloud);
  fetchMock = vi.fn(async () => new Response(JSON.stringify(cloud), { status: 200, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); client.clear(); focusManager.setFocused(undefined); vi.unstubAllGlobals(); vi.useRealTimers(); localStorage.clear(); sessionStorage.clear(); });

describe("native handwriting appearing in an open web notebook", () => {
  it("refreshes even a fresh cached blank on focus and preserves another page's unsaved recovery", async () => {
    mount(); await tick();
    expect(screen.getByLabelText("Empty handwriting area")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Other page draft"), { target: { value: "Keep my unsaved grammar work" } });
    await tick(151);
    const recovery = recoveryEntries();
    expect(recovery.some(([, value]) => value.includes("Keep my unsaved grammar work"))).toBe(true);
    savePencilKitFromIPad();
    await act(async () => { focusManager.setFocused(false); focusManager.setFocused(true); });
    await tick(2);
    const image = screen.getByAltText("Handwritten notebook page");
    expect(image).toHaveAttribute("src", new URL(`/api/notebooks/drawings/${drawingId}/preview`, window.location.href).href);
    await act(async () => { fireEvent.load(image); });
    expect(image).toHaveAttribute("data-ready", "true");
    expect(screen.queryByLabelText("Empty handwriting area")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Other page draft")).toHaveValue("Keep my unsaved grammar work");
    expect(screen.getByLabelText("Other draft status")).toHaveTextContent("unsaved");
    expect(recoveryEntries()).toEqual(recovery);
    expect(save).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty("method", "POST");
  });
  it("refreshes a continuously visible notebook without requiring a tab switch", async () => {
    mount(); await tick(); savePencilKitFromIPad();
    await tick(29_999);
    expect(screen.getByLabelText("Empty handwriting area")).toBeInTheDocument();
    await tick(3);
    expect(screen.getByAltText("Handwritten notebook page")).toHaveAttribute("src", expect.stringContaining(drawingId));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
  });
  it("pauses periodic reads in the background and catches up immediately on return", async () => {
    mount(); await tick();
    act(() => focusManager.setFocused(false)); savePencilKitFromIPad();
    await tick(60_001);
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => { focusManager.setFocused(true); }); await tick(2);
    expect(screen.getByAltText("Handwritten notebook page")).toHaveAttribute("src", expect.stringContaining(drawingId));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("keeps a draft on the same page instead of replacing it with the refreshed drawing", async () => {
    mount(); await tick();
    fireEvent.change(screen.getByLabelText("Drawing page title"), { target: { value: "My unsaved local changes" } });
    await tick(151); savePencilKitFromIPad();
    await act(async () => { focusManager.setFocused(false); focusManager.setFocused(true); }); await tick(2);
    expect(screen.getByLabelText("Drawing page title")).toHaveValue("My unsaved local changes");
    expect(screen.getByLabelText("Drawing draft status")).toHaveTextContent("conflict");
    expect(screen.getByLabelText("Empty handwriting area")).toBeInTheDocument();
    expect(recoveryEntries().some(([, value]) => value.includes("My unsaved local changes"))).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });
});
