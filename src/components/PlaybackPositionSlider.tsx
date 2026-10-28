import Slider from "@react-native-community/slider";
import type { StyleProp, ViewStyle } from "react-native";

export interface PlaybackPositionSliderProps {
  value: number;
  duration: number;
  style?: StyleProp<ViewStyle>;
  onSlidingStart: () => void;
  onValueChange: (value: number) => void;
  onSlidingComplete: (value: number) => void;
}


/** Keep the platform slider's native keyboard and accessibility handling outside iOS. */
export function PlaybackPositionSlider({
  value,
  duration,
  style,
  onSlidingStart,
  onValueChange,
  onSlidingComplete,
}: PlaybackPositionSliderProps) {
  return (
    <Slider
      style={style}
      accessibilityLabel="Playback position"
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
  );
}
