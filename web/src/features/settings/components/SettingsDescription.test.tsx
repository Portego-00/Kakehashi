import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { SettingsToggleRow } from "./SettingsToggleRow";
it("opens help on hover and keyboard focus, dismisses with Escape, and never toggles the setting", () => {
  const change = vi.fn();
  render(<SettingsToggleRow label="Sounds" description="Play feedback after grading." setting="feedback-sound" checked onChange={change} />);
  const help = screen.getByRole("button", { name: "About Sounds" });
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  fireEvent.mouseEnter(help); expect(screen.getByRole("tooltip")).toHaveTextContent("Play feedback");
  fireEvent.mouseLeave(help); expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  fireEvent.focus(help); expect(screen.getByRole("tooltip")).toBeInTheDocument();
  fireEvent.click(help); expect(change).not.toHaveBeenCalled();
  fireEvent.keyDown(document, { key: "Escape" }); expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "Sounds" })).toBeChecked();
});
