"use client";

import { useId, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/States";
import { loadKanjiStrokeData } from "@/features/study/stroke-data";
import styles from "../subjects.module.css";

const STROKE_WIDTH = 180;
const STROKE_DURATION_SECONDS = 0.5;
const DELAY_BETWEEN_STROKES_SECONDS = 0.4;

function extendMedianStart(median: number[][], distance: number): number[][] {
  if (median.length < 2) return median;
  const [startX = 0, startY = 0] = median[0];
  const [nextX = 0, nextY = 0] = median[1];
  const deltaX = startX - nextX;
  const deltaY = startY - nextY;
  const length = Math.hypot(deltaX, deltaY);
  if (!length) return median;
  return [[startX + (deltaX / length) * distance, startY + (deltaY / length) * distance], ...median.slice(1)];
}

function medianPath(median: number[][]): string {
  return extendMedianStart(median, STROKE_WIDTH / 2)
    .map(([x = 0, y = 0], index) => `${index ? "L" : "M"} ${x} ${y}`)
    .join(" ");
}

export function StrokeOrder({ character }: { character: string }) {
  const [replay, setReplay] = useState(0);
  const clipBaseId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const stroke = useQuery({ queryKey: ["stroke-order", character], queryFn: () => loadKanjiStrokeData(character), staleTime: Infinity, retry: 1 });

  if (stroke.isLoading) return <Skeleton height="24rem" />;
  if (!stroke.data) return <p className={styles.contextUnavailable}>Stroke order is unavailable for this character.</p>;

  return <div className={styles.strokeOrder}>
    <div className={styles.strokeOrderCanvas} key={replay}>
      <svg viewBox="0 0 1024 1024" role="img" aria-label={`Animated stroke order for ${character}`}>
        <path className={styles.strokeGuide} d="M 80 512 H 944 M 512 80 V 944" />
        <defs>
          {stroke.data.strokes.map((path, index) => <clipPath key={`${index}-${path.slice(0, 12)}`} id={`${clipBaseId}-stroke-${index}`} clipPathUnits="userSpaceOnUse"><path d={path} /></clipPath>)}
        </defs>
        <g className={styles.strokeOutline} transform="translate(0 900) scale(1 -1)" aria-hidden>
          {stroke.data.strokes.map((path, index) => <path key={`${index}-${path.slice(0, 12)}`} d={path} />)}
        </g>
        <g transform="translate(0 900) scale(1 -1)">
          {stroke.data.medians.map((median, index) => <path
            key={`${index}-${median[0]?.join("-")}`}
            data-stroke-trace
            className={styles.strokeTrace}
            d={medianPath(median)}
            pathLength={1}
            clipPath={`url(#${clipBaseId}-stroke-${index})`}
            style={{ "--stroke-delay": `${index * (STROKE_DURATION_SECONDS + DELAY_BETWEEN_STROKES_SECONDS)}s` } as CSSProperties}
          />)}
        </g>
      </svg>
      <span>{stroke.data.strokes.length} strokes</span>
    </div>
    <Button type="button" tone="ghost" size="small" onClick={() => setReplay((value) => value + 1)}><RotateCcw size={16} aria-hidden />Replay</Button>
  </div>;
}
