/* eslint-disable @typescript-eslint/no-require-imports -- Jest mock factories load their dependencies locally. */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import MainTabs from "../(app)/(tabs)/_layout";
import BunproTabs from "../(app)/(bunpro-tabs)/_layout";

const mockSearchFocus = jest.fn();
const mockBunproSearchFocus = jest.fn();

jest.mock("expo-router", () => {
  const React = require("react");
  const { TextInput, View } = require("react-native");
  type MockHeaderOptions = {
    ref: React.Ref<{ focus: () => void }>;
    placeholder: string;
  };
  function SearchHeader({ options }: { options: MockHeaderOptions }) {
    const focus = options.placeholder.includes("Bunpro")
      ? mockBunproSearchFocus : mockSearchFocus;
    React.useImperativeHandle(options.ref, () => ({ focus }), [focus]);
    return <TextInput accessibilityLabel={options.placeholder} />;
  }
  function SearchContent() {
    const [draft, setDraft] = React.useState("");
    return <TextInput testID="search-content-draft" value={draft} onChangeText={setDraft} />;
  }
  const Stack = Object.assign(
    ({ children }: { children: React.ReactNode }) => <View>{children}<SearchContent /></View>,
    { Screen: ({ options }: { options: { headerSearchBarOptions?: MockHeaderOptions } }) =>
      options.headerSearchBarOptions ? <SearchHeader options={options.headerSearchBarOptions} /> : null },
  );
  return {
    Stack,
    Tabs: Object.assign(({ children }: { children: React.ReactNode }) => <View>{children}</View>, { Screen: () => null }),
    useRouter: () => ({ setParams: jest.fn() }),
    useSegments: () => ["(app)", "(tabs)", "search"],
    router: { replace: jest.fn() },
  };
});
jest.mock("expo-router/native-tabs", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MainSearch = require("../(app)/(tabs)/search/_layout").default;
  const BunproSearch = require("../(app)/(bunpro-tabs)/bunpro-search/_layout").default;
  type MockTriggerProps = {
    name: string;
    children?: React.ReactNode;
    unstable_nativeProps?: {
      onWillAppear?: () => void;
      onDidAppear?: () => void;
      onDidDisappear?: () => void;
    };
  };
  const Trigger = Object.assign(
    ({ name, children, unstable_nativeProps }: MockTriggerProps) =>
      <View testID={`native-tab-${name}`} onWillAppear={() => {}} onDidDisappear={() => {}} {...unstable_nativeProps}>{children}</View>,
    { Icon: () => null, Label: () => null },
  );
  const NativeTabs = Object.assign(
    ({ children }: { children: React.ReactNode }) => {
      const bunpro = React.Children.toArray(children).some(
        (child: React.ReactElement<MockTriggerProps>) => child.props.name === "bunpro-search",
      );
      return <View>{children}{bunpro ? <BunproSearch /> : <MainSearch />}</View>;
    },
    { Trigger },
  );
  return { NativeTabs };
});
jest.mock("expo-router/react-navigation", () => ({ useIsFocused: () => true }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("../../src/utils/nativeTabs", () => ({ supportsNativeTabs: () => true }));
jest.mock("../../src/hooks/useTabNavigation", () => ({
  useTabNavigation: () => ({ direct: [{ id: "home", label: "Home" }], overflow: [] }),
}));
jest.mock("../../src/utils/theme", () => ({ useTheme: () => ({
  themeMode: "system", isDark: false,
  theme: { primary: "#f09", textSecondary: "#555", cardBackground: "#fff", border: "#ddd" },
}) }));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

it.each([
  { name: "WaniKani", Layout: MainTabs, tab: "search", placeholder: "Search kanji, vocabulary, or meanings...", focus: mockSearchFocus },
  { name: "Bunpro", Layout: BunproTabs, tab: "bunpro-search", placeholder: "Search Bunpro grammar or vocabulary...", focus: mockBunproSearchFocus },
])("attaches $name search only after the native tab finishes appearing", ({ Layout, tab, placeholder, focus }) => {
  // This tests the real tab/search layouts and their native lifecycle boundary.
  // UIKit's actual preview assertion is covered by the external simulator loop.
  const screen = render(<Layout />);
  fireEvent.changeText(screen.getByTestId("search-content-draft"), "keep this query");
  expect(screen.queryByLabelText(placeholder)).toBeNull();
  fireEvent(screen.getByTestId(`native-tab-${tab}`), "willAppear");
  expect(screen.queryByLabelText(placeholder)).toBeNull();

  fireEvent(screen.getByTestId(`native-tab-${tab}`), "didAppear");
  expect(screen.getByLabelText(placeholder)).toBeTruthy();
  act(() => jest.runOnlyPendingTimers());
  expect(focus).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("search-content-draft").props.value).toBe("keep this query");

  fireEvent(screen.getByTestId(`native-tab-${tab}`), "didDisappear");
  fireEvent(screen.getByTestId(`native-tab-${tab}`), "didAppear");
  screen.rerender(<Layout />);
  act(() => jest.runOnlyPendingTimers());
  expect(focus).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText(placeholder)).toBeTruthy();
  expect(screen.getByTestId("search-content-draft").props.value).toBe("keep this query");
});

it("keeps appearance readiness local to each mounted tab navigator", () => {
  const screen = render(<><MainTabs /><BunproTabs /></>);
  fireEvent(screen.getByTestId("native-tab-search"), "didAppear");
  expect(screen.getByLabelText("Search kanji, vocabulary, or meanings...")).toBeTruthy();
  expect(screen.queryByLabelText("Search Bunpro grammar or vocabulary...")).toBeNull();

  screen.unmount();
  const reloaded = render(<MainTabs />);
  expect(reloaded.queryByLabelText("Search kanji, vocabulary, or meanings...")).toBeNull();
});
