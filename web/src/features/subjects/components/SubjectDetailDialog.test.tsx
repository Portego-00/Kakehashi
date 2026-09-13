import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubjectDetailDialog } from "./SubjectDetailDialog";

const router = vi.hoisted(() => ({ back: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

describe("subject detail dialog", () => {
  beforeEach(() => router.back.mockReset());

  it("uses route history to return to the preserved lyrics screen", () => {
    render(<SubjectDetailDialog returnLabel="Back to lyrics"><p>School</p></SubjectDetailDialog>);

    const dialog = screen.getByRole("dialog", { name: "Item details" });
    expect(dialog).toHaveAttribute("open");
    expect(screen.getByText("School")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to lyrics" }));
    expect(router.back).toHaveBeenCalledOnce();
  });

  it("closes on Escape or a backdrop click", () => {
    render(<SubjectDetailDialog returnLabel="Back to lyrics"><p>School</p></SubjectDetailDialog>);
    const dialog = screen.getByRole("dialog", { name: "Item details" });

    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));
    fireEvent.click(dialog);

    expect(router.back).toHaveBeenCalledTimes(2);
  });
});
