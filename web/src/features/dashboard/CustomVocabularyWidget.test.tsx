import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCustomSrsState, enrollCustomVocabularyPack } from "@/features/custom-srs/model";
import type { CustomSrsState, CustomVocabularyPack } from "@/features/custom-srs/types";
import { loadWebSettings } from "@/features/settings/settings";
import { CustomVocabularyWidget } from "./CustomVocabularyWidget";

const { widgetTestState } = vi.hoisted(() => ({
  widgetTestState: {
    hook: {} as Record<string, unknown>,
    refresh: vi.fn(),
  },
}));

vi.mock("@/features/custom-srs/catalog", () => {
  const word = (id: string, characters: string) => ({
    id,
    characters,
    reading: characters,
    meanings: [id],
    partsOfSpeech: ["noun"],
    meaningMnemonic: "Meaning mnemonic.",
    readingMnemonic: "Reading mnemonic.",
    contextSentences: [{ ja: characters, en: id }],
  });
  return {
    CUSTOM_VOCABULARY_PACKS: [{
      id: "daily-kana",
      title: "Daily Kana",
      description: "Common kana words.",
      script: "mixed",
      words: [
        word("daily-kana:lesson", "もしもし"),
        word("daily-kana:due", "メモ"),
        word("daily-kana:future", "よろしく"),
        word("daily-kana:later", "バイト"),
      ],
    }] satisfies CustomVocabularyPack[],
  };
});

vi.mock("@/features/custom-srs/use-custom-srs", () => ({
  useCustomSrs: () => widgetTestState.hook,
}));

const PACK = {
  id: "daily-kana",
  title: "Daily Kana",
  description: "Common kana words.",
  script: "mixed",
  words: [
    { id: "daily-kana:lesson", characters: "もしもし" },
    { id: "daily-kana:due", characters: "メモ" },
    { id: "daily-kana:future", characters: "よろしく" },
    { id: "daily-kana:later", characters: "バイト" },
  ],
} as CustomVocabularyPack;

function setHookState(state: CustomSrsState, overrides: Record<string, unknown> = {}) {
  widgetTestState.hook = {
    state,
    storageMode: "cloud",
    isLoading: false,
    isRefreshing: false,
    isUnavailable: false,
    refresh: widgetTestState.refresh,
    ...overrides,
  };
}

