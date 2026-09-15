import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { JLPTLevel } from "../utils/jlptClassification";

export default function JLPTLevelChip({ level }: { level: JLPTLevel | null }) {
  if (!level) return null;

  return (
    <View accessible accessibilityLabel={`JLPT level ${level}`} style={styles.chip}>
      <Text style={styles.text}>JLPT {level}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    backgroundColor: "rgba(0, 0, 0, 0.18)",
  },
  text: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
