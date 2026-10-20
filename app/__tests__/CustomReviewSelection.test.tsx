import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  act,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import React from "react";
import { Platform } from "react-native";
import { router } from "expo-router";

import CustomReviewSelectionScreen from "../(app)/custom-review-selection";
import { EXTRA_STUDY_CONFIG_STORAGE_KEYS } from "../../src/utils/extraStudyConfigPersistence";
import { getAllSubjects } from "../../src/utils/cache";
import { clearExtraStudySessionState } from "../../src/utils/extraStudySessionPersistence";

const mockSetShowVocabularyFrequency = jest.fn();
type MockItemType =
  | "radical"
  | "kanji"
  | "vocabulary"
  | "kana_vocabulary";
type MockJlptLevel = "N5" | "N4" | "N3" | "N2" | "N1";
type MockSearchFilters = {
  minLevel: number;
  maxLevel: number;
  types: Set<MockItemType>;
  srsStages: Set<number>;
  jlptLevels: Set<MockJlptLevel>;
  maxFrequencyRank: number | null;
  vocabularyTypes: string[];
};
type MockSearchFilterModalProps = {
  visible: boolean;
  currentFilters: MockSearchFilters;
  onApply: (filters: MockSearchFilters) => void;
};

const mockSearchFilterModalProps = jest.fn();
let mockNextAppliedFilters: MockSearchFilters | null = null;
let mockAuthState = {
  apiToken: "test-token",
  userData: { id: "user-1", username: "tester", level: 12 },
};
let mockSettingsState = {
  showVocabularyFrequency: true,
  setShowVocabularyFrequency: mockSetShowVocabularyFrequency,
};

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: () => ({}),
}));

jest.mock("@react-navigation/native", () => ({
  useIsFocused: () => true,
}));

