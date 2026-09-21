import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { StudyShortcutSettings } from "./StudyShortcutSettings";
import { DEFAULT_STUDY_SHORTCUTS } from "../study-shortcuts";

function Settings() {
  const [value, setValue] = useState(DEFAULT_STUDY_SHORTCUTS);
  return <StudyShortcutSettings value={value} onChange={setValue} />;
}
describe("study key modal", () => {
  it("opens from one row, captures keys, rejects conflicts, cancels, and resets", () => {
    render(<Settings />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const entry = screen.getByRole("button", { name: /Custom study keys/ });
    fireEvent.click(entry);
    expect(screen.getByRole("dialog", { name: "Study keys" })).toBeVisible();
    const key = screen.getByRole("button", { name: /Change reveal.*key/ });
    fireEvent.click(key);
    fireEvent.keyDown(key, { key: "r" });
    expect(screen.getByRole("status")).toHaveTextContent("already used");
    fireEvent.keyDown(key, { key: " " });
    expect(key).toHaveTextContent("Space");
    fireEvent.click(key);
    fireEvent.keyDown(key, { key: "Escape" });
    expect(key).toHaveTextContent("Space");
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));
    expect(key).toHaveTextContent("Enter");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(entry).toHaveFocus();
  });
});
