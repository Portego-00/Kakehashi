import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import BunproAnalytics from "../BunproAnalytics";
import type { BunproAnalyticsData } from "../../../utils/bunproAnalytics";

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockData: BunproAnalyticsData = {
  facts: { days_studied: 14, streak: 3, weekly_streak: [{ day: "2026-09-22", val: true }], grammar_studied: 35, vocab_studied: 14 },
  due: { total_due_grammar: 4, total_due_vocab: 8 },
  srs: null, jlpt: null, reviewTotals: null, heatmap: null, cram: null,
  activity: { grammar: {}, vocab: {} }, forecast: { grammar: { later: 2, tomorrow: 4 }, vocab: { later: 3, tomorrow: 7 } }, unavailable: [],
};
const mockDashboard = { analytics: mockData as BunproAnalyticsData | null, status: "ready", refreshing: false, error: null as string | null, refresh: mockRefresh };
jest.mock("../../../hooks/useBunproDashboard", () => ({ useBunproDashboard: () => mockDashboard }));
jest.mock("expo-router", () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock("../../../utils/nativeTabs", () => ({ supportsNativeTabs: () => false }));
jest.mock("../../../utils/theme", () => ({ useTheme: () => ({ theme: { cardBackground: "#fff", border: "#eee", textColor: "#222", textSecondary: "#555" } }) }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Icon" }));

describe("mobile Bunpro analytics", () => {
  beforeEach(() => { jest.clearAllMocks(); mockDashboard.analytics = mockData; mockDashboard.status = "ready"; mockDashboard.error = null; });
  it("switches study tracks without mixing counts and keeps the true study streak", () => {
    const screen = render(<BunproAnalytics />);
    expect(screen.getByLabelText("Review 4 Bunpro grammar items")).toBeTruthy();
    expect(screen.getByLabelText("Review 8 Bunpro vocabulary items")).toBeTruthy();
    expect(screen.getByText("Tue")).toBeTruthy();
    fireEvent.press(screen.getAllByText("Vocabulary")[0]);
    expect(screen.queryByLabelText("Review 4 Bunpro grammar items")).toBeNull();
    fireEvent.press(screen.getByLabelText("Review 8 Bunpro vocabulary items"));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/bunpro-reviews", params: { mode: "vocab" } });
    expect(screen.getByText("14 days studied in total")).toBeTruthy();
  });
  it("includes relative forecasts while hiding empty activity charts", () => {
    const screen = render(<BunproAnalytics />);
    expect(screen.getByText("Later today")).toBeTruthy();
    expect(screen.getByText("Tomorrow")).toBeTruthy();
    expect(screen.queryByText("Review activity")).toBeNull();
    fireEvent.press(screen.getByText("Show chart data"));
    expect(screen.getByText("Grammar 2 · Vocabulary 3")).toBeTruthy();
  });
  it("provides clear loading, missing-connection, and retry states", () => {
    mockDashboard.analytics = null;
    mockDashboard.status = "loading";
    const screen = render(<BunproAnalytics />);
    expect(screen.getByText("Loading Bunpro analytics…")).toBeTruthy();
    mockDashboard.status = "unconfigured";
    screen.rerender(<BunproAnalytics />);
    fireEvent.press(screen.getByText("Bunpro settings"));
    expect(mockPush).toHaveBeenCalledWith("/(app)/(bunpro-tabs)");
    mockDashboard.status = "error";
    mockDashboard.error = "Bunpro could not be refreshed.";
    screen.rerender(<BunproAnalytics />);
    fireEvent.press(screen.getByText("Try again"));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
