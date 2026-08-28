import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openLinkedFilePicker, supportsLinkedLocalFiles } from "./local-file-source";
import { LocalFilePicker } from "./LocalFilePicker";

vi.mock("./local-file-source", () => ({
  openLinkedFilePicker: vi.fn(),
  supportsLinkedLocalFiles: vi.fn(),
}));

const openPicker = vi.mocked(openLinkedFilePicker);
const supportsPicker = vi.mocked(supportsLinkedLocalFiles);
const mangaAccept = {
  "application/pdf": [".pdf"],
  "application/zip": [".cbz", ".zip"],
} as const;

function renderPicker(onFiles = vi.fn()) {
  return render(
    <LocalFilePicker
      className="existing-button"
      accept={mangaAccept}
      description="Manga files"
      multiple
      onFiles={onFiles}
    >
      Import manga
    </LocalFilePicker>,
  );
}

beforeEach(() => {
  supportsPicker.mockReturnValue(false);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("LocalFilePicker", () => {
  it("selects linked files with aligned handles when the picker is supported", async () => {
    const first = new File(["one"], "one.cbz", { type: "application/zip" });
    const second = new File(["two"], "two.pdf", { type: "application/pdf" });
    const firstHandle = { kind: "file", name: "one.cbz" } as FileSystemFileHandle;
    const secondHandle = { kind: "file", name: "two.pdf" } as FileSystemFileHandle;
    const onFiles = vi.fn();
    supportsPicker.mockReturnValue(true);
    openPicker.mockResolvedValue([
      { file: first, handle: firstHandle },
      { file: second, handle: secondHandle },
    ]);
    renderPicker(onFiles);

    const button = screen.getByRole("button", { name: "Import manga" });
    fireEvent.click(button);

    await waitFor(() => expect(onFiles).toHaveBeenCalledWith(
      [first, second],
      [firstHandle, secondHandle],
    ));
    expect(openPicker).toHaveBeenCalledWith({
      accept: mangaAccept,
      description: "Manga files",
      multiple: true,
    });
    expect(button.tagName).toBe("BUTTON");
  });

  it("does nothing when the linked picker is cancelled", async () => {
    const onFiles = vi.fn();
    supportsPicker.mockReturnValue(true);
    openPicker.mockResolvedValue([]);
    renderPicker(onFiles);

    fireEvent.click(screen.getByText("Import manga"));

    await waitFor(() => expect(openPicker).toHaveBeenCalledOnce());
    expect(onFiles).not.toHaveBeenCalled();
  });

  it("surfaces linked-picker read failures without trying a second chooser", async () => {
    const pickerError = new DOMException("The selected file is unavailable", "NotReadableError");
    const onPickerError = vi.fn();
    supportsPicker.mockReturnValue(true);
    openPicker.mockRejectedValue(pickerError);
    const { container } = render(
      <LocalFilePicker onFiles={vi.fn()} onPickerError={onPickerError}>Choose file</LocalFilePicker>,
    );
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const inputClick = vi.spyOn(input, "click");

    fireEvent.click(screen.getByRole("button", { name: "Choose file" }));

    await waitFor(() => expect(onPickerError).toHaveBeenCalledWith(expect.objectContaining({
      message: pickerError.message,
      name: pickerError.name,
    })));
    expect(inputClick).not.toHaveBeenCalled();
  });

  it("falls back to its hidden multi-file input with aligned null handles", () => {
    const first = new File(["one"], "one.cbz", { type: "application/zip" });
    const second = new File(["two"], "two.pdf", { type: "application/pdf" });
    const onFiles = vi.fn();
    const { container } = renderPicker(onFiles);
    const label = screen.getByText("Import manga");
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;

    expect(label).toHaveClass("existing-button");
    expect(input).toHaveAttribute("accept", "application/pdf,.pdf,application/zip,.cbz,.zip");
    expect(input).toHaveAttribute("multiple");
    expect(input).toHaveAttribute("tabindex", "-1");
    expect(input).toHaveAttribute("aria-hidden", "true");
    fireEvent.change(input, { target: { files: [first, second] } });

    expect(openPicker).not.toHaveBeenCalled();
    expect(onFiles).toHaveBeenCalledWith([first, second], [null, null]);
  });

  it("does not open either picker while disabled", () => {
    const onFiles = vi.fn();
    supportsPicker.mockReturnValue(true);
    const { container } = render(
      <LocalFilePicker disabled onFiles={onFiles}>Choose file</LocalFilePicker>,
    );

    fireEvent.click(screen.getByText("Choose file"));

    expect(openPicker).not.toHaveBeenCalled();
    expect(container.querySelector("input")).toBeDisabled();
    expect(onFiles).not.toHaveBeenCalled();
  });
});
