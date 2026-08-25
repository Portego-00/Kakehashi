import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { settingsStorageKey } from "../settings";
import { SettingsWorkspace } from "./SettingsWorkspace";

vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: { data: { username: "Tester" } } }),
}));

vi.mock("@/lib/theme", () => ({
  useTheme: () => ({ theme: "light", resolvedTheme: "light", setTheme: vi.fn() }),
}));

vi.mock("@/features/anime/AnimePicker", () => ({ AnimePicker: () => null }));
vi.mock("@/features/dashboard/DashboardWidgetPreview", () => ({ DashboardWidgetPreview: () => null }));

describe("Gravatar profile settings", () => {
  beforeEach(() => window.localStorage.clear());

  it("validates and saves the normalized email for the current web user", async () => {
    render(<SettingsWorkspace />);
    const input = await screen.findByRole("textbox", { name: "Gravatar email" });

    fireEvent.change(input, { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Save email" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");

    fireEvent.change(input, { target: { value: " MyEmailAddress@example.com " } });
    fireEvent.click(screen.getByRole("button", { name: "Save email" }));

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(settingsStorageKey("Tester")) ?? "{}");
      expect(saved.profile.gravatarEmail).toBe("myemailaddress@example.com");
    });
  });
});
