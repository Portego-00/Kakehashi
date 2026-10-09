import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import BunproReviewableDetailsScreen from "../BunproReviewableDetailsScreen";
import { getBunproReviewableDetails } from "../../utils/bunproApi";

let mockKind = "grammar";
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: jest.requireActual("react-native").View }));
jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn() }), useLocalSearchParams: () => ({ kind: mockKind, slug: "test" }) }));
jest.mock("../../utils/store", () => ({ useAuthStore: () => ({ userData: { username: "Portego" } }) }));
jest.mock("../../utils/theme", () => ({ useTheme: () => ({ theme: { textColor: "black", textSecondary: "gray", backgroundColor: "white", cardBackground: "white", border: "gray" }, isDark: false }) }));
jest.mock("../../utils/bunproApi", () => ({ getBunproReviewableDetails: jest.fn(async () => ({ data: { id: "1", attributes: { title: "Test subject", meaning: "A test" } }, included: [] })) }));
jest.mock("../../hooks/useBunproAudio", () => ({ useBunproAudio: () => ({ stop: mockStop, play: jest.fn() }) }));
const mockStop = jest.fn(async () => undefined);
jest.mock("../../utils/navigation-focus", () => ({ useOptionalScreenIsFocused: () => true }));
jest.mock("../../components/bunpro/BunproContext", () => ({ BunproContext: ({ query }: { query: string }) => { const React = jest.requireActual("react"); return React.createElement(jest.requireActual("react-native").Text, null, `Context for ${query}`); } }));
jest.mock("../../components/bunpro/bunpro-details-dom", () => ({ __esModule: true, default: ({ tab }: { tab: string }) => { const React = jest.requireActual("react"); return React.createElement(jest.requireActual("react-native").Text, null, `${tab} content`); } }));

it.each(["grammar", "vocab"])("opens %s details with the shared native tabs", async kind => {
  mockKind = kind;
  const view = render(<BunproReviewableDetailsScreen />);
  await waitFor(() => expect(view.getByText("Details content")).toBeTruthy());
  fireEvent.press(view.getByText("Examples"));
  expect(view.getByText("Examples content")).toBeTruthy();
  if (kind === "vocab") { fireEvent.press(view.getByText("Context")); expect(view.getByText("Context for Test subject")).toBeTruthy(); }
  else expect(view.queryByText("Context")).toBeNull();
  expect(getBunproReviewableDetails).toHaveBeenCalledWith(expect.objectContaining({ kind, slug: "test" }));
});
