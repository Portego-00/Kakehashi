import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { isPortegoUsername } from "../utils/portegoAccess";
import { useAuthStore } from "../utils/store";
import { useTheme } from "../utils/theme";

type PortegoOnlyScreenProps = {
  children: ReactNode;
  featureName: string;
};

export default function PortegoOnlyScreen({
  children,
  featureName,
}: PortegoOnlyScreenProps) {
  const { theme } = useTheme();
  const username = useAuthStore((state) => state.userData?.username);

  if (isPortegoUsername(username)) {
    return <>{children}</>;
  }

  return (
    <View
      testID="portego-only-screen"
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <StatusBar style={theme.statusBarStyle} />
      <Ionicons
        name="lock-closed-outline"
        size={28}
        color={theme.textSecondary}
      />
      <Text style={[styles.title, { color: theme.textColor }]}>Not available</Text>
      <Text style={[styles.message, { color: theme.textSecondary }]}>
        {featureName} is currently available only to the Portego account.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        style={({ pressed }) => [
          styles.backButton,
          {
            borderColor: theme.border,
            opacity: pressed ? 0.6 : 1,
          },
        ]}
      >
        <Text style={[styles.backButtonText, { color: theme.textColor }]}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    gap: 10,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  title: { fontSize: 19, fontWeight: "700" },
  message: {
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 320,
    textAlign: "center",
  },
  backButton: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 6,
    minHeight: 44,
    paddingHorizontal: 20,
  },
  backButtonText: { fontSize: 15, fontWeight: "600" },
});
