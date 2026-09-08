import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../utils/theme";

/** Match the themed back-and-title header used by the app's Settings screen. */
export default function CustomVocabularyHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View testID="custom-vocabulary-header" style={[styles.header, { backgroundColor: theme.headerBackground, paddingTop: insets.top + 16, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={theme.headerText} />
      </TouchableOpacity>
      <Text accessibilityRole="header" numberOfLines={2} style={[styles.title, { color: theme.headerText }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingBottom: 16 },
  backButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", marginRight: 8 },
  title: { flex: 1, fontSize: 24, fontWeight: "bold" },
});
