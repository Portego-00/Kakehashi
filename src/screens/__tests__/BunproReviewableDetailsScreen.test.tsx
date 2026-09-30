import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import BunproReviewableDetailsScreen from "../BunproReviewableDetailsScreen";

jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

let mockKind = "grammar";
jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn() }), useLocalSearchParams: () => ({ kind: mockKind, slug: "test" }) }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("../../utils/store", () => ({ useAuthStore: () => ({ userData: { username: "Portego" } }) }));
jest.mock("../../utils/theme", () => ({ useTheme: () => ({ theme: { textColor: "black", backgroundColor: "white", border: "gray" }, isDark: false }) }));
jest.mock("../../utils/bunproApi", () => ({ getBunproReviewableDetails: async () => ({ data: { id: "1", attributes: { title: "Test subject" } }, included: [] }) }));
jest.mock("../../utils/expoAvCompat", () => ({ Audio: { setAudioModeAsync: jest.fn() } }));
jest.mock("../../modules/AudioSessionManager", () => ({}));
jest.mock("../../components/bunpro/BunproContext", () => ({ BunproContext: () => null }));
jest.mock("react-native-pager-view", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  const { childrenWithOverriddenStyle } = jest.requireActual("react-native-pager-view/lib/commonjs/utils.ios");
  return { __esModule: true, default: React.forwardRef(function TestPager(props: any, ref: any) {
    React.useImperativeHandle(ref, () => ({ setPage: jest.fn() }));
    return <View testID="details-pager">{childrenWithOverriddenStyle(props.children)}</View>;
  }) };
});

it.each(["grammar", "vocab"])("opens %s details using the real iOS pager child handling", async (kind) => {
  mockKind = kind;
  const view = render(<BunproReviewableDetailsScreen />);
  await waitFor(() => expect(view.getByTestId("details-pager")).toBeTruthy());
  expect(view.getByTestId("details-pager").children).toHaveLength(kind === "vocab" ? 4 : 3);
});
