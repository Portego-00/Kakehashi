import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VacationModeControls } from "./VacationModeControls";
import { WANIKANI_VACATION_SETTINGS_URL } from "./vacation";

describe("VacationModeControls", () => {
  it("sends users to the official account setting with a state-specific action", () => {
    const { rerender } = render(<VacationModeControls active={false} refresh={vi.fn()} />);
    expect(screen.getByRole("link", { name: /Turn on in WaniKani/ })).toHaveAttribute("href", WANIKANI_VACATION_SETTINGS_URL);
    expect(screen.getByRole("link", { name: /Turn on in WaniKani/ })).toHaveAttribute("target", "_blank");

    rerender(<VacationModeControls active refresh={vi.fn()} />);
    expect(screen.getByRole("link", { name: /Turn off in WaniKani/ })).toBeInTheDocument();
  });

  it("checks the live status manually and after returning from WaniKani", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    render(<VacationModeControls active refresh={refresh} />);

    fireEvent.click(screen.getByRole("button", { name: "Check status" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toHaveTextContent("Vacation Mode status refreshed.");

    fireEvent.click(screen.getByRole("link", { name: /Turn off in WaniKani/ }));
    fireEvent.focus(window);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
  });

  it("announces a failed status check", async () => {
    render(<VacationModeControls active={false} refresh={vi.fn().mockRejectedValue(new Error("offline"))} />);
    fireEvent.click(screen.getByRole("button", { name: "Check status" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("could not be refreshed"));
  });
});
