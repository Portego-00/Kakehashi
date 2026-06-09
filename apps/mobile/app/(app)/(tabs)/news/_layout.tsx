import { Stack } from "expo-router";
import React from "react";
import { useTheme } from "../../../../src/utils/theme";

export default function NewsLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: {
          backgroundColor: theme.cardBackground,
        },
        headerTintColor: theme.textColor,
        headerTitleStyle: {
          fontWeight: "bold",
        },
        headerShadowVisible: false, // Cleaner look
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "News",
        }}
      />
    </Stack>
  );
}
