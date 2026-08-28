import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MangaPageSelector } from "../MangaPageSelector";

function selectorProps(onSelectionComplete = vi.fn()) {
  return {
    src: "/page.jpg",
    width: 800,
    height: 1_200,
    alt: "Page 1",
    onSelectionComplete,
  };
}

function preparePointerSurface(selector: HTMLElement) {
  Object.defineProperties(selector, {
    getBoundingClientRect: {
      configurable: true,
      value: () => ({ bottom: 1_200, height: 1_200, left: 0, right: 800, top: 0, width: 800, x: 0, y: 0, toJSON: () => ({}) }),
    },
    hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
    releasePointerCapture: { configurable: true, value: vi.fn() },
    setPointerCapture: { configurable: true, value: vi.fn() },
  });
}

describe("MangaPageSelector", () => {
  it("sizes the selectable surface from the page's intrinsic aspect ratio", () => {
    render(<MangaPageSelector {...selectorProps()} />);

    const surface = screen.getByTestId("manga-page-surface");
    expect(surface.style.getPropertyValue("--manga-page-aspect")).toBe(String(800 / 1_200));
    expect(surface).toContainElement(screen.getByRole("img", { name: "Page 1" }));
  });

  it("commits a pointer crop once and immediately clears its highlight", () => {
    const onSelectionComplete = vi.fn();
    const { container } = render(<MangaPageSelector {...selectorProps(onSelectionComplete)} />);
    const selector = screen.getByRole("group", { name: "Select text on Page 1" });
    preparePointerSurface(selector);

    fireEvent.pointerDown(selector, { button: 0, clientX: 80, clientY: 240, pointerId: 4 });
    fireEvent.pointerMove(selector, { clientX: 400, clientY: 840, pointerId: 4 });
    const crop = container.querySelector<HTMLElement>('span[aria-hidden="true"]');
    expect(crop).toHaveStyle({ left: "10%", top: "20%", width: "40%" });
    expect(Number.parseFloat(crop?.style.height ?? "0")).toBeCloseTo(50);

    fireEvent.pointerUp(selector, { clientX: 400, clientY: 840, pointerId: 4 });

    expect(onSelectionComplete).toHaveBeenCalledOnce();
    const committed = onSelectionComplete.mock.calls[0][0];
    expect(committed.x).toBeCloseTo(0.1);
    expect(committed.y).toBeCloseTo(0.2);
    expect(committed.width).toBeCloseTo(0.4);
    expect(committed.height).toBeCloseTo(0.5);
    expect(container.querySelector('span[aria-hidden="true"]')).not.toBeInTheDocument();
  });

  it("edits and commits a keyboard crop without leaking crop keys to page navigation", () => {
    const onSelectionComplete = vi.fn();
    const onNavigationKey = vi.fn();
    const { container } = render(<div onKeyDown={onNavigationKey}><MangaPageSelector {...selectorProps(onSelectionComplete)} /></div>);
    const selector = screen.getByRole("group", { name: "Select text on Page 1" });

    fireEvent.keyDown(selector, { key: "ArrowRight" });
    expect(onNavigationKey).toHaveBeenCalledOnce();
    onNavigationKey.mockClear();

    fireEvent.keyDown(selector, { key: "Enter" });
    expect(onSelectionComplete).not.toHaveBeenCalled();
    expect(onNavigationKey).not.toHaveBeenCalled();
    expect(container.querySelector('span[aria-hidden="true"]')).toHaveStyle({ left: "25%", top: "25%", width: "50%", height: "50%" });

    fireEvent.keyDown(selector, { key: "ArrowRight" });
    fireEvent.keyDown(selector, { key: "ArrowDown", shiftKey: true });
    expect(onNavigationKey).not.toHaveBeenCalled();
    expect(container.querySelector('span[aria-hidden="true"]')).toHaveStyle({ left: "27%", top: "25%", width: "50%", height: "52%" });

    fireEvent.keyDown(selector, { key: "Enter" });
    expect(onSelectionComplete).toHaveBeenCalledWith({ x: 0.27, y: 0.25, width: 0.5, height: 0.52 });
    expect(container.querySelector('span[aria-hidden="true"]')).not.toBeInTheDocument();
    expect(onNavigationKey).not.toHaveBeenCalled();
  });

  it("cancels a keyboard crop with Escape", () => {
    const onSelectionComplete = vi.fn();
    const { container } = render(<MangaPageSelector {...selectorProps(onSelectionComplete)} />);
    const selector = screen.getByRole("group", { name: "Select text on Page 1" });

    fireEvent.keyDown(selector, { key: " " });
    expect(container.querySelector('span[aria-hidden="true"]')).toBeInTheDocument();
    fireEvent.keyDown(selector, { key: "Escape" });

    expect(container.querySelector('span[aria-hidden="true"]')).not.toBeInTheDocument();
    expect(onSelectionComplete).not.toHaveBeenCalled();
  });

  it("shows an optional normalized status tooltip without restoring the crop highlight", () => {
    const bounds = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const width = this.getAttribute("role") === "group" ? 800 : this.getAttribute("role") === "status" ? 288 : 0;
      const height = this.getAttribute("role") === "group" ? 1_200 : this.getAttribute("role") === "status" ? 100 : 0;
      return { bottom: height, height, left: 0, right: width, top: 0, width, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    });
    const { container } = render(<MangaPageSelector
      {...selectorProps()}
      tooltip={{
        busy: true,
        content: <span lang="ja">認識しています…</span>,
        selection: { x: 0.9, y: 0.9, width: 0.4, height: 0.4 },
      }}
    />);

    const tooltip = screen.getByRole("status");
    expect(tooltip).toHaveAttribute("aria-busy", "true");
    expect(tooltip).toHaveTextContent("認識しています…");
    expect(tooltip).toHaveAttribute("data-placement", "above");
    expect(tooltip).toHaveStyle({ left: "504px", top: "972px" });
    expect(container.querySelector('span[aria-hidden="true"]')).not.toBeInTheDocument();
    bounds.mockRestore();
  });

  it("dismisses a completed OCR result by button or Escape without starting a new crop", () => {
    const onDismiss = vi.fn();
    const onSelectionComplete = vi.fn();
    const { container } = render(<MangaPageSelector
      {...selectorProps(onSelectionComplete)}
      tooltip={{
        content: <span lang="ja">猫です</span>,
        onDismiss,
        selection: { x: 0.2, y: 0.2, width: 0.4, height: 0.2 },
      }}
    />);
    const selector = screen.getByRole("group", { name: "Select text on Page 1" });
    preparePointerSurface(selector);

    expect(screen.getByRole("dialog", { name: "OCR result" })).toHaveTextContent("猫です");
    const close = screen.getByRole("button", { name: "Close OCR result" });
    fireEvent.pointerDown(close, { button: 0, pointerId: 7 });
    fireEvent.click(close);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onSelectionComplete).not.toHaveBeenCalled();
    expect(container.querySelector('span[aria-hidden="true"]')).not.toBeInTheDocument();

    onDismiss.mockClear();
    fireEvent.keyDown(selector, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
