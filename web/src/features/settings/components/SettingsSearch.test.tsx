import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsSearch } from "./SettingsSearch";

describe("settings search navigation", () => {
  it("finds a misspelled setting, then opens and focuses the existing control", async () => {
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scroll });
    render(<SettingsSearch><section><h2>Reviews</h2><label data-settings-search=""><strong>Answer feedback sounds</strong><small>Mute feedback sound after submitting</small><input type="checkbox" defaultChecked /></label></section></SettingsSearch>);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "feeback soud" } });
    expect(screen.getByRole("status")).toHaveTextContent("1 setting found");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter", isComposing: true });
    expect(screen.getByRole("searchbox")).toHaveValue("feeback soud");
    fireEvent.click(screen.getByRole("button", { name: /Answer feedback sounds/ }));
    await waitFor(() => expect(screen.getByRole("checkbox")).toHaveFocus());
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(scroll).toHaveBeenCalled();
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  });
  it("shows no results without indexing private input values, and Escape restores settings", () => {
    render(<SettingsSearch><section><h2>Account</h2><label data-settings-search=""><strong>API key</strong><input type="password" defaultValue="private-key-value" /></label></section></SettingsSearch>);
    const search = screen.getByRole("searchbox");
    fireEvent.change(search, { target: { value: "private-key-value" } });
    expect(screen.getByRole("status")).toHaveTextContent("No settings found");
    fireEvent.keyDown(search, { key: "Escape" });
    expect(search).toHaveValue("");
    expect(screen.getByLabelText("API key")).toBeVisible();
  });
});
