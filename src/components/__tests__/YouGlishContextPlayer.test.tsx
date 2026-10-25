import React from "react";
import { AppState, type AppStateStatus } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import YouGlishContextPlayer from "../YouGlishContextPlayer";

let mockFocused = true;
jest.mock("@react-navigation/native", () => ({ useIsFocused: () => mockFocused }));
jest.mock("react-native-webview", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { __esModule: true, default: View };
});
jest.mock("../../utils/theme", () => ({ useTheme: () => ({ theme: { isDark: false, primary: "purple", textSecondary: "gray", cardBackground: "white" } }) }));

beforeEach(() => {
  mockFocused = true;
  jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove: jest.fn() });
});
afterEach(() => jest.restoreAllMocks());

it("uses the current Japanese word with playback requiring a user gesture", () => {
  const screen = render(<YouGlishContextPlayer query="家族" />);
  const player = screen.getByTestId("youglish-player");
  expect(player.props.source.html).toContain('"query":"家族"');
  expect(player.props.source.html).toContain("autoStart:0");
  expect(player.props.mediaPlaybackRequiresUserAction).toBe(true);
  screen.rerender(<YouGlishContextPlayer query="やっぱり" />);
  expect(screen.getByTestId("youglish-player").props.source.html).toContain('"query":"やっぱり"');
});

it("removes the player when unfocused or backgrounded and recreates it on return", () => {
  let onChange: ((state: AppStateStatus) => void) | undefined;
  const remove = jest.fn();
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, handler) => {
    onChange = handler;
    return { remove };
  });
  const screen = render(<YouGlishContextPlayer query="家族" />);
  mockFocused = false;
  screen.rerender(<YouGlishContextPlayer query="家族" />);
  expect(screen.queryByTestId("youglish-player")).toBeNull();
  mockFocused = true;
  screen.rerender(<YouGlishContextPlayer query="家族" />);
  expect(screen.getByTestId("youglish-player")).toBeTruthy();
  act(() => onChange?.("background"));
  expect(screen.queryByTestId("youglish-player")).toBeNull();
  act(() => onChange?.("active"));
  expect(screen.getByLabelText("Loading YouGlish examples")).toBeTruthy();
  screen.unmount();
  expect(remove).toHaveBeenCalled();
});

it("shows retry and external lookup when no results or a loading error is reported", () => {
  const screen = render(<YouGlishContextPlayer query="家族" />);
  fireEvent(screen.getByTestId("youglish-player"), "message", { nativeEvent: { data: JSON.stringify({ channel: "kakehashi-youglish", type: "results", value: 0 }) } });
  expect(screen.getByText("No YouGlish examples found for “家族”.")).toBeTruthy();
  expect(screen.queryByTestId("youglish-player")).toBeNull();
  expect(screen.getByRole("link", { name: "Open in YouGlish ↗" })).toBeTruthy();
  fireEvent.press(screen.getByText("Retry YouGlish"));
  fireEvent(screen.getByTestId("youglish-player"), "error", { nativeEvent: {} });
  expect(screen.getByText(/YouGlish could not load/)).toBeTruthy();
});
