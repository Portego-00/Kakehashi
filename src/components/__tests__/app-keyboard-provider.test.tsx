import { act, fireEvent, render } from "@testing-library/react-native";
import React, { useState } from "react";
import { Platform, Pressable, Text, TextInput } from "react-native";
import { useReviewKeyboard, type ReviewKeyboardInfo } from "../../contexts/ReviewKeyboardContext";
import { AppKeyboardProvider } from "../app-keyboard-provider.ios";

const { AppKeyboardProvider: DefaultAppKeyboardProvider } = jest.requireActual<
  typeof import("../app-keyboard-provider")
>("../app-keyboard-provider.tsx");

const mockProviderProps = jest.fn();
const mockProviderMount = jest.fn();
const mockProviderUnmount = jest.fn();
const mockObserverSubscribe = jest.fn();
const mockObserverUnsubscribe = jest.fn();
const mockNativeListeners = new Set<(height: number, state: number) => void>();
let mockCurrentKeyboard: ReviewKeyboardInfo | null = null;

jest.mock("react-native-keyboard-controller", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const NativeProviderContext = React.createContext(false);
  return {
    KeyboardProvider: ({ children, preload }: React.PropsWithChildren<{ preload?: boolean }>) => {
      mockProviderProps(preload);
      React.useLayoutEffect(() => {
        mockProviderMount();
        return () => mockProviderUnmount();
      }, []);
      return <NativeProviderContext.Provider value>{children}</NativeProviderContext.Provider>;
    },
    useAnimatedKeyboard: () => {
      const insideNativeProvider = React.useContext(NativeProviderContext);
      if (!insideNativeProvider) throw new Error("Observer must be inside native KeyboardProvider");
      const keyboard = React.useRef({ height: { value: 0 }, state: { value: 0 } }).current;
      React.useLayoutEffect(() => {
        const listener = (height: number, state: number) => {
          keyboard.height.value = height;
          keyboard.state.value = state;
        };
        mockObserverSubscribe();
        mockNativeListeners.add(listener);
        return () => {
          mockObserverUnsubscribe();
          mockNativeListeners.delete(listener);
        };
      }, []);
      return keyboard;
    },
  };
});

function Quiz() {
  const keyboard = useReviewKeyboard();
  mockCurrentKeyboard = keyboard;
  const [answer, setAnswer] = useState("");
  return <>
    <Text testID="keyboard-progress">{`${keyboard.state.value}:${keyboard.height.value}`}</Text>
    <TextInput testID="answer" value={answer} onChangeText={setAnswer} />
  </>;
}

function QuizNavigation({ revision }: { revision: number }) {
  const [open, setOpen] = useState(false);
  return <>
    <Text>{revision}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Open quiz" onPress={() => setOpen(true)}><Text>Open quiz</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Close quiz" onPress={() => setOpen(false)}><Text>Close quiz</Text></Pressable>
    {open && <Quiz />}
  </>;
}

function emitNativeProgress(height: number, state: number) {
  act(() => {
    for (const listener of mockNativeListeners) listener(height, state);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockNativeListeners.clear();
  mockCurrentKeyboard = null;
});

it("observes progress before the first quiz and keeps one observer through navigation and reopen", () => {
  const screen = render(<AppKeyboardProvider><QuizNavigation revision={1} /></AppKeyboardProvider>);
  expect(mockProviderProps).toHaveBeenLastCalledWith(false);
  expect(mockProviderMount).toHaveBeenCalledTimes(1);
  expect(mockObserverSubscribe).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId("answer")).toBeNull();

  emitNativeProgress(130, 1);
  fireEvent.press(screen.getByLabelText("Open quiz"));
  expect(screen.getByTestId("keyboard-progress").props.children).toBe("1:130");
  const input = screen.getByTestId("answer");
  fireEvent.changeText(input, "gro");
  const keyboard = mockCurrentKeyboard;

  emitNativeProgress(300, 2);
  screen.rerender(<AppKeyboardProvider><QuizNavigation revision={2} /></AppKeyboardProvider>);
  expect(screen.getByTestId("keyboard-progress").props.children).toBe("2:300");
  expect(screen.getByTestId("answer")).toBe(input);
  expect(input.props.value).toBe("gro");
  expect(mockCurrentKeyboard).toBe(keyboard);
  expect(mockProviderMount).toHaveBeenCalledTimes(1);
  expect(mockObserverSubscribe).toHaveBeenCalledTimes(1);

  fireEvent.press(screen.getByLabelText("Close quiz"));
  emitNativeProgress(0, 4);
  expect(mockNativeListeners.size).toBe(1);
  emitNativeProgress(90, 1);
  fireEvent.press(screen.getByLabelText("Open quiz"));
  expect(screen.getByTestId("keyboard-progress").props.children).toBe("1:90");
  expect(mockCurrentKeyboard).toBe(keyboard);
  expect(mockObserverSubscribe).toHaveBeenCalledTimes(1);
  expect(mockObserverUnsubscribe).not.toHaveBeenCalled();

  screen.unmount();
  expect(mockProviderUnmount).toHaveBeenCalledTimes(1);
  expect(mockObserverUnsubscribe).toHaveBeenCalledTimes(1);
  expect(mockNativeListeners.size).toBe(0);
});

it.each(["android", "web"] as const)("bypasses native keyboard setup on %s", (platformName) => {
  const platform = jest.replaceProperty(Platform, "OS", platformName);
  try {
    const screen = render(<DefaultAppKeyboardProvider><Text testID="content">Existing app</Text></DefaultAppKeyboardProvider>);
    expect(screen.getByTestId("content").props.children).toBe("Existing app");
    expect(mockProviderProps).not.toHaveBeenCalled();
    expect(mockProviderMount).not.toHaveBeenCalled();
    expect(mockObserverSubscribe).not.toHaveBeenCalled();
    screen.unmount();
    expect(mockProviderUnmount).not.toHaveBeenCalled();
  } finally {
    platform.restore();
  }
});
