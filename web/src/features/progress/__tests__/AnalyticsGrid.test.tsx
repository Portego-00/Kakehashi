import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsGrid } from "../components/AnalyticsGrid";

let gridWidth = 1000;
let nextFrame = 0;
const frames = new Map<number, FrameRequestCallback>();
const observers: TestResizeObserver[] = [];
class TestResizeObserver {
  items = new Set<Element>();
  disconnected = false;
  constructor(public callback: () => void) { observers.push(this); }
  observe(item: Element) { this.items.add(item); }
  unobserve(item: Element) { this.items.delete(item); }
  disconnect() { this.items.clear(); this.disconnected = true; }
}

function resize() {
  act(() => {
    observers.forEach((observer) => observer.callback());
    for (const [id, callback] of [...frames]) { frames.delete(id); callback(0); }
  });
}

function StatefulCard({ id, size = "compact" }: { id: string; size?: "compact" | "wide" }) {
  const [count, setCount] = useState(0);
  return <section data-testid={id} data-size={size} data-height={120 + count * 70}><button onClick={() => setCount((value) => value + 1)}>{id}: {count}</button></section>;
}

beforeEach(() => {
  gridWidth = 1000;
  frames.clear(); observers.length = 0;
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { const id = ++nextFrame; frames.set(id, callback); return id; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) { return new DOMRect(0, 0, gridWidth, Number(this.dataset.height ?? 0)); });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("AnalyticsGrid", () => {
  it("uses natural row heights and changes columns without replacing cards or losing focus", () => {
    render(<AnalyticsGrid data-testid="grid"><StatefulCard id="first" /><StatefulCard id="second" /></AnalyticsGrid>);
    const card = screen.getByTestId("first");
    const button = screen.getByRole("button", { name: "first: 0" });
    expect(screen.getByTestId("grid")).toHaveAttribute("data-layout", "rows");
    expect(screen.getByTestId("grid")).toHaveAttribute("data-columns", "2");
    expect(card.style.getPropertyValue("--analytics-row-span")).toBe("");
    button.focus(); fireEvent.click(button); resize();
    expect(screen.getByTestId("first")).toBe(card);
    expect(card.style.gridRowEnd).toBe("");
    expect(screen.getByRole("button", { name: "first: 1" })).toHaveFocus();
    gridWidth = 375; resize();
    expect(screen.getByTestId("grid")).toHaveAttribute("data-columns", "1");
    expect(screen.getByRole("button", { name: "first: 1" })).toHaveFocus();
  });

  it("preserves DOM order across wide barriers, reorder and additions", () => {
    const { rerender } = render(<AnalyticsGrid data-testid="grid"><StatefulCard key="first" id="first" /><StatefulCard key="wide" id="wide" size="wide" /><StatefulCard key="last" id="last" /></AnalyticsGrid>);
    fireEvent.click(screen.getByRole("button", { name: "first: 0" }));
    const first = screen.getByTestId("first");
    rerender(<AnalyticsGrid data-testid="grid"><StatefulCard key="wide" id="wide" size="wide" /><StatefulCard key="first" id="first" /><StatefulCard key="new" id="new" /></AnalyticsGrid>);
    expect(screen.getByTestId("new").style.gridRowEnd).toBe("");
    expect([...screen.getByTestId("grid").children].map((item) => item.getAttribute("data-testid"))).toEqual(["wide", "first", "new"]);
    expect(screen.getByTestId("first")).toBe(first);
    expect(screen.getByRole("button", { name: "first: 1" })).toBeInTheDocument();
    expect([...observers[0].items]).toEqual([screen.getByTestId("grid")]);
  });

  it("fills orphan rows and recomputes after hide, reorder and width changes without changing saved sizes", async () => {
    const renderCards = (cards: { id: string; size?: "compact" | "wide" }[]) => <AnalyticsGrid data-testid="grid">{cards.map((card) => <StatefulCard key={card.id} {...card} />)}</AnalyticsGrid>;
    const { rerender } = render(renderCards([{ id: "first" }, { id: "wide", size: "wide" }, { id: "last" }]));
    const first = screen.getByTestId("first");
    const last = screen.getByTestId("last");
    expect(first).toHaveAttribute("data-grid-orphan", "true");
    expect(last).toHaveAttribute("data-grid-orphan", "true");
    expect(first).toHaveAttribute("data-size", "compact");
    fireEvent.click(screen.getByRole("button", { name: "first: 0" }));
    rerender(renderCards([{ id: "wide", size: "wide" }, { id: "first" }, { id: "last" }]));
    await waitFor(() => expect(first).not.toHaveAttribute("data-grid-orphan"));
    expect(last).not.toHaveAttribute("data-grid-orphan");
    expect(screen.getByRole("button", { name: "first: 1" })).toBeInTheDocument();
    expect(screen.getByTestId("first")).toBe(first);
    rerender(renderCards([{ id: "wide", size: "wide" }, { id: "first" }]));
    await waitFor(() => expect(first).toHaveAttribute("data-grid-orphan", "true"));
    rerender(renderCards([{ id: "wide", size: "wide" }, { id: "first", size: "wide" }]));
    await waitFor(() => expect(first).not.toHaveAttribute("data-grid-orphan"));
    rerender(renderCards([{ id: "wide", size: "wide" }, { id: "first" }]));
    await waitFor(() => expect(first).toHaveAttribute("data-grid-orphan", "true"));
    gridWidth = 375; resize();
    expect(first).not.toHaveAttribute("data-grid-orphan");
    gridWidth = 1000; resize();
    expect(first).toHaveAttribute("data-grid-orphan", "true");
    expect(first).toHaveAttribute("data-size", "compact");
  });

  it("disconnects observers and cancels queued measurements on unmount", () => {
    const { unmount } = render(<AnalyticsGrid><StatefulCard id="first" /></AnalyticsGrid>);
    observers[0].callback();
    expect(frames.size).toBe(1);
    unmount();
    expect(frames.size).toBe(0);
    expect(observers[0].disconnected).toBe(true);
  });

  it("retains the non-overlapping normal grid fallback without ResizeObserver", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    render(<AnalyticsGrid data-testid="grid"><StatefulCard id="first" /></AnalyticsGrid>);
    expect(screen.getByTestId("grid")).not.toHaveAttribute("data-measured");
    expect(screen.getByRole("button", { name: "first: 0" })).toBeInTheDocument();
  });
});
