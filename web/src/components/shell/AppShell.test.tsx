import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WKUser } from "@/types/wanikani";
import { AppShell, backTargetForPathname } from "./AppShell";

const mocks = vi.hoisted(() => ({
  assignments: [
    { data: { subject_type: "kanji", srs_stage: 5 } },
    { data: { subject_type: "kanji", srs_stage: 9 } },
    { data: { subject_type: "kanji", srs_stage: 4 } },
    { data: { subject_type: "vocabulary", srs_stage: 9 } },
  ],
  back: vi.fn(),
  pathname: "/dashboard",
  push: vi.fn(),
  refresh: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  replace: vi.fn(),
  gravatarEmail: "",
  visibleNav: ["search"],
  session: {
    status: "loading" as "loading" | "authenticated" | "anonymous" | "unavailable",
    user: null as WKUser | null,
    error: "",
    signOut: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  },
}));

vi.mock("@tanstack/react-query", () => ({
  queryOptions: (options: unknown) => options,
  useQuery: (options: { select?: (assignments: typeof mocks.assignments) => unknown }) => ({
    data: options.select ? options.select(mocks.assignments) : mocks.assignments,
    isError: false,
    isLoading: false,
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ back: mocks.back, push: mocks.push, replace: mocks.replace }),
}));

vi.mock("@/lib/session", () => ({
  useSession: () => ({ ...mocks.session, refresh: mocks.refresh }),
}));

vi.mock("@/lib/theme", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}));

vi.mock("@/features/settings/use-workspace-preferences", () => ({
  useWebSettings: () => ({
    profile: { gravatarEmail: mocks.gravatarEmail },
    workspace: { visibleNav: mocks.visibleNav },
  }),
}));

vi.mock("@/features/settings/components/SettingsApplicator", () => ({
  SettingsApplicator: () => null,
}));

vi.mock("@/features/analytics/WebAnalyticsTracker", () => ({
  WebAnalyticsTracker: () => null,
}));

describe("AppShell session bootstrap", () => {
  beforeEach(() => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    mocks.pathname = "/dashboard";
    mocks.session.status = "loading";
    mocks.session.user = null;
    mocks.session.error = "";
    mocks.refresh.mockClear();
    mocks.back.mockClear();
    mocks.push.mockClear();
    mocks.replace.mockClear();
    mocks.gravatarEmail = "";
    mocks.visibleNav = ["search"];
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
    expect(screen.getByRole("link", { name: "Kakehashi home for Pozab" })).toHaveTextContent("Lvl 21");
    expect(screen.getByRole("link", { name: "Kakehashi home for Pozab" })).toHaveTextContent("2 Kanji");
    expect(screen.getByRole("link", { name: "Support Kakehashi on Patreon" })).toHaveAttribute("href", "https://www.patreon.com/15731284/join");
    expect(screen.getByRole("link", { name: "Support Kakehashi on Patreon" })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "Support Kakehashi on Patreon" })).toHaveAttribute("rel", "noopener noreferrer");
    const mainNavigation = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(mainNavigation).queryByRole("link", { name: "Search" })).not.toBeInTheDocument();
    const subjectSearch = screen.getByRole("link", { name: "Search subjects" });
    expect(subjectSearch).toHaveAttribute("href", "/search");
    expect(subjectSearch).not.toHaveTextContent("Search");
    expect(subjectSearch.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector('header img[src*="kakehashi-mark.png"]')).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("replaces the header mark with the saved Gravatar profile picture", () => {
    mocks.session.status = "authenticated";
    mocks.gravatarEmail = "MyEmailAddress@example.com";
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

    expect(container.querySelector('header img[src*="gravatar.com"]')).toHaveAttribute(
      "src",
      expect.stringContaining("0bc83cb571cd1c50ba6f3e8a78ef1346"),
    );
  });

  it("morphs the desktop app bar after the deliberate scroll threshold", async () => {
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
    const header = container.querySelector("header");
    expect(header).not.toHaveAttribute("data-floating");

    Object.defineProperty(window, "scrollY", { configurable: true, value: 120 });
    act(() => fireEvent.scroll(window));
    await waitFor(() => expect(header).toHaveAttribute("data-floating", "true"));
    expect(screen.getByRole("link", { name: "Kakehashi home for Pozab" })).toHaveTextContent("Pozab");
    expect(screen.getByRole("link", { name: "Kakehashi home for Pozab" })).toHaveTextContent("Lvl 21");
    expect(screen.getByRole("link", { name: "Kakehashi home for Pozab" })).toHaveTextContent("2 Kanji");

    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    act(() => fireEvent.scroll(window));
    await waitFor(() => expect(header).not.toHaveAttribute("data-floating"));
  });
});

describe("AppShell contextual back navigation", () => {
  beforeEach(() => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    mocks.pathname = "/dashboard";
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
    mocks.back.mockClear();
    mocks.push.mockClear();
    mocks.replace.mockClear();
  });

  it.each([
    ["/subjects/440", "/search"],
    ["/subjects/440/constellation", "/subjects/440"],
    ["/news/42", "/news"],
    ["/manga/42", "/manga"],
    ["/epubs/42", "/epubs"],
    ["/community/new", "/community"],
    ["/progress/kanji", "/progress"],
    ["/progress/wrapped/21", "/progress"],
    ["/study/random-test", "/study"],
  ])("maps %s to its logical parent", (pathname, parent) => {
    expect(backTargetForPathname(pathname)).toBe(parent);
  });

  it("animates in on a direct detail route and uses its logical parent fallback", () => {
    mocks.pathname = "/subjects/440";
    render(<AppShell><p>Subject detail</p></AppShell>);

    const backButton = screen.getByRole("button", { name: "Back" });
    expect(backButton).toHaveAttribute("data-visible", "true");
    fireEvent.click(backButton);

    expect(mocks.replace).toHaveBeenCalledWith("/search");
    expect(mocks.back).not.toHaveBeenCalled();
  });

  it("uses browser history after an in-app drill-down", async () => {
    mocks.pathname = "/search";
    const { rerender } = render(<AppShell><p>Search</p></AppShell>);
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();

    mocks.pathname = "/subjects/440";
    rerender(<AppShell><p>Subject detail</p></AppShell>);
    const backButton = await screen.findByRole("button", { name: "Back" });
    fireEvent.click(backButton);

    expect(mocks.back).toHaveBeenCalledTimes(1);
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
