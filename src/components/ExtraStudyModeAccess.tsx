import { Redirect } from "expo-router";
import React, { type PropsWithChildren } from "react";
import {
  getAvailableExtraStudyModes,
  type ExtraStudyModeId,
} from "../utils/extraStudyModes";
import { useAuthStore } from "../utils/store";

export default function ExtraStudyModeAccess({
  modeId,
  children,
}: PropsWithChildren<{ modeId: ExtraStudyModeId }>) {
  const username = useAuthStore((state) => state.userData?.username);
  const isLoading = useAuthStore((state) => state.isLoading);

  if (isLoading) return null;
  if (
    !getAvailableExtraStudyModes(username).some((mode) => mode.id === modeId)
  ) {
    return <Redirect href="/(app)/(tabs)" />;
  }
  return <>{children}</>;
}
