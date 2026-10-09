import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewPresetsSettings } from "./review-presets-settings";
import type { ReviewPreset } from "../../../../../src/utils/review-presets";

function Harness() {
  const [presets, setPresets] = useState<ReviewPreset[]>([]);
  return <ReviewPresetsSettings presets={presets} onChange={setPresets} />;
}

describe("review preset editor", () => {
  it("creates and edits presets, limits to three, and frees a slot on deletion", () => {
    render(<Harness />);
    for (const name of ["Quick", "Longer", "Focus"]) {
      fireEvent.click(screen.getByRole("button", { name: "Add Preset" }));
      fireEvent.change(screen.getByLabelText("Preset name"), { target: { value: name } });
      fireEvent.change(screen.getByLabelText("Preset batch size"), { target: { value: "20" } });
      fireEvent.change(screen.getByLabelText("Preset review order"), { target: { value: "ascendingSrsStage" } });
      fireEvent.click(screen.getByRole("button", { name: "Save Preset" }));
    }
    expect(screen.getByRole("button", { name: "Add Preset" })).toBeDisabled();
    expect(screen.getByText("3 of 3 presets · limit reached")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Edit Quick preset" }));
    expect(screen.getByLabelText("Preset batch size")).toHaveValue("20");
    expect(screen.getByLabelText("Preset review order")).toHaveValue("ascendingSrsStage");
    fireEvent.change(screen.getByLabelText("Preset name"), { target: { value: "Short" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Preset" }));
    expect(screen.getByRole("button", { name: "Edit Short preset" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Edit Focus preset" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Preset" }));
    expect(screen.getByRole("button", { name: "Add Preset" })).toBeEnabled();
  });

  it("validates names and discards changes when cancelled", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Add Preset" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Preset" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a name");
    fireEvent.change(screen.getByLabelText("Preset name"), { target: { value: "Discard" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: "Edit Discard preset" })).toBeNull();
    expect(screen.getByText("0 of 3 presets")).toBeVisible();
  });
});
