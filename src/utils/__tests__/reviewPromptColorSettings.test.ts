import { permanentStorage } from "../permanentStorage";
import { useSettingsStore } from "../store";

afterEach(() => useSettingsStore.setState(useSettingsStore.getInitialState(), true));

it("uses the original prompt colors by default", () => {
  expect(useSettingsStore.getInitialState()).toMatchObject({ reviewPromptTextColor: "", bunproReviewPromptTextColor: "" });
});

it("saves and restores independent WaniKani and Bunpro colors across a restart", async () => {
  useSettingsStore.getState().setReviewPromptTextColor("#ABCDEF");
  useSettingsStore.getState().setBunproReviewPromptTextColor("#123456");
  const saved = permanentStorage.getString("wanikani-settings")!;
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  permanentStorage.set("wanikani-settings", saved);
  await useSettingsStore.persist.rehydrate();
  expect(useSettingsStore.getState()).toMatchObject({ reviewPromptTextColor: "#abcdef", bunproReviewPromptTextColor: "#123456" });
  useSettingsStore.getState().setReviewPromptTextColor("");
  expect(useSettingsStore.getState()).toMatchObject({ reviewPromptTextColor: "", bunproReviewPromptTextColor: "#123456" });
});

it.each([undefined, null, true, 42, "red", "#fff", "#12345678"])("rejects invalid saved prompt color %s without changing other preferences", async (value) => {
  useSettingsStore.getState().setReviewPromptTextColor("#123456");
  const saved = JSON.parse(permanentStorage.getString("wanikani-settings")!);
  saved.state.reviewPromptTextColor = value;
  saved.state.bunproReviewPromptTextColor = value;
  saved.state.disableAutoProgressOnWrong = false;
  permanentStorage.set("wanikani-settings", JSON.stringify(saved));
  await useSettingsStore.persist.rehydrate();
  expect(useSettingsStore.getState()).toMatchObject({ reviewPromptTextColor: "", bunproReviewPromptTextColor: "", disableAutoProgressOnWrong: false });
});

it("keeps defaults when upgrading an install without color settings", async () => {
  permanentStorage.set("wanikani-settings", JSON.stringify({ version: 22, state: { disableAutoProgressOnCorrect: true } }));
  await useSettingsStore.persist.rehydrate();
  expect(useSettingsStore.getState()).toMatchObject({ reviewPromptTextColor: "", bunproReviewPromptTextColor: "", disableAutoProgressOnCorrect: true });
});
