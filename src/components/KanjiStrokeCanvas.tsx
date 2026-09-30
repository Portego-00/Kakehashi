import React, { useId, useMemo } from "react";
import Svg, { ClipPath, Defs, G, Path } from "react-native-svg";
import type { StrokeFrame } from "../hooks/useStrokePlayback";
import type { CharacterData } from "../utils/kanjiWriterDataLoader";

interface Props {
  data: CharacterData;
  frame: StrokeFrame | null;
  size: number;
  strokeColor: string;
  outlineColor: string;
}

function prepareMedian(points: number[][]) {
  // Extend the beginning so the round brush enters the outline from outside.
  const [first, next] = points;
  const distance = Math.hypot(next[0] - first[0], next[1] - first[1]);
  const extension = distance > 0 ? 100 / distance : 0;
  const start = [first[0] + (first[0] - next[0]) * extension, first[1] + (first[1] - next[1]) * extension];
  const extended = [start, ...points];
  let length = 0;
  for (let i = 1; i < extended.length; i++) {
    length += Math.hypot(extended[i][0] - extended[i - 1][0], extended[i][1] - extended[i - 1][1]);
  }
  return { path: `M ${extended.map(([x, y]) => `${x} ${y}`).join(" L ")}`, length };
}

/** Plain SVG props keep playback identical on iOS and Android, without worklets. */
export default function KanjiStrokeCanvas({ data, frame, size, strokeColor, outlineColor }: Props) {
  const id = `kanji-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const medians = useMemo(() => data.medians.map(prepareMedian), [data]);

  return (
    <Svg width={size} height={size} viewBox="-79 -79 1182 1182" pointerEvents="none">
      <Defs>
        {data.strokes.map((path, index) => (
          <ClipPath key={index} id={`${id}-${index}`}><Path d={path} /></ClipPath>
        ))}
      </Defs>
      <G transform="translate(0, 900) scale(1, -1)">
        {data.strokes.map((path, index) => <Path key={`outline-${index}`} d={path} fill={outlineColor} />)}
        {data.strokes.map((path, index) => {
          if (!frame || index < frame.strokeIndex || (index === frame.strokeIndex && frame.progress >= 1)) {
            return <Path key={index} d={path} fill={strokeColor} />;
          }
          if (index !== frame.strokeIndex || frame.progress <= 0) return null;
          const median = medians[index];
          return (
            <Path
              key={index}
              d={median.path}
              clipPath={`url(#${id}-${index})`}
              fill="none"
              stroke={strokeColor}
              strokeWidth={180}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={[median.length, median.length]}
              strokeDashoffset={median.length * (1 - frame.progress)}
            />
          );
        })}
      </G>
    </Svg>
  );
}
