import React from "react";
import { Text } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import { MediaContextSource } from "../MediaContextSource";

let mockUsername = "Portego";
let mockEnabled = false;
jest.mock("../../utils/store", () => ({
  useAuthStore: () => ({ userData: { username: mockUsername } }),
  useSettingsStore: () => ({ showYouGlishContext: mockEnabled }),
}));
jest.mock("../../utils/theme", () => ({ useTheme: () => ({ theme: { primary: "purple", textColor: "black", textSecondary: "gray", border: "gray" } }) }));
jest.mock("../YouGlishContextPlayer", () => ({
  __esModule: true,
  default: ({ query }: { query: string }) => {
    const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
    return <Text testID="youglish-player">{query}</Text>;
  },
}));

beforeEach(() => { mockUsername = "Portego"; mockEnabled = false; });

it.each(["Portego", "AnotherUser"])("keeps the existing context unchanged when disabled for %s", (username) => {
  mockUsername = username;
  const screen = render(<MediaContextSource query="家族"><Text>Anime examples</Text></MediaContextSource>);
  expect(screen.getByText("Anime examples")).toBeTruthy();
  expect(screen.queryByRole("tab", { name: "YouGlish" })).toBeNull();
  expect(screen.queryByTestId("youglish-player")).toBeNull();
});

it("does not expose a saved enabled setting to another account", () => {
  mockEnabled = true; mockUsername = "AnotherUser";
  const screen = render(<MediaContextSource query="家族"><Text>Anime examples</Text></MediaContextSource>);
  expect(screen.queryByRole("tab", { name: "YouGlish" })).toBeNull();
});

it("loads the current word only after selecting YouGlish and unmounts it when leaving Context", async () => {
  mockEnabled = true;
  const stopAudio = jest.fn();
  const view = (query: string, active = true) => <MediaContextSource query={query} active={active} onYouGlishSelect={stopAudio}><Text>Anime examples</Text></MediaContextSource>;
  const screen = render(view("家族"));
  expect(screen.queryByTestId("youglish-player")).toBeNull();
  fireEvent.press(screen.getByRole("tab", { name: "YouGlish" }));
  expect((await screen.findByTestId("youglish-player")).props.children).toBe("家族");
  expect(stopAudio).toHaveBeenCalled();
  expect(screen.queryByText("Anime examples")).toBeNull();
  screen.rerender(view("友だち"));
  expect((await screen.findByTestId("youglish-player")).props.children).toBe("友だち");
  screen.rerender(view("友だち", false));
  expect(screen.queryByTestId("youglish-player")).toBeNull();
  screen.rerender(view("友だち"));
  fireEvent.press(screen.getByRole("tab", { name: "ImmersionKit" }));
  expect(screen.getByText("Anime examples")).toBeTruthy();
  expect(screen.queryByTestId("youglish-player")).toBeNull();
});

it("falls back immediately if the setting is turned off while YouGlish is selected", async () => {
  mockEnabled = true;
  const view = <MediaContextSource query="家族"><Text>Anime examples</Text></MediaContextSource>;
  const screen = render(view);
  fireEvent.press(screen.getByRole("tab", { name: "YouGlish" }));
  await screen.findByTestId("youglish-player");
  mockEnabled = false;
  screen.rerender(<MediaContextSource query="家族"><Text>Anime examples</Text></MediaContextSource>);
  expect(screen.queryByTestId("youglish-player")).toBeNull();
  expect(screen.getByText("Anime examples")).toBeTruthy();
});
