import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createWidget } from "expo-widgets";
import type { WidgetStreakGradientPreset } from "../../utils/store";
import {
  updateHomeWidgetSnapshot,
  updateHomeWidgetDisplayPreferences,
  syncHomeWidgetFromBackgroundReviewData,
  resetHomeWidgetSnapshot,
  type HomeWidgetSnapshotInput,
} from "../homeWidget";

jest.mock("@expo/ui/swift-ui", () => ({}));
jest.mock("@expo/ui/swift-ui/modifiers", () => ({}));
jest.mock("expo-file-system", () => ({ Paths: { appleSharedContainers: {} } }));
jest.mock("expo-widgets", () => ({
  createWidget: jest.fn(() => ({
    updateSnapshot: jest.fn(), updateTimeline: jest.fn(), reload: jest.fn(), getTimeline: jest.fn(),
  })),
}));

const widget = jest.mocked(createWidget).mock.results[0].value;
const layout = jest.mocked(createWidget).mock.calls[0][1];
const context = createContext({});
runInContext(readFileSync(require.resolve("expo-widgets/bundle/build/ExpoWidgets.bundle"), "utf8"), context);
runInContext(`globalThis.__expoWidgetLayout = ${layout}`, context);

const items = [
  { characters: "橋", reading: "はし", meaning: "bridge", percentage: 20 },
  { characters: "川", reading: "かわ", meaning: "river", percentage: 30 },
  { characters: "山", reading: "やま", meaning: "mountain", percentage: 40 },
];
const input: HomeWidgetSnapshotInput = {
  contentMode: "critical", streakGradientPreset: "defaults",
  reviewCount: 4, nextReviewDate: null, todayReviewTotal: 4, reviewUpcomingBuckets: [],
  criticalCount: 12, criticalItems: items, topCriticalItem: items[0], recentMistakesCount: 0,
  currentStreak: 1, longestStreak: 2, freezeAvailable: true, freezeDaysUntilReload: 0,
  streakRecentDays: [],
};
function render(family: string, props = widget.updateSnapshot.mock.calls.at(-1)[0], mode = "fullColor", colorScheme = "light") {
  return JSON.stringify(context.__expoWidgetRender(props, {
    widgetFamily: family, widgetRenderingMode: mode, colorScheme,
  }));
}

beforeEach(() => { jest.clearAllMocks(); });
afterEach(() => { jest.useRealTimers(); });

