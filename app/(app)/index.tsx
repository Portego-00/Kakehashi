import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";

export default function AppIndex() {
  useFocusEffect(useCallback(() => {
    // A cold launch already has the Home anchor beneath this entry route.
    // Reuse it instead of replacing this entry with a second copy of Home.
    router.dismissTo("/(app)/(tabs)");
  }, []));

  return null;
}
