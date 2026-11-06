import Slider from "@react-native-community/slider";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

import type { PlaybackPositionSliderProps } from "./PlaybackPositionSlider";

function spokenTime(seconds: number) {
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}, ${remainder} ${remainder === 1 ? "second" : "seconds"}`;
}

/** Both touch and VoiceOver seek the same player through onSlidingComplete. */
export function PlaybackPositionSlider({
  value,
  duration,
  style,
  onSlidingStart,
  onValueChange,
  onSlidingComplete,
}: PlaybackPositionSliderProps) {
  const maximum = Math.max(0, duration);
  const current = Math.max(0, Math.min(value, maximum));
  const pendingValue = useRef(current);

  useEffect(() => {
    pendingValue.current = current;
  }, [current]);

  return (
    <View
      style={style}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Playback position"
      accessibilityState={{ disabled: maximum <= 0 }}
      accessibilityValue={{
        min: 0,
        max: maximum,
        now: current,
        text: `${spokenTime(current)} of ${spokenTime(maximum)}`,
      }}
      accessibilityActions={[
        { name: "increment", label: "Seek forward one second" },
        { name: "decrement", label: "Seek backward one second" },
      ]}
      onAccessibilityAction={({ nativeEvent: { actionName } }) => {
        if (maximum <= 0 || (actionName !== "increment" && actionName !== "decrement")) {
          return;
        }
        const delta = actionName === "increment" ? 1 : -1;
        const next = Math.max(0, Math.min(pendingValue.current + delta, maximum));
        if (next === pendingValue.current) return;
        pendingValue.current = next;
        onSlidingComplete(next);
      }}
    >
      <View
        style={styles.track}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Slider
          style={styles.track}
          accessible={false}
          minimumValue={0}
          maximumValue={duration || 100}
          value={value}
          onSlidingStart={onSlidingStart}
          onValueChange={onValueChange}
          onSlidingComplete={onSlidingComplete}
          minimumTrackTintColor="rgba(255, 255, 255, 0.9)"
          maximumTrackTintColor="rgba(255, 255, 255, 0.3)"
          thumbTintColor="white"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ track: { flex: 1, height: 40 } });
