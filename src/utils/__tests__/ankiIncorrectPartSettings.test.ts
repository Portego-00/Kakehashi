import { permanentStorage } from "../permanentStorage";
import { useSettingsStore } from "../store";
jest.mock("../badgeNotifications", () => ({ clearBadgeCount: jest.fn(), invalidateBadgeNotificationUpdatesForLogout: jest.fn() }));
jest.mock("expo-notifications", () => ({}));

afterEach(() => useSettingsStore.setState(useSettingsStore.getInitialState(), true));

it("keeps grouped Wrong grading both parts by default", () => {
  expect(useSettingsStore.getInitialState().ankiAskIncorrectPart).toBe(false);
});

it.each([19, useSettingsStore.persist.getOptions().version])(
  "does not enable the chooser when hydrating older settings (schema %s)", async (version) => {
    useSettingsStore.setState({ ankiAskIncorrectPart: true });
    permanentStorage.set("wanikani-settings", JSON.stringify({ state: { ankiGroupQuestions: true }, version }));
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState()).toMatchObject({ ankiAskIncorrectPart: false, ankiGroupQuestions: true });
  },
);

it.each([true, false])("persists and restores the %s preference", async (enabled) => {
  useSettingsStore.getState().setAnkiAskIncorrectPart(enabled);
  const stored = permanentStorage.getString("wanikani-settings")!;
  expect(JSON.parse(stored).state.ankiAskIncorrectPart).toBe(enabled);
  useSettingsStore.setState({ ankiAskIncorrectPart: !enabled });
  permanentStorage.set("wanikani-settings", stored);
  await useSettingsStore.persist.rehydrate();
  expect(useSettingsStore.getState().ankiAskIncorrectPart).toBe(enabled);
});
