import React from "react";
import { Redirect, router, Stack, useLocalSearchParams } from "expo-router";
import { View, Text } from "react-native";
import { useAuthStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";
import { useDashboardData } from "../../src/hooks/useDashboardData";
import {
  canAccessLevelGoals,
  replaceGoal,
} from "../../src/features/level-goals/model";
import { useLevelGoals } from "../../src/features/level-goals/use-level-goals";
import { LevelGoalEditor } from "../../src/features/level-goals/level-goal-editor";

export default function LevelGoalRoute() {
  const username = useAuthStore((s) => s.userData?.username);
  return canAccessLevelGoals(username) ? (
    <GoalRoute />
  ) : (
    <Redirect href="/(app)/(tabs)" />
  );
}
function GoalRoute() {
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ fresh?: string }>();
  const { dashboardData } = useDashboardData();
  const level =
    useAuthStore((s) => s.userData?.level) ?? dashboardData.currentLevel;
  const goals = useLevelGoals(level, dashboardData.levelProgressions);
  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundColor }}>
      <Stack.Screen
        options={{
          title: "Your goal",
          headerShown: true,
          headerTintColor: theme.textColor,
          headerStyle: { backgroundColor: theme.backgroundColor },
          headerShadowVisible: false,
        }}
      />
      {level < 60 ? (
        <LevelGoalEditor
          currentLevel={level}
          progressions={dashboardData.levelProgressions}
          existing={params.fresh === "1" ? null : goals.state.active}
          now={goals.now}
          onClose={() => router.back()}
          onSave={(goal) =>
            goals.update((s) => replaceGoal(s, goal, goals.now))
          }
        />
      ) : (
        <Text style={{ color: theme.textColor, padding: 24 }}>
          You reached level 60. Your goal history is on the Level screen.
        </Text>
      )}
    </View>
  );
}