function enrolledState(reviewAvailableAt = "2026-08-31T11:00:00.000Z") {
  const state = enrollCustomVocabularyPack(createCustomSrsState(new Date("2026-08-31T09:00:00.000Z")), PACK, new Date("2026-08-31T09:00:00.000Z"));
  state.assignments["daily-kana:due"] = { ...state.assignments["daily-kana:due"], stage: 1, startedAt: "2026-08-31T09:00:00.000Z", availableAt: reviewAvailableAt };
  state.assignments["daily-kana:future"] = { ...state.assignments["daily-kana:future"], stage: 1, startedAt: "2026-08-31T09:00:00.000Z", availableAt: "2026-08-31T13:00:00.000Z" };
  state.assignments["daily-kana:later"] = { ...state.assignments["daily-kana:later"], stage: 1, startedAt: "2026-08-31T09:00:00.000Z", availableAt: "2026-09-01T04:00:00.000Z" };
  return state;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-31T12:00:00.000Z"));
  widgetTestState.refresh.mockReset().mockResolvedValue({});
  setHookState(enrolledState());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("custom vocabulary dashboard widget", () => {
  it("puts lessons, due reviews, and pack exploration in one live widget", () => {
    render(<CustomVocabularyWidget scope={42} />);

    expect(screen.getByRole("heading", { name: "Custom vocabulary" })).toBeInTheDocument();
    expect(screen.getByText("Cloud progress")).toBeInTheDocument();

    const lessons = screen.getByText("Lessons").closest("div")?.parentElement;
    const reviews = screen.getByText("Reviews due").closest("div")?.parentElement;
    const packs = screen.getByText("Packs").closest("div")?.parentElement;
    expect(lessons).not.toBeNull();
    expect(reviews).not.toBeNull();
    expect(packs).not.toBeNull();
    expect(within(lessons!).getByText("1", { selector: "strong" })).toBeInTheDocument();
    expect(within(reviews!).getByText("1", { selector: "strong" })).toBeInTheDocument();
    expect(within(packs!).getByText("1", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start lessons" })).toHaveAttribute("href", "/custom-vocabulary/lessons");
    expect(screen.getByRole("link", { name: "Review now" })).toHaveAttribute("href", "/custom-vocabulary/reviews");
    expect(screen.getByRole("link", { name: "Explore packs" })).toHaveAttribute("href", "/custom-vocabulary");

    const forecast = screen.getByRole("list", { name: "Hourly review forecast" });
    expect(screen.getByRole("heading", { name: "Upcoming reviews" })).toBeInTheDocument();
    expect(within(forecast).getAllByRole("listitem")).toHaveLength(24);
    expect(within(forecast).getByRole("listitem", { name: "Now: 1 total reviews, 0 new reviews" })).toHaveTextContent("1Now");
    expect(within(forecast).getByRole("listitem", { name: /3 total reviews, 1 new reviews/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Daily" }));
    expect(within(screen.getByRole("list", { name: "Daily review forecast" })).getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getByRole("listitem", { name: "Tomorrow: 3 total reviews, 1 new reviews" })).toBeInTheDocument();
  });

  it("remembers the chart range, list view, and breakdown for the signed-in account", () => {
    const { unmount } = render(<CustomVocabularyWidget scope={42} username="tester" />);
    fireEvent.click(screen.getByRole("button", { name: "Daily" }));
    fireEvent.click(screen.getByRole("button", { name: "List view" }));
    fireEvent.click(screen.getByRole("button", { name: "Breakdown: Off" }));
    fireEvent.click(screen.getByRole("button", { name: "Breakdown: Type" }));

    expect(screen.getByRole("button", { name: "Breakdown: SRS" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Today hourly reviews" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Tomorrow: 1 new reviews, 3 total reviews" })).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Tomorrow: 1 new reviews, 3 total reviews" }));
    expect(screen.getByRole("list", { name: "Tomorrow hourly reviews" })).toBeVisible();
    expect(loadWebSettings(window.localStorage, "tester").workspace).toMatchObject({ forecastViewMode: "list", forecastChartMode: "daily", forecastBreakdown: "srs" });
    expect(loadWebSettings(window.localStorage, "other-account").workspace.forecastViewMode).toBe("chart");
    unmount();

    render(<CustomVocabularyWidget scope={42} username="tester" />);
    expect(screen.getByRole("button", { name: "List view" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Breakdown: SRS" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Chart view" }));
    expect(screen.getByRole("button", { name: "Daily" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps exploration available when the study queues are empty", () => {
    setHookState(createCustomSrsState(), { storageMode: "browser" });
    render(<CustomVocabularyWidget scope="anonymous" />);

    expect(screen.getByText("Browser progress")).toBeInTheDocument();
    expect(screen.getByText("No lessons ready")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Nothing due")).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("link", { name: "Start lessons" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Review now" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore packs" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Hourly review forecast" })).toHaveTextContent("Now");
    expect(screen.getByRole("listitem", { name: "Now: 0 total reviews, 0 new reviews" })).toBeInTheDocument();
  });

  it("exposes a retry while cloud progress is unavailable", () => {
    setHookState(createCustomSrsState(), { isUnavailable: true });
    render(<CustomVocabularyWidget scope={42} />);

    expect(screen.getByText("Progress unavailable")).toBeInTheDocument();
    expect(screen.getByText("Custom progress could not be reached.")).toBeInTheDocument();
    expect(screen.getAllByText("—", { selector: "strong" })).toHaveLength(3);
    expect(screen.queryByRole("list", { name: "Hourly review forecast" })).not.toBeInTheDocument();
    expect(screen.getByText("Custom review schedule is unavailable.")).toBeInTheDocument();
    screen.getByRole("button", { name: "Try again" }).click();
    expect(widgetTestState.refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Explore packs" })).toBeInTheDocument();
  });

  it("makes a newly due review available on the next minute tick", () => {
    setHookState(enrolledState("2026-08-31T12:00:30.000Z"));
    render(<CustomVocabularyWidget scope={42} />);

    expect(screen.getByText("Nothing due")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole("link", { name: "Review now" })).toBeInTheDocument();
  });
});
