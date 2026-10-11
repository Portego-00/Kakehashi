import React from "react";
import { Text, View } from "react-native";
import { useSettingsStore } from "../../../utils/store";
import { useSettingsControllerContext } from "../SettingsControllerContext";
import { SettingsChoiceCards } from "../../../ui/settings/settings-choice-cards";
export function ReviewAnswerModeSetting() {
  const { theme } = useSettingsControllerContext();
  const anki = useSettingsStore((s) => s.ankiCardMode),
    choice = useSettingsStore((s) => s.reviewMultipleChoiceEnabled),
    scope = useSettingsStore((s) => s.ankiCardModeScope);
  const mode = anki ? "anki" : choice ? "choice" : "type";
  function choose(next: "type" | "choice" | "anki") {
    const store = useSettingsStore.getState();
    store.setAnkiCardMode(next === "anki");
    if (next !== "anki")
      store.setReviewMultipleChoiceEnabled(next === "choice");
  }
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
      <SettingsChoiceCards
        label="Answer mode"
        value={mode}
        theme={theme}
        options={[
          {
            value: "type",
            label: "Type answers",
            description: "Recall and type",
            art: "type",
          },
          {
            value: "choice",
            label: "Multiple choice",
            description: "Pick the answer",
            art: "choice",
          },
          {
            value: "anki",
            label: "Anki cards",
            description: "Reveal and grade",
            art: "cards",
          },
        ]}
        onChange={choose}
      />
      {anki ? (
        <>
          <SettingsChoiceCards
            label="Anki applies to"
            compact
            value={scope}
            theme={theme}
            options={[
              { value: "both", label: "Both", art: "both" },
              { value: "meaning", label: "Meanings", art: "meaning" },
              { value: "reading", label: "Readings", art: "reading" },
            ]}
            onChange={(next) => {
              const store = useSettingsStore.getState();
              store.setAnkiCardModeScope(next);
              if (next !== "both") store.setAnkiGroupQuestions(false);
            }}
          />
          {scope !== "both" ? (
            <SettingsChoiceCards
              label="Other questions use"
              compact
              value={choice ? "choice" : "type"}
              theme={theme}
              options={[
                { value: "type", label: "Type answers", art: "type" },
                { value: "choice", label: "Multiple choice", art: "choice" },
              ]}
              onChange={(next) =>
                useSettingsStore
                  .getState()
                  .setReviewMultipleChoiceEnabled(next === "choice")
              }
            />
          ) : null}
          <Text
            style={{
              paddingHorizontal: 16,
              paddingBottom: 16,
              fontSize: 12,
              color: theme.textSecondary,
            }}
          >
            Anki questions keep their reveal-and-grade behaviour. Other
            questions use your selected input mode.
          </Text>
        </>
      ) : null}
    </View>
  );
}
