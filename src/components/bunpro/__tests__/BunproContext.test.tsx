import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { BunproContext } from "../BunproContext";
import { searchImmersionKit } from "../../../services/immersionKitService";

const mockPlay = jest.fn();
const mockSettings = { immersionKitAnimes: ["Test anime"], myAnimeListUsername: "", hideContextSentenceTranslations: true, hideContextSentenceTranslationsCompletely: false };
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("../../../services/immersionKitService", () => ({ searchImmersionKit: jest.fn() }));
jest.mock("../../../hooks/useBunproAudio", () => ({ useBunproAudio: () => ({ play: mockPlay, loadingKey: null, playingKey: null }) }));
jest.mock("../../../utils/store", () => ({ useSettingsStore: () => mockSettings, useAuthStore: (selector: (state: unknown) => unknown) => selector({ userData: { level: 21 } }) }));
jest.mock("../../../utils/theme", () => ({ useTheme: () => ({ theme: { textColor: "black", textSecondary: "gray", border: "gray" } }) }));

beforeEach(() => jest.clearAllMocks());

it("loads anime scenes with source preferences, reveals translations and plays audio", async () => {
  jest.mocked(searchImmersionKit).mockResolvedValue({ results: [{ id: "1", title: "Test_anime", sentence: "外側です。", translation: "It is outside.", audio: "https://example.test/scene.mp3" }], nextOffset: 1 });
  const screen = render(<BunproContext query="外側" />);
  await waitFor(() => expect(screen.getByText("Test anime")).toBeTruthy());
  expect(searchImmersionKit).toHaveBeenCalledWith("外側", expect.objectContaining({ exactMatch: true, category: "anime", selectedAnimes: ["Test anime"], userLevel: 21 }));
  expect(screen.queryByText("It is outside.")).toBeNull();
  fireEvent.press(screen.getByText("Show translation"));
  expect(screen.getByText("It is outside.")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Play anime clip from Test_anime"));
  expect(mockPlay).toHaveBeenCalledWith("1", ["https://example.test/scene.mp3"]);
});

it("shows an empty state when no scenes match", async () => {
  jest.mocked(searchImmersionKit).mockResolvedValue({ results: [], nextOffset: 0 });
  const screen = render(<BunproContext query="外側" />);
  await waitFor(() => expect(screen.getByText(/No matching ImmersionKit scene/)).toBeTruthy());
});
