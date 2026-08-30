import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import type { JlptQuestion } from "./domain";
import { useTheme } from "../../utils/theme";

type Scene = NonNullable<NonNullable<JlptQuestion["listening"]>["verbalScene"]>;

const xBySide = { left: 92, right: 308 } as const;

function Person({
  side,
  pose,
  color,
}: {
  side: "left" | "right";
  pose: Scene["speaker"]["pose"];
  color: string;
}) {
  const x = xBySide[side];
  const toward = side === "left" ? 1 : -1;
  const armEnd =
    pose === "pointing" || pose === "offering"
      ? 56
      : pose === "requesting"
        ? 30
        : 24;
  return (
    <>
      <Circle
        cx={x}
        cy={100}
        r={15}
        fill="none"
        stroke={color}
        strokeWidth={3}
      />
      <Path
        d={`M${x} 115v58m0 0-21 29m21-29 21 29`}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d={`M${x} 133l${armEnd * toward} 25M${x} 133l${-22 * toward} 28`}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />
      {pose === "confused" ? (
        <SvgText
          x={x + 28 * toward}
          y={88}
          fontSize={27}
          fill={color}
          textAnchor="middle"
        >
          ?
        </SvgText>
      ) : null}
      {pose === "speaking" ? (
        <Path
          d={`M${x + 21 * toward} 98l${13 * toward} -5m${-11 * toward} 15l${16 * toward} 1`}
          fill="none"
          stroke={color}
          strokeWidth={2}
        />
      ) : null}
    </>
  );
}

export function JlptVerbalScene({ scene }: { scene: Scene }) {
  const { theme } = useTheme();
  const speakerX = xBySide[scene.speaker.side];
  const propX = scene.prop
    ? scene.prop.position === "left"
      ? 118
      : scene.prop.position === "right"
        ? 282
        : 200
    : 200;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${scene.description}. The arrow marks the next speaker.`}
      style={[
        styles.container,
        { borderColor: theme.border, backgroundColor: theme.backgroundColor },
      ]}
    >
      <View style={styles.labelRow}>
        <Text style={[styles.setting, { color: theme.textSecondary }]}>
          {scene.setting.replace("-", " ").toUpperCase()}
        </Text>
        {scene.prop ? (
          <Text style={[styles.propLabel, { color: theme.textColor }]}>
            {scene.prop.kind}
          </Text>
        ) : null}
      </View>
      <Svg width="100%" height={190} viewBox="0 0 400 220">
        <Rect
          x={18}
          y={30}
          width={364}
          height={176}
          rx={7}
          fill="none"
          stroke={theme.border}
          strokeWidth={2}
        />
        <Line
          x1={30}
          y1={180}
          x2={370}
          y2={180}
          stroke={theme.border}
          strokeWidth={2}
        />
        <Person
          side={scene.speaker.side}
          pose={scene.speaker.pose}
          color={theme.textColor}
        />
        <Person
          side={scene.partner.side}
          pose={scene.partner.pose}
          color={theme.textColor}
        />
        {scene.prop ? (
          <>
            <Rect
              x={propX - 30}
              y={142}
              width={60}
              height={34}
              rx={5}
              fill={theme.cardBackground}
              stroke={theme.primary}
              strokeWidth={2}
            />
            <SvgText
              x={propX}
              y={163}
              fontSize={10}
              fontWeight="700"
              fill={theme.primary}
              textAnchor="middle"
            >
              {scene.prop.kind}
            </SvgText>
          </>
        ) : null}
        <Path
          d={`M${speakerX} 12v48l-8-11m8 11 8-11`}
          fill="none"
          stroke={theme.secondary}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <Text style={[styles.caption, { color: theme.textSecondary }]}>
        Arrow marks the person who will speak.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderRadius: 14, padding: 10, marginTop: 15 },
  labelRow: {
    minHeight: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  setting: { fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  propLabel: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  caption: {
    fontSize: 11,
    textAlign: "center",
    marginTop: -4,
    marginBottom: 2,
  },
});
