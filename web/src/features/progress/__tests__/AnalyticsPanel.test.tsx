import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Gauge } from "lucide-react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsPanel } from "../components/AnalyticsPanel";

const showModalDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");

function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((value) => value + 1)}>Selection {count}</button>;
}
function Panel() {
  const [expanded, setExpanded] = useState(false);
  return <AnalyticsPanel card={{ id: "accuracy", size: "compact" }} title="Accuracy" icon={Gauge} expanded={expanded} onExpand={() => setExpanded(true)} onClose={() => setExpanded(false)}><Counter /></AnalyticsPanel>;
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 400, 260));
  vi.stubGlobal("scrollTo", vi.fn());
  vi.spyOn(window, "scrollY", "get").mockReturnValue(620);
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: vi.fn(function (this: HTMLDialogElement) { this.setAttribute("open", ""); }) });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: vi.fn(function (this: HTMLDialogElement) { this.removeAttribute("open"); }) });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.style.overflow = ""; document.documentElement.style.scrollbarGutter = "";
  if (showModalDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "showModal", showModalDescriptor); else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (closeDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "close", closeDescriptor); else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

describe("AnalyticsPanel", () => {
  it("keeps the same widget state and stretched row height while expanding and closing", () => {
    render(<Panel />);
    const selection = screen.getByRole("button", { name: "Selection 0" });
    fireEvent.click(selection);
    const section = selection.closest("section");
    fireEvent.click(screen.getByRole("button", { name: "Expand Accuracy" }));
    expect(section).toHaveStyle({ minHeight: "260px" });
    expect(section).toHaveAttribute("data-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Accuracy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Selection 1" })).toBe(selection);
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Close Accuracy" }));
    expect(screen.getByRole("region", { name: "Accuracy" })).toBeInTheDocument();
    expect(section).not.toHaveAttribute("data-expanded");
    expect(section?.querySelector("[data-analytics-body]")).not.toHaveAttribute("data-expanded");
    expect(screen.getByRole("button", { name: "Selection 1" })).toBe(selection);
    expect(screen.getByRole("button", { name: "Expand Accuracy" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
    expect(window.scrollTo).toHaveBeenCalledWith({ left: 0, top: 620 });
  });

  it("restores page styles when an expanded widget unmounts", () => {
    document.body.style.overflow = "auto";
    document.documentElement.style.scrollbarGutter = "stable both-edges";
    const { unmount } = render(<Panel />);
    fireEvent.click(screen.getByRole("button", { name: "Expand Accuracy" }));
    unmount();
    expect(document.body.style.overflow).toBe("auto");
    expect(document.documentElement.style.scrollbarGutter).toBe("stable both-edges");
  });
});
