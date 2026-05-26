import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Switch, Text, TouchableOpacity, View } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function KanjiLearningSection() {
  const {
    setShowOnyomiInKatakana,
    setShowStrokeOrder,
    setStrokeLeniency,
    setVisuallySimilarKanjiSource,
    showOnyomiInKatakana,
    showStrokeOrder,
    strokeLeniency,
    theme,
    updateSectionOffset,
    visuallySimilarKanjiSource,
  } = useSettingsControllerContext();

  return (
    <>
      {/* Kanji Learning Section */}
      <View
        style={[
          styles.section,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        onLayout={(event) => {
          updateSectionOffset("kanji", event.nativeEvent.layout.y);
        }}
      >
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.textColor, borderBottomColor: theme.border },
          ]}
        >
          Kanji Learning
        </Text>

        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Ionicons
            name="brush"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Stroke Order Animation
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Show animated stroke order in kanji details
            </Text>
          </View>
          <Switch
            value={showStrokeOrder}
            onValueChange={setShowStrokeOrder}
            trackColor={{ false: "#767577", true: theme.primary }}
            thumbColor="#f4f3f4"
          />
        </View>

        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Ionicons
            name="create-outline"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Stroke Strictness
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Tolerance for stroke accuracy
            </Text>
          </View>
          <View style={styles.batchSizeSelector}>
            <TouchableOpacity
              style={[
                styles.batchSizeButton,
                { backgroundColor: theme.border },
                strokeLeniency <= 0.8 && styles.batchSizeButtonDisabled,
              ]}
              onPress={() => {
                const levels = [0.8, 1.2, 1.8, 2.5];
                // Find closest level index for legacy values
                const currentIdx = levels.findIndex(
                  (l, i) => strokeLeniency <= l || i === levels.length - 1,
                );
                if (currentIdx > 0) {
                  setStrokeLeniency(levels[currentIdx - 1]);
                }
              }}
              disabled={strokeLeniency <= 0.8}
            >
              <Ionicons
                name="remove"
                size={18}
                color={
                  strokeLeniency <= 0.8 ? theme.textSecondary : theme.textColor
                }
              />
            </TouchableOpacity>
            <Text style={[styles.leniencyValue, { color: theme.textColor }]}>
              {strokeLeniency <= 0.8
                ? "Very Strict"
                : strokeLeniency <= 1.2
                  ? "Strict"
                  : strokeLeniency <= 1.8
                    ? "Lenient"
                    : "Very Lenient"}
            </Text>
            <TouchableOpacity
              style={[
                styles.batchSizeButton,
                { backgroundColor: theme.border },
                strokeLeniency >= 2.5 && styles.batchSizeButtonDisabled,
              ]}
              onPress={() => {
                const levels = [0.8, 1.2, 1.8, 2.5];
                // Find closest level index for legacy values
                const currentIdx = levels.findIndex(
                  (l, i) => strokeLeniency <= l || i === levels.length - 1,
                );
                if (currentIdx < levels.length - 1) {
                  setStrokeLeniency(levels[currentIdx + 1]);
                } else if (strokeLeniency > 2.5) {
                  // Handle legacy values above max - snap to max
                  setStrokeLeniency(2.5);
                }
              }}
              disabled={strokeLeniency >= 2.5}
            >
              <Ionicons
                name="add"
                size={18}
                color={
                  strokeLeniency >= 2.5 ? theme.textSecondary : theme.textColor
                }
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Text
            style={[
              styles.settingIcon,
              {
                fontSize: 20,
                fontWeight: "bold",
                color: theme.primary,
                width: 24,
                textAlign: "center",
              },
            ]}
          >
            ア
          </Text>
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Katakana Madness
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Display On&apos;yomi readings in katakana instead of hiragana
            </Text>
          </View>
          <Switch
            value={showOnyomiInKatakana}
            onValueChange={setShowOnyomiInKatakana}
            trackColor={{ false: "#767577", true: theme.primary }}
            thumbColor="#f4f3f4"
          />
        </View>

        <View
          style={[styles.settingItem, { borderBottomColor: "transparent" }]}
        >
          <Ionicons
            name="copy-outline"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Similar Kanji Source
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              {visuallySimilarKanjiSource === "wanikani"
                ? "Using WaniKani's built-in similar kanji"
                : "Using Niai community database (more comprehensive)"}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.voiceSelectionButton, { borderColor: theme.border }]}
            onPress={() =>
              setVisuallySimilarKanjiSource(
                visuallySimilarKanjiSource === "wanikani" ? "niai" : "wanikani",
              )
            }
          >
            <Text
              style={[styles.voiceSelectionText, { color: theme.textColor }]}
            >
              {visuallySimilarKanjiSource === "wanikani" ? "WaniKani" : "Niai"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}
