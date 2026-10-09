import AsyncStorage from "@react-native-async-storage/async-storage";
import { requireOptionalNativeModule } from "expo-modules-core";
import {
  getHomeWidgetScheduledUpdatesDebug,
  resetHomeWidgetSnapshot,
  syncHomeWidgetFromBackgroundReviewData,
  updateHomeWidgetDisplayPreferences,
  updateHomeWidgetSnapshot,
  type HomeWidgetProps,
  type HomeWidgetSnapshotInput,
} from "../homeWidget";
import { requestPinHomeWidget } from "../homeWidgetController.android";

jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  Object.defineProperty(actual.Platform, "OS", { get: () => "android" });
  return actual;
});
jest.mock("expo-modules-core", () => {
  const actual = jest.requireActual("expo-modules-core");
  return { ...actual, requireOptionalNativeModule: jest.fn((name) => name === "KakehashiHomeWidget" ? {
    updateSnapshot: jest.fn(), updateTimeline: jest.fn(), reload: jest.fn(),
    getTimeline: jest.fn(async () => "[]"), requestPin: jest.fn(async () => true),
  } : actual.requireOptionalNativeModule(name)) };
});
jest.mock("../homeWidgetController", () => jest.requireActual("../homeWidgetController.android"));
jest.mock("@expo/ui/swift-ui", () => { throw new Error("Android must never evaluate SwiftUI"); });
jest.mock("expo-widgets", () => { throw new Error("Android must never evaluate Expo's iOS widget runtime"); });
jest.mock("expo-file-system", () => ({ Paths: { appleSharedContainers: {} } }));

const native = jest.mocked(requireOptionalNativeModule).mock.results[
  jest.mocked(requireOptionalNativeModule).mock.calls.findIndex(([name]) => name === "KakehashiHomeWidget")
].value;
const snapshot = (): HomeWidgetProps => JSON.parse(native.updateSnapshot.mock.calls.at(-1)[0]);
const input: HomeWidgetSnapshotInput = {
  contentMode: "reviews", streakGradientPreset: "defaults", reviewCount: 84,
  nextReviewDate: null, todayReviewTotal: 84, reviewUpcomingBuckets: [],
  criticalCount: 12, topCriticalItem: { characters: "橋", meaning: "bridge", reading: "はし", percentage: 20 },
  currentStreak: 84, longestStreak: 126, recentMistakesCount: 0,
  freezeAvailable: true, freezeDaysUntilReload: 0, streakRecentDays: [
    { label: "T", active: true, isToday: false },
    { label: "F", active: true, isToday: true },
  ],
};

beforeEach(() => { jest.clearAllMocks(); });
afterEach(() => { jest.useRealTimers(); });

test("all three modes and every palette reach Android without evaluating iOS modules", async () => {
  for (const contentMode of ["reviews", "critical", "streak"] as const) {
    for (const streakGradientPreset of ["automatic", "defaults", "sunset", "ocean", "emerald", "violet", "rose", "amber", "aurora", "slate", "skyline", "obsidian", "graphite", "midnightBloom"] as const) {
      await updateHomeWidgetSnapshot({ ...input, contentMode, streakGradientPreset });
      expect(snapshot().contentMode).toBe(contentMode);
      expect(snapshot().streakGradientColors).toHaveLength(3);
      const entries = JSON.parse(native.updateTimeline.mock.calls.at(-1)[0]);
      expect(entries.length).toBeGreaterThanOrEqual(8);
      expect(entries.every((entry: { timestamp: number }) => Number.isFinite(entry.timestamp))).toBe(true);
      expect(snapshot().criticalItems[0].characters).toBe("橋");
    }
  }
});

test("preference changes update both the visible widget and its future timeline", async () => {
  await updateHomeWidgetSnapshot(input);
  updateHomeWidgetDisplayPreferences({ contentMode: "streak", streakGradientPreset: "ocean" });
  expect(snapshot().contentMode).toBe("streak");
  expect(snapshot().streakGradientColors).toEqual(["#0EA5E9", "#2563EB", "#4338CA"]);
  expect(JSON.parse(native.updateTimeline.mock.calls.at(-1)[0])[0].props.streakGradientColors)
    .toEqual(snapshot().streakGradientColors);
});

test("upcoming reviews and automatic light/dark colors advance with the app closed", async () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 9, 9, 10));
  await updateHomeWidgetSnapshot({ ...input, streakGradientPreset: "automatic",
    reviewUpcomingBuckets: [{ date: new Date(2026, 9, 9, 11).toISOString(), count: 16 }],
  });
  let entries = JSON.parse(native.updateTimeline.mock.calls.at(-1)[0]);
  expect(entries.find((entry: { timestamp: number }) => entry.timestamp === new Date(2026, 9, 9, 11).getTime()).props.reviewsCountValue).toBe(100);
  expect(entries.find((entry: { timestamp: number }) => entry.timestamp === new Date(2026, 9, 9, 12).getTime()).props.streakGradientColors)
    .toEqual(["#7DD3FC", "#38BDF8", "#60A5FA"]);
  await updateHomeWidgetSnapshot({ ...input, streakGradientPreset: "automatic", isDarkTheme: true });
  entries = JSON.parse(native.updateTimeline.mock.calls.at(-1)[0]);
  expect(entries[0].props.streakGradientColors).toEqual(["#334155", "#1E293B", "#0F172A"]);
});

test("background review synchronization preserves the critical list and chosen colors", async () => {
  await updateHomeWidgetSnapshot({ ...input, contentMode: "critical", streakGradientPreset: "violet" });
  await syncHomeWidgetFromBackgroundReviewData({ currentReviews: 19, upcomingReviews: [] });
  expect(snapshot().reviewsCountValue).toBe(19);
  expect(snapshot().contentMode).toBe("critical");
  expect(snapshot().criticalItems[0].meaning).toBe("bridge");
  expect(snapshot().streakGradientColors).toEqual(["#A855F7", "#7C3AED", "#4C1D95"]);
});

test("native timelines round trip to the debug screen and Android can request a pin", async () => {
  await updateHomeWidgetSnapshot(input);
  native.getTimeline.mockResolvedValueOnce(native.updateTimeline.mock.calls.at(-1)[0]);
  expect((await getHomeWidgetScheduledUpdatesDebug()).source).toBe("nativeTimeline");
  expect(await requestPinHomeWidget()).toBe(true);
});

test("color and content changes restore saved data when settings open before the dashboard", async () => {
  resetHomeWidgetSnapshot();
  jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(JSON.stringify(input));
  await updateHomeWidgetDisplayPreferences({ contentMode: "streak", streakGradientPreset: "ocean" });
  expect(snapshot().reviewsCountValue).toBe(84);
  expect(snapshot().contentMode).toBe("streak");
  expect(snapshot().streakGradientColors).toEqual(["#0EA5E9", "#2563EB", "#4338CA"]);
});

test("sign out clears stored input and scheduled snapshots", async () => {
  await updateHomeWidgetSnapshot(input);
  resetHomeWidgetSnapshot();
  expect(snapshot().reviewsCountValue).toBe(0);
  expect(snapshot().criticalItems).toEqual([]);
  expect(JSON.parse(native.updateTimeline.mock.calls.at(-1)[0])).toHaveLength(1);
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith("kakehashi-last-widget-snapshot-input");
});
