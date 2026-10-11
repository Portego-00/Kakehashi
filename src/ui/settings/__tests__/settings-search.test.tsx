import React from "react";
import { act, render } from "@testing-library/react-native";
import {
  SettingsLabel,
  SettingsSearchRegistryContext,
  SettingsSearchSection,
  settingsSearchMatches,
  type SettingsSearchEntry,
} from "../settings-search";
import { SettingsFoldout } from "../settings-foldout";

jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native");
  const builder = {
    duration: () => builder,
    easingX: () => builder,
    easingY: () => builder,
    easingWidth: () => builder,
    easingHeight: () => builder,
    reduceMotion: () => builder,
  };
  return {
    __esModule: true,
    default: { View },
    CurvedTransition: builder,
    Easing: { bezier: jest.fn() },
    ReduceMotion: { System: "system" },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withTiming: (value: number) => value,
  };
});

const theme = {
  primary: "#326ac0",
  textColor: "#222",
  textSecondary: "#666",
  border: "#ddd",
};
const section = { key: "reviews", label: "Reviews" };

function harness() {
  const entries = new Map<string, SettingsSearchEntry>();
  const register = (entry: SettingsSearchEntry) => {
    entries.set(entry.id, entry);
    return () => {
      entries.delete(entry.id);
    };
  };
  function Screen({ conditional = true }: { conditional?: boolean }) {
    return (
      <SettingsSearchRegistryContext.Provider value={register}>
        <SettingsSearchSection section={section}>
          <SettingsFoldout
            title="Prompt & display"
            description="Review text"
            theme={theme}
          >
            <SettingsFoldout
              title="Font details"
              description="Practice"
              theme={theme}
            >
              <SettingsLabel>Review input font size</SettingsLabel>
            </SettingsFoldout>
            {conditional ? (
              <SettingsLabel>Show item level</SettingsLabel>
            ) : null}
          </SettingsFoldout>
        </SettingsSearchSection>
      </SettingsSearchRegistryContext.Provider>
    );
  }
  return { entries, Screen };
}

it("finds a setting inside collapsed groups and opens all its ancestors", () => {
  const { entries, Screen } = harness();
  const screen = render(<Screen />);
  expect(screen.queryByText("Review input font size")).toBeNull();
  const matches = settingsSearchMatches([...entries.values()], "input font");
  expect(matches.map((entry) => entry.label)).toEqual([
    "Review input font size",
  ]);
  act(() => matches[0].reveal());
  expect(screen.getByText("Review input font size")).toBeTruthy();
  expect(
    screen.getByLabelText("Prompt & display").props.accessibilityState.expanded,
  ).toBe(true);
  expect(
    screen.getByLabelText("Font details").props.accessibilityState.expanded,
  ).toBe(true);
});

it("removes settings from search when their availability condition changes", () => {
  const { entries, Screen } = harness();
  const screen = render(<Screen conditional />);
  expect(
    settingsSearchMatches([...entries.values()], "item level"),
  ).toHaveLength(1);
  screen.rerender(<Screen conditional={false} />);
  expect(
    settingsSearchMatches([...entries.values()], "item level"),
  ).toHaveLength(0);
});

it("matches all search words across the label and its original section", () => {
  const { entries, Screen } = harness();
  render(<Screen />);
  expect(
    settingsSearchMatches([...entries.values()], "reviews input").map(
      (entry) => entry.label,
    ),
  ).toEqual(["Review input font size"]);
  expect(settingsSearchMatches([...entries.values()], "")).toEqual([]);
});
