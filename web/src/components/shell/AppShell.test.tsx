import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WKUser } from "@/types/wanikani";
import { AppShell } from "./AppShell";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  replace: vi.fn(),
  session: {
    status: "loading" as "loading" | "authenticated" | "anonymous" | "unavailable",
    user: null as WKUser | null,
    error: "",
    signOut: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/lib/session", () => ({
  useSession: () => ({ ...mocks.session, refresh: mocks.refresh }),
}));

vi.mock("@/lib/theme", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}));

vi.mock("@/features/settings/use-workspace-preferences", () => ({
  useWorkspacePreferences: () => ({ visibleNav: [] }),
}));

vi.mock("@/features/settings/components/SettingsApplicator", () => ({
  SettingsApplicator: () => null,
}));

describe("AppShell session bootstrap", () => {
  beforeEach(() => {
    mocks.session.status = "loading";
    mocks.session.user = null;
    mocks.session.error = "";
    mocks.refresh.mockClear();
    mocks.replace.mockClear();
  });

  it("uses a branded, polite status while the session is checked", () => {
    const { container } = render(<AppShell><p>Dashboard content</p></AppShell>);

    expect(screen.getByRole("main", { name: "Kakehashi is starting" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Opening your study space");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(container).toHaveTextContent("Kakehashi");
    expect(container.querySelector('img[src*="kakehashi-mark.png"]')).toBeInTheDocument();
    expect(screen.queryByText("Dashboard content")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps a failed session check assertive and retryable", () => {
    mocks.session.status = "unavailable";
    mocks.session.error = "WaniKani timed out.";
    render(<AppShell><p>Dashboard content</p></AppShell>);

    expect(screen.getByRole("alert")).toHaveTextContent("Your session could not be checked");
    expect(screen.getByRole("alert")).toHaveTextContent("WaniKani timed out.");
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("uses the canonical logo in authenticated app chrome", () => {
    mocks.session.status = "authenticated";
    mocks.session.user = {
      id: 1,
      object: "user",
      url: "https://api.wanikani.com/v2/user",
      data_updated_at: "2026-08-24T00:00:00.000Z",
      data: {
        username: "Pozab",
        level: 21,
        profile_url: "https://www.wanikani.com/users/Pozab",
        started_at: "2020-01-01T00:00:00.000Z",
        current_vacation_started_at: null,
        preferences: {
          default_voice_actor_id: 1,
          lessons_autoplay_audio: true,
          lessons_batch_size: 5,
          lessons_presentation_order: "ascending_level_then_subject",
          reviews_autoplay_audio: true,
          reviews_display_srs_indicator: true,
        },
        subscription: { active: true, type: "lifetime", max_level_granted: 60, period_ends_at: null },
      },
    };

    const { container } = render(<AppShell><p>Dashboard content</p></AppShell>);

    expect(screen.getByRole("link", { name: "Kakehashi home for Pozab" })).toBeInTheDocument();
    expect(container.querySelector('header img[src*="kakehashi-mark.png"]')).toBeInTheDocument();
  });
});