type RenderNode = {
  type: string;
  props: {
    children?: (RenderNode | null)[];
    modifiers?: {
      $type: string;
      styleType?: string;
      hierarchicalStyle?: string;
      colors?: string[];
      color?: string;
      value?: number;
    }[];
  };
};
function nodes(node: RenderNode | null): RenderNode[] {
  if (!node) return [];
  return [node, ...(node.props.children ?? []).flatMap(nodes)];
}
function luminance(rgb: number[]) {
  return rgb.reduce((total, value, index) => {
    const c = value / 255;
    return total + (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
      * [0.2126, 0.7152, 0.0722][index];
  }, 0);
}
function assertReadable(rendered: string, expectedColors: string[]) {
  const tree = nodes(JSON.parse(rendered));
  const gradient = tree.flatMap((node) => node.props.modifiers ?? [])
    .find((modifier) => modifier.styleType === "linearGradient");
  expect(gradient?.colors).toEqual(expectedColors);
  const overlay = tree.find((node) => node.type === "RoundedRectangleView" &&
    node.props.modifiers?.some((modifier) => modifier.$type === "opacity"));
  const alpha = overlay?.props.modifiers?.find((modifier) => modifier.$type === "opacity")?.value ?? 0;
  if (overlay) expect(overlay.props.modifiers).toContainEqual(expect.objectContaining({ color: "#000000" }));
  const textNodes = tree.filter((node) => node.type === "TextView");
  expect(textNodes.length).toBeGreaterThan(0);
  const colors = expectedColors.map((hex) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)));
  for (const text of textNodes) {
    const foreground = text.props.modifiers?.find((modifier) => modifier.$type === "foregroundStyle");
    expect(["#000000", "#FFFFFF"]).toContain(foreground?.color);
    const textLuminance = foreground?.color === "#000000" ? 0 : 1;
    for (let stop = 1; stop < colors.length; stop++) {
      for (let step = 0; step <= 10; step++) {
        const rgb = colors[stop - 1].map((value, channel) => value + (colors[stop][channel] - value) * step / 10);
        // Check both linear-light and sRGB compositing across the gradient.
        for (const backgroundLuminance of [luminance(rgb) * (1 - alpha), luminance(rgb.map((value) => value * (1 - alpha)))]) {
          const contrast = (Math.max(textLuminance, backgroundLuminance) + 0.05) /
            (Math.min(textLuminance, backgroundLuminance) + 0.05);
          expect(contrast).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  }
}

const presets: WidgetStreakGradientPreset[] = [
  "defaults", "sunset", "ocean", "emerald", "violet", "rose", "amber",
  "aurora", "slate", "skyline", "obsidian", "graphite", "midnightBloom",
];

describe("serialized critical widget", () => {
  it("uses the selected background preset in both sizes", async () => {
    await updateHomeWidgetSnapshot(input);
    updateHomeWidgetDisplayPreferences({ streakGradientPreset: "ocean" });
    for (const family of ["systemSmall", "systemMedium"]) {
      const rendered = render(family);
      expect(rendered).toContain('"styleType":"linearGradient"');
      expect(rendered).toContain('"colors":["#0EA5E9","#2563EB","#4338CA"]');
    }
  });

  it("keeps text readable even on all-white, all-black, and mixed extreme backgrounds", async () => {
    await updateHomeWidgetSnapshot(input);
    const props = widget.updateSnapshot.mock.calls.at(-1)[0];
    for (const colors of [["#FFFFFF", "#FFFFFF"], ["#000000", "#000000"], ["#FFFFFF", "#000000"]]) {
      for (const family of ["systemSmall", "systemMedium"]) {
        assertReadable(render(family, { ...props, streakGradientColors: colors }), colors);
      }
    }
  });

  it("uses adaptive text when the system removes the widget background", async () => {
    await updateHomeWidgetSnapshot(input);
    const props = widget.updateSnapshot.mock.calls.at(-1)[0];
    for (const family of ["systemSmall", "systemMedium"]) {
      const tree = nodes(context.__expoWidgetRender(props, {
        widgetFamily: family, colorScheme: "dark", showsContainerBackground: false,
      }));
      expect(tree.some((node) => node.type === "RoundedRectangleView")).toBe(false);
      for (const node of tree.filter((node) => node.type === "TextView")) {
        expect(node.props.modifiers).toContainEqual(expect.objectContaining({
          styleType: "hierarchical", hierarchicalStyle: "primary",
        }));
      }
    }
  });

  it.each(presets)("keeps every label readable on the %s preset", async (preset) => {
    await updateHomeWidgetSnapshot({ ...input, streakGradientPreset: preset });
    const props = widget.updateSnapshot.mock.calls.at(-1)[0];
    for (const family of ["systemSmall", "systemMedium"]) {
      for (const scheme of ["light", "dark"]) {
        for (const criticalItems of [items, []]) {
          assertReadable(render(family, { ...props, criticalItems }, "fullColor", scheme), props.streakGradientColors);
        }
      }
    }
  });

  it.each([8, 14, 21])("updates automatic backgrounds and contrast at hour %i", async (hour) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 22, hour));
    for (const isDarkTheme of [false, true]) {
      await updateHomeWidgetSnapshot({ ...input, streakGradientPreset: "automatic", isDarkTheme });
      // Inspect scheduled transitions too, so text remains readable without opening the app.
      for (const entry of widget.updateTimeline.mock.calls.at(-1)[0]) {
        for (const family of ["systemSmall", "systemMedium"]) {
          assertReadable(render(family, entry.props), entry.props.streakGradientColors);
        }
      }
    }
  });

  it("renders one item in small and three in medium through Expo's actual widget runtime", async () => {
    expect(typeof layout).toBe("string");
    await updateHomeWidgetSnapshot(input);
    const small = render("systemSmall");
    expect(small).toContain("bridge");
    expect(small).toContain("はし");
    expect(small).toContain("20% correct");
    expect(small).not.toContain("river");
    const medium = render("systemMedium");
    for (const item of items) expect(medium).toContain(item.meaning);
    expect(medium).toContain("12 critical items");
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "kakehashi-last-widget-snapshot-input",
      expect.stringContaining('"criticalItems"'),
    );
  });

  it("preserves critical items in scheduled and background updates", async () => {
    await updateHomeWidgetSnapshot(input);
    for (const entry of widget.updateTimeline.mock.calls.at(-1)[0]) {
      expect(entry.props.criticalItems).toEqual(items);
    }
    await syncHomeWidgetFromBackgroundReviewData({ currentReviews: 9 });
    expect(widget.updateSnapshot.mock.calls.at(-1)[0]).toMatchObject({
      criticalCount: 12, criticalItems: items, reviewsCountValue: 9,
    });
  });

  it("renders empty states for both sizes and clears old content", async () => {
    await updateHomeWidgetSnapshot(input);
    await updateHomeWidgetSnapshot({ ...input, criticalCount: 0, criticalItems: [], topCriticalItem: null });
    for (const family of ["systemSmall", "systemMedium"]) {
      expect(render(family)).toContain("No critical items");
      expect(render(family)).toContain("No items below 90% accuracy.");
      expect(render(family)).not.toContain("bridge");
    }
    resetHomeWidgetSnapshot();
    expect(widget.updateSnapshot.mock.calls.at(-1)[0].criticalItems).toEqual([]);
  });

  it("renders old snapshots, image-only radicals, and long vocabulary without runtime errors", async () => {
    await updateHomeWidgetSnapshot({ ...input, criticalItems: undefined });
    expect(render("systemMedium")).toContain("bridge");
    await updateHomeWidgetSnapshot({ ...input, criticalItems: [
      { characters: null, meaning: "gun", percentage: 10 },
      { characters: "お誕生日おめでとうございます", meaning: "happy birthday", percentage: 20 },
    ] });
    expect(render("systemSmall")).toContain("Radical");
    expect(render("systemMedium")).toContain("happy birthday");
  });

  it("supports light, dark, and tinted rendering without a forced tinted background", async () => {
    await updateHomeWidgetSnapshot(input);
    for (const mode of ["accented", "vibrant"]) {
      for (const family of ["systemSmall", "systemMedium"]) {
        const rendered = render(family, undefined, mode);
        expect(rendered).toContain("bridge");
        expect(rendered).not.toContain("RoundedRectangleView");
        for (const node of nodes(JSON.parse(rendered)).filter((node) => node.type === "TextView")) {
          expect(node.props.modifiers).toContainEqual(expect.objectContaining({
            styleType: "hierarchical", hierarchicalStyle: "primary",
          }));
        }
      }
    }
  });

  it("keeps the lock screen showing reviews even in critical mode", async () => {
    await updateHomeWidgetSnapshot(input);
    for (const family of ["accessoryInline", "accessoryCircular", "accessoryRectangular"]) {
      expect(render(family)).not.toContain("bridge");
      expect(render(family)).toContain("4");
    }
  });
});
