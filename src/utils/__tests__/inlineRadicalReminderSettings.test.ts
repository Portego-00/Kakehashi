import { useSettingsStore } from "../store";

describe("inline radical reminder setting", () => {
  afterEach(() => {
    useSettingsStore.setState({ showInlineRadicalReminders: false });
  });

  it("is disabled by default", () => {
    expect(
      useSettingsStore.getInitialState().showInlineRadicalReminders,
    ).toBe(false);
  });

  it("can be enabled and disabled", () => {
    useSettingsStore.getState().setShowInlineRadicalReminders(true);
    expect(useSettingsStore.getState().showInlineRadicalReminders).toBe(true);

    useSettingsStore.getState().setShowInlineRadicalReminders(false);
    expect(useSettingsStore.getState().showInlineRadicalReminders).toBe(false);
  });
});
