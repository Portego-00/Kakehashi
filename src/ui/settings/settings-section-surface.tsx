import type { ViewInstance } from "react-native";
import React, { useCallback, useContext, useEffect, useRef } from "react";
import { View, type ViewProps } from "react-native";
import {
  SettingsSectionAnchorContext,
  useSettingsSearchSection,
} from "./settings-search";
import Animated, {
  CurvedTransition,
  Easing,
  ReduceMotion,
} from "react-native-reanimated";

export const settingsLayoutTransition = CurvedTransition.duration(220)
  .easingX(Easing.bezier(0.2, 0, 0, 1))
  .easingY(Easing.bezier(0.2, 0, 0, 1))
  .easingWidth(Easing.bezier(0.2, 0, 0, 1))
  .easingHeight(Easing.bezier(0.2, 0, 0, 1))
  .reduceMotion(ReduceMotion.System);

export function SettingsSectionSurface(props: ViewProps) {
  const ref = useRef<ViewInstance>(null);
  const section = useSettingsSearchSection();
  const register = useContext(SettingsSectionAnchorContext);
  const measure = useCallback(
    (callback: (y: number) => void) =>
      ref.current?.measureInWindow((_x, y) => callback(y)),
    [],
  );
  useEffect(() => {
    if (section && register && props.onLayout)
      return register(section.key, measure);
  }, [section, register, props.onLayout, measure]);
  return (
    <Animated.View {...props} ref={ref} layout={settingsLayoutTransition} />
  );
}
