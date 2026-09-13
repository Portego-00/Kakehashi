import { useSettingsStore } from "../store";

describe("widget background refresh setting", () => {
  afterEach(() => {
    useSettingsStore.setState({
      widgetBackgroundRefreshEnabled: true,
    });
  });

  it("enables background refresh by default", () => {
    expect(
      useSettingsStore.getInitialState().widgetBackgroundRefreshEnabled,
    ).toBe(true);
  });

  it("can toggle background refresh setting", () => {
    useSettingsStore.getState().setWidgetBackgroundRefreshEnabled(false);
    expect(
      useSettingsStore.getState().widgetBackgroundRefreshEnabled,
    ).toBe(false);

    useSettingsStore.getState().setWidgetBackgroundRefreshEnabled(true);
    expect(
      useSettingsStore.getState().widgetBackgroundRefreshEnabled,
    ).toBe(true);
  });
});