jest.mock("@expo/vector-icons", () => {
  const React = jest.requireActual("react");
  const { Text } = jest.requireActual("react-native");
  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

jest.mock("react-native-svg", () => {
  const { View } = jest.requireActual("react-native");
  return { SvgXml: View };
});

jest.mock("../../src/components/GlassButton", () => {
  const { View } = jest.requireActual("react-native");
  return { GlassButton: View };
});

jest.mock("@expo/ui/swift-ui", () => {
  const { View, Text, TouchableOpacity } = jest.requireActual("react-native");
  return {
    Host: View,
    RNHostView: View,
    Menu: View,
    Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <TouchableOpacity onPress={onPress}><Text>{label}</Text></TouchableOpacity>
    ),
  };
});

jest.mock("../../src/components/SearchFilterModal", () => {
  const React = jest.requireActual("react");
  const { Text, TouchableOpacity } = jest.requireActual("react-native");
  const DEFAULT_SEARCH_ITEM_TYPES: MockItemType[] = [
    "radical",
    "kanji",
    "vocabulary",
    "kana_vocabulary",
  ];
  const ALL_SEARCH_SRS_STAGES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  const createDefaultSearchFilters = (): MockSearchFilters => ({
    minLevel: 1,
    maxLevel: 60,
    types: new Set(DEFAULT_SEARCH_ITEM_TYPES),
    srsStages: new Set(ALL_SEARCH_SRS_STAGES),
    jlptLevels: new Set(),
    maxFrequencyRank: null,
    vocabularyTypes: [],
  });

  const SearchFilterModal = (props: MockSearchFilterModalProps) => {
    mockSearchFilterModalProps(props);
    if (!props.visible) {
      return null;
    }

    return React.createElement(
      TouchableOpacity,
      {
        accessibilityLabel: "Apply filters from test modal",
        accessibilityRole: "button",
        onPress: () =>
          props.onApply(mockNextAppliedFilters ?? props.currentFilters),
      },
      React.createElement(Text, null, "Apply Filters"),
    );
  };

  return {
    ALL_SEARCH_SRS_STAGES,
    DEFAULT_SEARCH_ITEM_TYPES,
    createDefaultSearchFilters,
    SearchFilterModal,
  };
});

jest.mock("../../src/hooks/useVocabularyFrequencyRanks", () => ({
  useVocabularyFrequencyRanks: () => ({
    ranks: new Map(),
    isScanningCache: false,
    isLoading: false,
    progress: { completed: 0, total: 0 },
    dataReady: true,
    canUseResults: true,
    resolvedCount: 0,
    needsApproval: false,
    unresolvedCount: 0,
    lookupError: null,
    approveLookup: jest.fn(),
    retryLookup: jest.fn(),
    resetLookupState: jest.fn(),
  }),
}));

jest.mock("../../src/utils/api", () => ({
  clearSubjectsCache: jest.fn().mockResolvedValue(undefined),
  fetchAllPages: jest.fn(),
  getAllAssignmentsCached: jest.fn().mockResolvedValue({ data: [] }),
  getSubjects: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock("../../src/utils/cache", () => ({
  ALL_SUBJECTS_CACHE_KEY: "all-subjects",
  getAllSubjects: jest.fn().mockResolvedValue([]),
  saveToCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/utils/extraStudySessionPersistence", () => ({
  EXTRA_STUDY_SESSION_STORAGE_KEYS: {
    CUSTOM_REVIEW: "extra_study_session:custom_review",
    CUSTOM_KANJI_MATCH: "extra_study_session:custom_kanji_match",
  },
  clearExtraStudySessionState: jest.fn().mockResolvedValue(undefined),
  hasExtraStudySessionState: jest.fn().mockResolvedValue(false),
}));

jest.mock("../../src/utils/radicalSvg", () => ({
  pickBestImage: jest.fn(() => null),
  useRemoteSvg: jest.fn(() => null),
}));

jest.mock("../../src/utils/subjectColors", () => ({
  getSubjectTypeColor: jest.fn(() => "#7c3aed"),
  useSubjectColors: () => ({
    radical: "#0088cc",
    kanji: "#cc0088",
    vocabulary: "#8800cc",
  }),
}));

jest.mock("../../src/utils/subjectLists", () => ({
  getSubjectIdSetForListIds: jest.fn().mockResolvedValue(new Set()),
  getSubjectLists: jest.fn().mockResolvedValue([]),
  syncSubjectListsNow: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/utils/store", () => ({
  useAuthStore: jest.fn(() => mockAuthState),
  useSettingsStore: jest.fn((selector?: (state: typeof mockSettingsState) => unknown) =>
    selector ? selector(mockSettingsState) : mockSettingsState,
  ),
}));

jest.mock("../../src/utils/theme", () => ({
  useTheme: () => ({
    theme: {
      backgroundColor: "#f5f5f5",
      border: "#dddddd",
      cardBackground: "#ffffff",
      error: "#dc2626",
      isDark: false,
      primary: "#6d28d9",
      textColor: "#111111",
      textLight: "#888888",
      textSecondary: "#666666",
    },
  }),
}));

jest.mock("../../src/utils/jlptClassification", () => ({
  JLPT_LEVELS: ["N5", "N4", "N3", "N2", "N1"],
  getJLPTLevelForSubject: jest.fn(() => null),
  subjectMatchesJLPTLevels: jest.fn(() => true),
}));

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const customReviewConfigKey =
  EXTRA_STUDY_CONFIG_STORAGE_KEYS.CUSTOM_REVIEW;

async function openFilters(
  screen: ReturnType<typeof render>,
  accessibleName: RegExp | string = /^Filters/,
) {
  fireEvent.press(await screen.findByLabelText(accessibleName));
  return screen.findByLabelText("Apply filters from test modal");
}

function latestSearchFilterModalProps():
  | MockSearchFilterModalProps
  | undefined {
  return mockSearchFilterModalProps.mock.calls.at(-1)?.[0];
}

function latestSavedCustomReviewConfig() {
  const matchingCalls = mockedAsyncStorage.setItem.mock.calls.filter(
    ([key]) => key === customReviewConfigKey,
  );
  const rawValue = matchingCalls.at(-1)?.[1];
  expect(rawValue).toBeDefined();
  return JSON.parse(rawValue!);
}

describe("Custom Review filter selection persistence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = {
      apiToken: "test-token",
      userData: { id: "user-1", username: "tester", level: 12 },
    };
    mockSettingsState = {
      showVocabularyFrequency: true,
      setShowVocabularyFrequency: mockSetShowVocabularyFrequency,
    };
    mockNextAppliedFilters = null;
    mockedAsyncStorage.getItem.mockResolvedValue(null);
    mockedAsyncStorage.setItem.mockResolvedValue(undefined);
    (getAllSubjects as jest.Mock).mockResolvedValue([]);
  });

  it.each([
    ["ios", "standard", "Standard Review (1)"],
    ["ios", "flashcard", "Flashcard Review (1)"],
    ["android", "standard", "Standard Review"],
    ["android", "flashcard", "Flashcard Review"],
  ] as const)("starts a %s %s session from the study menu", async (platform, reviewMode, label) => {
    const originalPlatform = Platform.OS;
    Platform.OS = platform;
    try {
      (getAllSubjects as jest.Mock).mockResolvedValue([{
        id: 1001, object: "kanji", data: {
          characters: "漢", level: 1,
          meanings: [{ meaning: "Chinese", primary: true }], readings: [],
        },
      }]);
      const screen = render(<CustomReviewSelectionScreen />);
      expect(screen.getByLabelText("Choose study mode").props.accessibilityState).toEqual({ disabled: true });
      fireEvent.press(await screen.findByLabelText("Select 1 ready subjects"));
      if (platform === "android") {
        fireEvent.press(screen.getByLabelText("Choose study mode"));
      }
      fireEvent.press(await screen.findByText(label));
      await waitFor(() => expect(router.push).toHaveBeenCalledWith({
        pathname: "/custom-review",
        params: { subjectIds: "1001", reviewMode },
      }));
      expect(clearExtraStudySessionState).toHaveBeenCalledWith("extra_study_session:custom_review");
      if (platform === "android") {
        expect(screen.queryByText("Choose Study Mode")).toBeNull();
      }
      screen.unmount();
    } finally {
      Platform.OS = originalPlatform;
    }
  });

  it("hydrates a remembered all-level filter instead of capping it to the user level", async () => {
    mockedAsyncStorage.getItem.mockImplementation(async (key) =>
      key === customReviewConfigKey
        ? JSON.stringify({
            version: 1,
            minLevel: 1,
            maxLevel: 60,
            types: ["kanji"],
            srsStages: [5, 6, 9],
            jlptLevels: ["N1"],
            maxFrequencyRank: null,
          })
        : null,
    );

    const screen = render(<CustomReviewSelectionScreen />);

    await openFilters(screen, "Filters, 3 active");

    await waitFor(() => {
      expect(latestSearchFilterModalProps()).toMatchObject({
        visible: true,
        currentFilters: {
          minLevel: 1,
          maxLevel: 60,
          types: new Set(["kanji"]),
          srsStages: new Set([5, 6, 9]),
          jlptLevels: new Set(["N1"]),
          maxFrequencyRank: null,
        },
      });
    });
  });

  it("persists applied filters as a JSON-safe payload", async () => {
    const screen = render(<CustomReviewSelectionScreen />);

    await waitFor(() => {
      expect(latestSearchFilterModalProps()?.currentFilters).toMatchObject({
        minLevel: 1,
        maxLevel: 12,
      });
    });
    expect(mockedAsyncStorage.setItem).not.toHaveBeenCalled();
    mockedAsyncStorage.setItem.mockClear();

    mockNextAppliedFilters = {
      minLevel: 31,
      maxLevel: 40,
      types: new Set(["kanji", "vocabulary", "kana_vocabulary"]),
      srsStages: new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]),
      jlptLevels: new Set(["N2"]),
      maxFrequencyRank: 2500,
      vocabularyTypes: ["proper noun"],
    };
    fireEvent.press(await openFilters(screen, "Filters, 1 active"));

    await waitFor(() => {
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
        customReviewConfigKey,
        expect.any(String),
      );
    });

    expect(latestSavedCustomReviewConfig()).toEqual({
      version: 1,
      minLevel: 31,
      maxLevel: 40,
      types: ["kanji", "vocabulary", "kana_vocabulary"],
      srsStages: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      jlptLevels: ["N2"],
      maxFrequencyRank: 2500,
      vocabularyTypes: ["proper noun"],
    });
  });

  it("applies a vocabulary type before the result limit and updates bulk selection", async () => {
    (getAllSubjects as jest.Mock).mockResolvedValue([
      ...Array.from({ length: 210 }, (_, index) => ({
        id: index + 1,
        object: "vocabulary",
        data: {
          characters: `名${index}`,
          level: 1,
          meanings: [{ meaning: `Name ${index}`, primary: true }],
          readings: [],
          parts_of_speech: ["noun"],
        },
      })),
      {
        id: 500,
        object: "vocabulary",
        data: {
          characters: "東京",
          level: 2,
          meanings: [{ meaning: "Tokyo", primary: true }],
          readings: [],
          parts_of_speech: ["proper noun"],
        },
      },
    ]);

    const screen = render(<CustomReviewSelectionScreen />);
    await waitFor(() =>
      expect(latestSearchFilterModalProps()?.currentFilters.maxLevel).toBe(12),
    );
    mockNextAppliedFilters = {
      ...latestSearchFilterModalProps()!.currentFilters,
      vocabularyTypes: ["proper noun"],
    };
    fireEvent.press(await openFilters(screen));

    await waitFor(() => expect(screen.getByText("Tokyo")).toBeTruthy());
    expect(screen.queryByText("Name 0")).toBeNull();
    expect(screen.getByLabelText("Select 1 ready subjects")).toBeTruthy();
    expect(screen.getByLabelText("Filters, 2 active")).toBeTruthy();
    expect(latestSavedCustomReviewConfig().vocabularyTypes).toEqual(["proper noun"]);
  });

  it("disables filter editing until delayed hydration restores the saved filters", async () => {
    let resolveStoredConfig: (value: string | null) => void = () => {};
    const pendingStoredConfig = new Promise<string | null>((resolve) => {
      resolveStoredConfig = resolve;
    });
    mockedAsyncStorage.getItem.mockReturnValue(pendingStoredConfig);

    const screen = render(<CustomReviewSelectionScreen />);

    await waitFor(() => {
      expect(mockedAsyncStorage.getItem).toHaveBeenCalledWith(
        customReviewConfigKey,
      );
    });
    expect(screen.getByLabelText("Filters").props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(
      screen.queryByLabelText("Apply filters from test modal"),
    ).toBeNull();
    expect(latestSearchFilterModalProps()?.visible).toBe(false);
    expect(mockedAsyncStorage.setItem).not.toHaveBeenCalled();

    await act(async () => {
      resolveStoredConfig(
        JSON.stringify({
          version: 1,
          minLevel: 51,
          maxLevel: 60,
          types: ["radical"],
          srsStages: [9],
          jlptLevels: ["N1"],
          maxFrequencyRank: null,
        }),
      );
      await pendingStoredConfig;
    });

    const enabledFiltersButton = await screen.findByLabelText(
      "Filters, 4 active",
    );
    expect(enabledFiltersButton.props.accessibilityState).toEqual({
      disabled: false,
    });
    fireEvent.press(enabledFiltersButton);
    await screen.findByLabelText("Apply filters from test modal");

    expect(latestSearchFilterModalProps()).toMatchObject({
      visible: true,
      currentFilters: {
        minLevel: 51,
        maxLevel: 60,
        types: new Set(["radical"]),
        srsStages: new Set([9]),
        jlptLevels: new Set(["N1"]),
        maxFrequencyRank: null,
      },
    });
  });
});
