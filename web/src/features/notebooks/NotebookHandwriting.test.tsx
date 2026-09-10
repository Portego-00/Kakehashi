import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import NotebookHandwriting from "./NotebookHandwriting";
import { notebookSchema } from "./editor-schema";
import { sanitizeNotebookBlocks } from "./model";

afterEach(() => { cleanup(); delete document.documentElement.dataset.theme; document.documentElement.style.removeProperty("--color-surface"); });

const drawing = { drawingId: "drawing-123", width: 768, height: 1024 };

describe("private notebook handwriting", () => {
  it("requests the actual dark ink PNG on dark paper and reloads the light PNG after a theme change", async () => {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.style.setProperty("--color-surface", "#1e1e1e");
    render(<NotebookHandwriting {...drawing} previewFormat="themed-v1" paperColor="auto" />);
    expect(screen.getByAltText("Handwritten notebook page")).toHaveAttribute("src", expect.stringContaining("appearance=dark"));
    fireEvent.load(screen.getByAltText("Handwritten notebook page"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Expand handwriting" })).toBeEnabled());
    await act(async () => { document.documentElement.dataset.theme = "light"; document.documentElement.style.setProperty("--color-surface", "#ffffff"); });
    expect(screen.getByAltText("Handwritten notebook page")).toHaveAttribute("src", expect.stringContaining("appearance=light"));
    expect(screen.getByRole("button", { name: "Expand handwriting" })).toBeDisabled();
  });
  it("selects the preview by explicit paper color independently of app theme", () => {
    document.documentElement.dataset.theme = "dark";
    const view = render(<NotebookHandwriting {...drawing} previewFormat="themed-v1" paperColor="#fbf6ed" />);
    const image = screen.getByAltText("Handwritten notebook page");
    expect(image).toHaveAttribute("src", expect.stringContaining("appearance=light"));
    expect(image.closest('[aria-busy]')).toHaveStyle({ background: "#fbf6ed" });
    view.rerender(<NotebookHandwriting {...drawing} previewFormat="themed-v1" paperColor="#0000ff" />);
    expect(screen.getByAltText("Handwritten notebook page")).toHaveAttribute("src", expect.stringContaining("appearance=dark"));
  });
  it("keeps legacy opaque previews on their original white paper", () => {
    document.documentElement.dataset.theme = "dark";
    render(<NotebookHandwriting {...drawing} paperColor="#111111" />);
    const image = screen.getByAltText("Handwritten notebook page");
    expect(image.getAttribute("src")).not.toContain("appearance=");
    expect(image.closest('[aria-busy]')).toHaveStyle({ background: "#ffffff" });
  });
  it("preserves saved themed ink and custom paper through an actual BlockNote edit", () => {
    const props = { drawingId: "00a00000-0000-4000-8000-000000000001", width: 768, height: 384, paperColor: "#fbf6ed", previewFormat: "themed-v1" as const };
    const editor = BlockNoteEditor.create({ schema: notebookSchema, initialContent: [{ id: "ink", type: "handwriting", props }] });
    try {
      editor.insertBlocks([{ type: "paragraph", content: "Study note" }], "ink", "after");
      expect(sanitizeNotebookBlocks(editor.document)[0].props).toEqual(props);
    } finally { editor.unmount(); }
  });
  it("changes one area's paper from the web controls without replacing either ink asset", () => {
    const props = { drawingId: "00a00000-0000-4000-8000-000000000001", width: 768, height: 384, paperColor: "auto", previewFormat: "themed-v1" as const };
    const other = { ...props, drawingId: "00a00000-0000-4000-8000-000000000002", paperColor: "#fbf6ed" };
    const editor = BlockNoteEditor.create({ schema: notebookSchema, initialContent: [{ id: "ink", type: "handwriting", props }, { id: "other", type: "handwriting", props: other }] });
    try {
      render(<NotebookHandwriting {...props} onPaperColorChange={(paperColor) => editor.updateBlock("ink", { props: { paperColor } })} />);
      fireEvent.change(screen.getByLabelText("Paper color"), { target: { value: "#202020" } });
      expect(sanitizeNotebookBlocks(editor.document)[0].props).toEqual({ ...props, paperColor: "#202020" });
      fireEvent.input(screen.getByLabelText("Custom paper color"), { target: { value: "#d0e0f0" } });
      expect(sanitizeNotebookBlocks(editor.document)[0].props).toEqual({ ...props, paperColor: "#d0e0f0" });
      expect(sanitizeNotebookBlocks(editor.document)[1].props).toEqual(other);
    } finally { editor.unmount(); }
  });
  it("loads the saved drawing directly from the session-protected route and retains its paper proportions", async () => {
    render(<NotebookHandwriting {...drawing} />);
    const image = screen.getByAltText("Handwritten notebook page");
    expect(image).toHaveAttribute("src", new URL("/api/notebooks/drawings/drawing-123/preview", window.location.href).href);
    expect(image).not.toHaveAttribute("srcset");
    expect(image).toHaveAttribute("width", "768");
    expect(image).toHaveAttribute("height", "1024");
    expect(screen.getByRole("status")).toHaveTextContent("Loading handwriting…");
    expect(screen.getByRole("button", { name: "Expand handwriting" })).toBeDisabled();
    fireEvent.load(image);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(image).toHaveAttribute("data-ready", "true");
    expect(screen.getByRole("button", { name: "Expand handwriting" })).toBeEnabled();
  });

  it("shows an explicit error when a private drawing cannot be loaded and retries a fresh request", async () => {
    render(<NotebookHandwriting {...drawing} />);
    fireEvent.error(screen.getByAltText("Handwritten notebook page"));
    expect(screen.getByRole("alert")).toHaveTextContent("This handwriting couldn’t be loaded.");
    expect(screen.getByRole("button", { name: "Expand handwriting" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry handwriting" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    const retryImage = screen.getByAltText("Handwritten notebook page");
    expect(retryImage).toHaveAttribute("src", new URL("/api/notebooks/drawings/drawing-123/preview?retry=1", window.location.href).href);
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.load(retryImage);
    await waitFor(() => expect(screen.getByRole("button", { name: "Expand handwriting" })).toBeEnabled());
  });

  it("does not carry over the previous drawing or its readiness when the saved drawing changes", async () => {
    const view = render(<NotebookHandwriting {...drawing} />);
    fireEvent.load(screen.getByAltText("Handwritten notebook page"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Expand handwriting" })).toBeEnabled());
    view.rerender(<NotebookHandwriting {...drawing} drawingId="replacement-456" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading handwriting…");
    expect(screen.getByAltText("Handwritten notebook page")).toHaveAttribute("src", new URL("/api/notebooks/drawings/replacement-456/preview", window.location.href).href);
    expect(screen.getByRole("button", { name: "Expand handwriting" })).toBeDisabled();
  });

  it("expands through an accessible button into a labeled dialog with close and Escape support", async () => {
    render(<NotebookHandwriting {...drawing} />);
    fireEvent.load(screen.getByAltText("Handwritten notebook page"));
    const expand = screen.getByRole("button", { name: "Expand handwriting" });
    await waitFor(() => expect(expand).toBeEnabled());
    expect(expand).toHaveAttribute("aria-haspopup", "dialog");
    expand.focus();
    fireEvent.click(expand);
    const dialog = screen.getByRole("dialog", { name: "Handwriting" });
    expect(expand).toHaveAttribute("aria-expanded", "true");
    expect(within(dialog).getByAltText("Handwritten notebook page")).toHaveAttribute("src", new URL("/api/notebooks/drawings/drawing-123/preview", window.location.href).href);
    fireEvent.click(within(dialog).getByRole("button", { name: "Close handwriting" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(expand).toHaveFocus();
    fireEvent.click(expand);
    fireEvent(screen.getByRole("dialog", { name: "Handwriting" }), new Event("cancel", { bubbles: false, cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not render a blank success when a drawing reference is missing", () => {
    render(<NotebookHandwriting {...drawing} drawingId="" />);
    expect(screen.getByRole("alert")).toHaveTextContent("couldn’t be loaded");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand handwriting" })).toBeDisabled();
  });
  it("shows an intentionally blank inline area without a broken image request", () => {
    render(<NotebookHandwriting drawingId="" width={768} height={384} inkFormat="strokes-v1" />);
    expect(screen.getByLabelText("Empty handwriting area")).toHaveStyle({ aspectRatio: "768 / 384" });
    expect(screen.getByText("Write in this area on your iPad.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("reads a portable drawing through the same private PNG route", () => {
    render(<NotebookHandwriting {...drawing} inkFormat="strokes-v1" />);
    expect(screen.getByAltText("Handwritten notebook page")).toHaveAttribute("src", new URL("/api/notebooks/drawings/drawing-123/preview", window.location.href).href);
  });
  it("preserves the portable format and blank area through actual web editor changes", () => {
    const props = { drawingId: "", inkFormat: "strokes-v1" as const, width: 768, height: 384 };
    const editor = BlockNoteEditor.create({ schema: notebookSchema, initialContent: [{ id: "blank-area", type: "handwriting", props }] });
    try {
      editor.updateBlock("blank-area", { props: { height: 512 } });
      expect(sanitizeNotebookBlocks(editor.document)).toEqual([{ id: "blank-area", type: "handwriting", props: { ...props, height: 512 } }]);
    } finally { editor.unmount(); }
  });

  it("exports an explicit text fallback without a private image URL or asset ID", async () => {
    const editor = BlockNoteEditor.create({ schema: notebookSchema, initialContent: [{ id: "ink-block", type: "handwriting", props: drawing }] });
    try {
      const html = await editor.blocksToHTMLLossy(editor.document);
      expect(html).toContain("Handwriting (view in your notebook)");
      expect(html).not.toContain(drawing.drawingId);
      expect(html).not.toContain("/api/notebooks");
      expect(html).not.toContain("<img");
    } finally { editor.unmount(); }
  });
});
