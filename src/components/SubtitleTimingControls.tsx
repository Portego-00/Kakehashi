import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Slider from "@react-native-community/slider";
import { useTheme } from "../utils/theme";
import { formatSubtitleOffset, SUBTITLE_OFFSET_LIMIT_MS, SUBTITLE_OFFSET_STEP_MS } from "../../shared/subtitleTiming";

export function SubtitleTimingControls({ offsetMs, onChange, ready, error }: {
  offsetMs: number; onChange: (value: number) => void; ready: boolean; error: string | null;
}) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  return <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={{ paddingVertical: 12 }}>
      <Text style={{ color: theme.primary }}>Subtitle timing · {formatSubtitleOffset(offsetMs)}</Text>
    </TouchableOpacity>
    {expanded ? <View style={{ gap: 8 }}>
      <Text style={{ color: theme.textSecondary }}>Move subtitles earlier or later to match the audio. Saved for this video.</Text>
      <Slider accessibilityLabel="Subtitle timing offset" disabled={!ready} minimumValue={-SUBTITLE_OFFSET_LIMIT_MS} maximumValue={SUBTITLE_OFFSET_LIMIT_MS}
        step={SUBTITLE_OFFSET_STEP_MS} value={offsetMs} onValueChange={onChange} minimumTrackTintColor={theme.primary} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        {[{ label: "Earlier 0.1s", value: offsetMs - SUBTITLE_OFFSET_STEP_MS, disabled: offsetMs <= -SUBTITLE_OFFSET_LIMIT_MS },
          { label: "Reset timing", value: 0, disabled: offsetMs === 0 },
          { label: "Later 0.1s", value: offsetMs + SUBTITLE_OFFSET_STEP_MS, disabled: offsetMs >= SUBTITLE_OFFSET_LIMIT_MS }].map(action =>
          <TouchableOpacity key={action.label} accessibilityRole="button" disabled={!ready || action.disabled} onPress={() => onChange(action.value)}
            style={{ minHeight: 44, justifyContent: "center", opacity: !ready || action.disabled ? 0.4 : 1 }}>
            <Text style={{ color: theme.primary }}>{action.label}</Text>
          </TouchableOpacity>)}
      </View>
    </View> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: theme.error }}>{error}</Text> : null}
  </View>;
}
