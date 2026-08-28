import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileDropOverlay } from "./FileDropOverlay";

function renderOverlay({
  disabled = false,
  multiple = false,
  onFiles = vi.fn(),
}: {
  disabled?: boolean;
  multiple?: boolean;
  onFiles?: (files: File[], handles?: Array<FileSystemFileHandle | null>) => void;
} = {}) {
  render(
    <FileDropOverlay
      disabled={disabled}
      hint="PNG · JPG"
      icon={<span aria-hidden="true">Icon</span>}
      label="Drop files now"
      multiple={multiple}
      onFiles={onFiles}
    />,
  );
}

afterEach(cleanup);

describe("FileDropOverlay", () => {
  it("stays hidden until files enter the page", () => {
    renderOverlay();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.dragEnter(window, { dataTransfer: { files: [], types: ["text/plain"] } });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.dragEnter(window, { dataTransfer: { files: [], types: ["Files"] } });
    expect(screen.getByRole("status")).toHaveTextContent("Drop files now");
  });

  it("keeps the overlay visible while moving across nested page elements", () => {
    renderOverlay();
    const dataTransfer = { files: [], types: ["Files"] };
    fireEvent.dragEnter(window, { dataTransfer });
    const overlayCopy = screen.getByText("PNG · JPG");

    fireEvent.dragEnter(overlayCopy, { dataTransfer });
    fireEvent.dragLeave(overlayCopy, { dataTransfer });
    expect(screen.getByRole("status")).toBeInTheDocument();

    fireEvent.dragLeave(window, { dataTransfer });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("hides the overlay when the drag ends or the window loses focus", () => {
    renderOverlay();
    const dataTransfer = { files: [], types: ["Files"] };

    fireEvent.dragEnter(window, { dataTransfer });
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.dragEnd(window);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.dragEnter(window, { dataTransfer });
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.blur(window);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("blocks the browser's default file action while disabled", () => {
    const onFiles = vi.fn();
    renderOverlay({ disabled: true, onFiles });
    const file = new File(["image"], "page.png", { type: "image/png" });
    const dataTransfer = { dropEffect: "copy", files: [file], types: ["Files"] };

    expect(fireEvent.dragEnter(window, { dataTransfer })).toBe(false);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(fireEvent.dragOver(window, { dataTransfer })).toBe(false);
    expect(dataTransfer.dropEffect).toBe("none");
    expect(fireEvent.drop(window, { dataTransfer })).toBe(false);
    expect(onFiles).not.toHaveBeenCalled();
  });

  it("passes every dropped file only when multiple selection is enabled", () => {
    const first = new File(["first"], "first.png", { type: "image/png" });
    const second = new File(["second"], "second.png", { type: "image/png" });
    const singleOnFiles = vi.fn();
    renderOverlay({ onFiles: singleOnFiles });

    fireEvent.drop(window, { dataTransfer: { files: [first, second], types: ["Files"] } });
    expect(singleOnFiles).toHaveBeenCalledWith([first]);
    cleanup();

    const multipleOnFiles = vi.fn();
    renderOverlay({ multiple: true, onFiles: multipleOnFiles });
    fireEvent.drop(window, { dataTransfer: { files: [first, second], types: ["Files"] } });
    expect(multipleOnFiles).toHaveBeenCalledWith([first, second]);
  });

  it("passes file handles in the same order as dropped files", async () => {
    const first = new File(["first"], "first.cbz", { type: "application/zip" });
    const second = new File(["second"], "second.pdf", { type: "application/pdf" });
    const firstHandle = { kind: "file", name: "first.cbz" } as FileSystemFileHandle;
    const directoryHandle = { kind: "directory", name: "second" } as FileSystemDirectoryHandle;
    const onFiles = vi.fn();
    renderOverlay({ multiple: true, onFiles });

    fireEvent.drop(window, {
      dataTransfer: {
        files: [first, second],
        items: [
          {
            kind: "file",
            getAsFile: () => first,
            getAsFileSystemHandle: vi.fn().mockResolvedValue(firstHandle),
          },
          {
            kind: "file",
            getAsFile: () => second,
            getAsFileSystemHandle: vi.fn().mockResolvedValue(directoryHandle),
          },
        ],
        types: ["Files"],
      },
    });

    await waitFor(() => expect(onFiles).toHaveBeenCalledWith(
      [first, second],
      [firstHandle, null],
    ));
  });
});
