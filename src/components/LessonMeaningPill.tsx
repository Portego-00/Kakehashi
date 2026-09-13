import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

const BASE_MEANING_FONT_SIZE = 16;

interface LessonMeaningPillProps {
  meaning: string;
  testID?: string;
  textTestID?: string;
}

export default function LessonMeaningPill({
  meaning,
  testID,
  textTestID,
}: LessonMeaningPillProps) {
  const { fontScale } = useWindowDimensions();
  const resolvedFontScale =
    Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;

  return (
    <View
      style={styles.container}
      testID={testID ?? "lesson-meaning-pill"}
    >
      <Text
        // Resolve Dynamic Type before layout so wrapping and painted glyphs use
        // the same metrics. The app-level text-size transform still applies.
        allowFontScaling={false}
        style={[
          styles.text,
          { fontSize: BASE_MEANING_FONT_SIZE * resolvedFontScale },
        ]}
        testID={textTestID ?? "lesson-meaning-pill-text"}
      >
        {meaning}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignSelf: "center",
    maxWidth: "100%",
    minWidth: 0,
  },
  text: {
    color: "white",
    fontWeight: "600",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    maxWidth: "100%",
    minWidth: 0,
  },
});
