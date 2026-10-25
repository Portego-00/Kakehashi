import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NoteImageComposer, NoteImageGallery } from "./NoteImages";

describe("note images", () => {
  it("requires a loaded preview and adds the normalized URL", async () => {
    const onAdd = vi.fn();
    render(<NoteImageComposer onAdd={onAdd} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Image URL"), { target: { value: "javascript:alert(1)" } });
    expect(screen.getByRole("button", { name: "Add to note" })).toBeDisabled();
    expect(screen.getByText("Use a complete http:// or https:// image URL.")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Image URL"), { target: { value: " https://example.com/bridge.png " } });
    const preview = await screen.findByRole("img", { name: "Note image" });
    expect(screen.getByRole("button", { name: "Add to note" })).toBeDisabled();
    fireEvent.load(preview);
    fireEvent.click(screen.getByRole("button", { name: "Add to note" }));
    expect(onAdd).toHaveBeenCalledWith("https://example.com/bridge.png");
  });
  it("keeps a broken image out of the note", async () => {
    render(<NoteImageComposer onAdd={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Image URL"), { target: { value: "https://example.com/page" } });
    fireEvent.error(await screen.findByRole("img", { name: "Note image" }));
    expect(screen.getByText(/Image unavailable/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Add to note" })).toBeDisabled();
  });
  it("pinches in and out, continues with a one-finger pan, and removes the image", async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined);
    render(<NoteImageGallery images={["https://example.com/a.png", "https://example.com/b.png"]} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button", { name: "Open note image 2" }));
    expect(screen.getByRole("dialog", { name: "Note image" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Zoom in" })).not.toBeInTheDocument();
    const viewport = screen.getByRole("group", { name: "Image zoom and pan" });
    Object.defineProperties(viewport, { clientWidth: { value: 300 }, clientHeight: { value: 400 }, setPointerCapture: { value: vi.fn() } });
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 300, 400));
    fireEvent.pointerDown(viewport, { pointerId: 1, clientX: 100, clientY: 200 });
    fireEvent.pointerDown(viewport, { pointerId: 2, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 50, clientY: 200 });
    fireEvent.pointerMove(viewport, { pointerId: 2, clientX: 250, clientY: 200 });
    expect(screen.getByLabelText("Image zoom")).toHaveTextContent("200%");
    fireEvent.pointerUp(viewport, { pointerId: 2 });
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 80, clientY: 200 });
    expect(screen.getByAltText("Expanded note image")).toHaveStyle({ transform: "translate(30px, 0px) scale(2)" });
    fireEvent.pointerDown(viewport, { pointerId: 2, clientX: 250, clientY: 200 });
    fireEvent.pointerMove(viewport, { pointerId: 2, clientX: 165, clientY: 200 });
    expect(screen.getByLabelText("Image zoom")).toHaveTextContent("100%");
    fireEvent.click(screen.getByRole("button", { name: "Remove image" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onRemove).toHaveBeenCalledWith(1);
  });
  it("supports trackpad pinches without zooming the page, plus keyboard access", () => {
    render(<NoteImageGallery images={["https://example.com/a.png"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Open note image 1" }));
    const viewport = screen.getByRole("group", { name: "Image zoom and pan" });
    Object.defineProperties(viewport, { clientWidth: { value: 300 }, clientHeight: { value: 400 } });
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 300, 400));
    const pinch = new WheelEvent("wheel", { ctrlKey: true, deltaY: -Math.log(2) / 0.01, clientX: 150, clientY: 200, bubbles: true, cancelable: true });
    fireEvent(viewport, pinch);
    expect(pinch.defaultPrevented).toBe(true);
    expect(screen.getByLabelText("Image zoom")).toHaveTextContent("200%");
    fireEvent.keyDown(viewport, { key: "0" });
    expect(screen.getByLabelText("Image zoom")).toHaveTextContent("100%");
    fireEvent.keyDown(viewport, { key: "+" });
    expect(screen.getByLabelText("Image zoom")).toHaveTextContent("150%");
  });
  it("handles phone touch contacts separately from mouse pointers", () => {
    render(<NoteImageGallery images={["https://example.com/a.png"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Open note image 1" }));
    const viewport = screen.getByRole("group", { name: "Image zoom and pan" });
    Object.defineProperties(viewport, { clientWidth: { value: 300 }, clientHeight: { value: 400 } });
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 300, 400));
    const contacts = (distance: number) => [{ identifier: 1, clientX: 150 - distance / 2, clientY: 200 }, { identifier: 2, clientX: 150 + distance / 2, clientY: 200 }];
    fireEvent.touchStart(viewport, { touches: contacts(100) });
    fireEvent.touchMove(viewport, { touches: contacts(200) });
    expect(screen.getByLabelText("Image zoom")).toHaveTextContent("200%");
    fireEvent.touchEnd(viewport, { touches: [contacts(200)[0]] });
    fireEvent.touchMove(viewport, { touches: [{ identifier: 1, clientX: 80, clientY: 200 }] });
    expect(screen.getByAltText("Expanded note image")).toHaveStyle({ transform: "translate(30px, 0px) scale(2)" });
  });
  it("keeps the viewer and image on a failed removal", async () => {
    render(<NoteImageGallery images={["https://example.com/a.png"]} onRemove={vi.fn().mockRejectedValue(new Error("offline"))} />);
    fireEvent.click(screen.getByRole("button", { name: "Open note image 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove image" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The image wasn’t removed");
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove image" })).toBeEnabled();
  });

  it("closes only the image viewer when Escape is used inside another dialog", () => {
    const parentCancel = vi.fn();
    render(<dialog open aria-label="Subject details" onCancel={parentCancel}><NoteImageGallery images={["https://example.com/a.png"]} /></dialog>);
    fireEvent.click(screen.getByRole("button", { name: "Open note image 1" }));
    fireEvent(screen.getByRole("dialog", { name: "Note image" }), new Event("cancel", { bubbles: true, cancelable: true }));
    expect(parentCancel).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Note image" })).not.toBeInTheDocument();
  });
});
