import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CustomSrsSettingsForm } from "./CustomSrsSettings";
import { createCustomSrsState, updateCustomSrsSettings } from "./model";
import { DEFAULT_CUSTOM_SRS_SETTINGS } from "./srs-settings";

function setup(onSave = vi.fn().mockResolvedValue(undefined)) {
  const policy = createCustomSrsState().policy;
  const onReload = vi.fn().mockResolvedValue(undefined);
  const props = { policy, onSave, onReload, blocked: false };
  const result = render(<CustomSrsSettingsForm {...props} />);
  return { ...result, props, onSave, onReload };
}

describe("custom vocabulary settings form", () => {
  it("shows WaniKani defaults, validates durations and requires an explicit save", async () => {
    const { onSave } = setup();
    expect(screen.getByLabelText("Scheduling mode")).toHaveValue("wanikani");
    expect(screen.getByLabelText("Apprentice III interval")).toHaveValue("23h");
    expect(screen.getByRole("button", { name: "Save schedule" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Apprentice I interval"), { target: { value: "nonsense" } });
    expect(screen.getByRole("alert")).toHaveTextContent("whole minutes");
    fireEvent.change(screen.getByLabelText("Apprentice I interval"), { target: { value: "10m" } });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ stageIntervals: [10, 480, 1380, 2820, 10020, 20100, 43140, 172740] }), 0, expect.any(String)));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("saved to your account"));
  });

  it("keeps edits on a failed save and retries the same event ID", async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error("Network unavailable")).mockResolvedValue(undefined);
    setup(onSave);
    fireEvent.change(screen.getByLabelText("Scheduling mode"), { target: { value: "fsrs" } });
    fireEvent.change(screen.getByLabelText("Target retention (%)"), { target: { value: "95" } });
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Network unavailable"));
    expect(screen.getByLabelText("Target retention (%)")).toHaveValue(95);
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave.mock.calls[0]).toEqual(onSave.mock.calls[1]);
  });

  it("blocks a stale form and reloads the saved policy without silently overwriting it", async () => {
    const { props, rerender, onReload } = setup();
    fireEvent.change(screen.getByLabelText("Scheduling mode"), { target: { value: "fsrs" } });
    const policy = updateCustomSrsSettings(createCustomSrsState(), DEFAULT_CUSTOM_SRS_SETTINGS, 0, "remote").policy;
    rerender(<CustomSrsSettingsForm {...props} policy={policy} />);
    expect(screen.getByRole("button", { name: "Save schedule" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("changed on another device");
    fireEvent.click(screen.getByRole("button", { name: "Reload saved settings" }));
    await waitFor(() => expect(onReload).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByLabelText("Scheduling mode")).toHaveValue("wanikani"));
  });
});
