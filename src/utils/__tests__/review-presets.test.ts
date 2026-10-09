import { permanentStorage } from "../permanentStorage";
import { useSettingsStore } from "../store";
import { applyReviewPreset, getEnabledReviewPreset, normalizeReviewPresets, type ReviewPreset } from "../review-presets";

const quick: ReviewPreset = { id: "quick", name: "Quick", batchSize: 5, reviewOrder: "ascendingSrsStage" };
const longer: ReviewPreset = { id: "longer", name: "Longer", batchSize: 20, reviewOrder: "random" };

afterEach(() => useSettingsStore.setState(useSettingsStore.getInitialState(), true));

it("persists presets and opt-in without replacing the default review preferences", async () => {
  useSettingsStore.setState({ reviewBatchSizeEnabled: true, reviewBatchSize: 50, reviewOrder: "descendingSrsStage" });
  const { setReviewPresetsEnabled, setReviewPresets } = useSettingsStore.getState();
  setReviewPresetsEnabled(true);
  setReviewPresets([quick, longer]);
  const saved = permanentStorage.getString("wanikani-settings")!;
  useSettingsStore.setState({ reviewPresetsEnabled: false, reviewPresets: [] });
  permanentStorage.set("wanikani-settings", saved);
  await useSettingsStore.persist.rehydrate();
  const preferences = useSettingsStore.getState();
  const selected = getEnabledReviewPreset(preferences, "quick");
  expect(applyReviewPreset(preferences, selected)).toMatchObject({ reviewBatchSizeEnabled: true, reviewBatchSize: 5, reviewOrder: "ascendingSrsStage" });
  expect(useSettingsStore.getState()).toMatchObject({ reviewPresetsEnabled: true, reviewPresets: [quick, longer], reviewBatchSize: 50, reviewOrder: "descendingSrsStage" });
});

it("enforces the three-preset limit and rejects corrupt or duplicate saved entries", async () => {
  const entries = [null, { ...quick, batchSize: 7 }, { ...quick, reviewOrder: "wrong" }, quick, quick, longer, { ...quick, id: "third" }, { ...quick, id: "fourth" }];
  expect(normalizeReviewPresets(entries)).toEqual([quick, longer, { ...quick, id: "third" }]);
  permanentStorage.set("wanikani-settings", JSON.stringify({ state: { reviewPresetsEnabled: "true", reviewPresets: entries }, version: useSettingsStore.persist.getOptions().version }));
  await useSettingsStore.persist.rehydrate();
  expect(useSettingsStore.getState()).toMatchObject({ reviewPresetsEnabled: false, reviewPresets: [quick, longer, { ...quick, id: "third" }] });
});

it("falls back to defaults when a preset is missing, disabled, deleted, or a malformed route parameter", () => {
  const enabled = { reviewBatchSizeEnabled: true, reviewPresetsEnabled: true, reviewPresets: [quick] };
  for (const preferences of [enabled, { ...enabled, reviewBatchSizeEnabled: false }, { ...enabled, reviewPresetsEnabled: false }]) {
    expect(getEnabledReviewPreset(preferences, "missing")).toBeNull();
    expect(getEnabledReviewPreset(preferences, ["quick"])).toBeNull();
  }
  expect(getEnabledReviewPreset({ ...enabled, reviewBatchSizeEnabled: false }, "quick")).toBeNull();
  expect(getEnabledReviewPreset({ ...enabled, reviewPresetsEnabled: false }, "quick")).toBeNull();
  expect(getEnabledReviewPreset({ ...enabled, reviewPresets: [] }, "quick")).toBeNull();
});
