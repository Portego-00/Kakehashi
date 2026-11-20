import { useSettingsStore } from "../../../utils/store";
import {
  applySettingsBackup,
  MAX_SETTINGS_FILE_BYTES,
  parseSettingsBackup,
  serializeSettingsBackup,
} from "../settings-transfer";

const initial = useSettingsStore.getInitialState();

afterEach(() => useSettingsStore.setState(initial, true));

function backup(preferences: Record<string, unknown>, version = 1) {
  return JSON.stringify({ format: "kakehashi-settings", version, preferences });
}

it("restores portable preferences and configuration on a fresh device", () => {
  const page = {
    id: "page-1",
    name: "Apprentice kanji",
    filter: {
      subjectTypes: ["kanji" as const],
      minLevel: null,
      maxLevel: 10,
      jlptLevels: [],
      srsGroups: ["apprentice" as const],
      criticalOnly: false,
    },
  };
  useSettingsStore.setState({
    lessonBatchSize: 8,
    hapticFeedbackEnabled: false,
    dailyLessonLimit: 0,
    reviewPresets: [{
      id: "review-1", name: "Short reviews", batchSize: 15, reviewOrder: "random",
    }],
    customTabOrder: ["home", "items", "bunpro"],
    activeLearningPageId: page.id,
    learningPages: [page],
    immersionKitAnimes: ["Frieren"],
    widgetLessonCardGradientStart: "#654321",
    appTextSizeScale: 2,
  });

  const contents = serializeSettingsBackup(useSettingsStore.getState(), "midnight");
  useSettingsStore.setState(initial, true);
  const decoded = parseSettingsBackup(contents);
  applySettingsBackup(decoded);

  expect(decoded.themeMode).toBe("midnight");
  expect(useSettingsStore.getState()).toMatchObject({
    lessonBatchSize: 8,
    hapticFeedbackEnabled: false,
    dailyLessonLimit: 0,
    reviewPresets: [{
      id: "review-1", name: "Short reviews", batchSize: 15, reviewOrder: "random",
    }],
    customTabOrder: ["home", "items", "bunpro"],
    activeLearningPageId: page.id,
    learningPages: [page],
    immersionKitAnimes: ["Frieren"],
    widgetLessonCardGradientStart: "#654321",
    appTextSizeScale: 2,
  });
});

it("excludes account details and device permissions on export and import", () => {
  useSettingsStore.setState({
    gravatarEmail: "owner@example.test",
    spotifyClientId: "client-id",
    enableReviewNotifications: true,
    offlineVocabularyAudioEnabled: false,
  });
  const exported = parseSettingsBackup(serializeSettingsBackup(useSettingsStore.getState(), "dark"));
  expect(exported.preferences).not.toHaveProperty("gravatarEmail");
  expect(exported.preferences).not.toHaveProperty("spotifyClientId");
  expect(exported.preferences).not.toHaveProperty("enableReviewNotifications");
  expect(exported.preferences).not.toHaveProperty("offlineVocabularyAudioEnabled");

  const importFile = backup({
    lessonBatchSize: 3,
    gravatarEmail: "someone-else@example.test",
    spotifyClientId: "",
    enableReviewNotifications: false,
    offlineVocabularyAudioEnabled: true,
    setLessonBatchSize: "overwrite",
    ["__proto__"]: { hapticFeedbackEnabled: false },
  });
  applySettingsBackup(parseSettingsBackup(importFile));
  expect(useSettingsStore.getState()).toMatchObject({
    lessonBatchSize: 3,
    gravatarEmail: "owner@example.test",
    spotifyClientId: "client-id",
    enableReviewNotifications: true,
    offlineVocabularyAudioEnabled: false,
    hapticFeedbackEnabled: true,
    setLessonBatchSize: expect.any(Function),
  });
});

it("preserves preferences absent from a partial file", () => {
  useSettingsStore.setState({ dailyLessonLimit: 20, immersionKitAnimes: ["Frieren"] });
  applySettingsBackup(parseSettingsBackup(backup({ immersionKitAnimes: null })));

  expect(useSettingsStore.getState()).toMatchObject({
    dailyLessonLimit: 20,
    immersionKitAnimes: null,
  });
});

it.each([
  ["invalid JSON", "{", /valid Kakehashi/],
  ["another format", "{}", /valid Kakehashi/],
  ["future versions", backup({ lessonBatchSize: 4 }, 2), /unsupported/],
  ["invalid values", backup({ lessonBatchSize: 4, reviewBatchSize: 0 }), /invalid Kakehashi setting/],
  ["invalid tab layouts", backup({ customTabOrder: ["a", "b", "c", "d", "e"] }), /invalid Kakehashi setting/],
  ["unknown keys only", backup({ unknownSetting: true }), /no valid Kakehashi/],
  ["oversized files", " ".repeat(MAX_SETTINGS_FILE_BYTES + 1), /1 MB/],
])("rejects %s without changing preferences", (_name, contents, error) => {
  expect(() => parseSettingsBackup(contents)).toThrow(error);
  expect(useSettingsStore.getState().lessonBatchSize).toBe(initial.lessonBatchSize);
});
