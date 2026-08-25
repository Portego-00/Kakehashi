"use client";

import { useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/States";
import { loadKanjiStrokeData } from "@/features/study/stroke-data";
import styles from "../subjects.module.css";

export function StrokeOrder({ character }: { character: string }) {
  const [replay, setReplay] = useState(0);
  const stroke = useQuery({ queryKey: ["stroke-order", character], queryFn: () => loadKanjiStrokeData(character), staleTime: Infinity, retry: 1 });

  if (stroke.isLoading) return <Skeleton height="24rem" />;
  if (!stroke.data) return <p className={styles.contextUnavailable}>Stroke order is unavailable for this character.</p>;

  return <div className={styles.strokeOrder}>
    <div className={styles.strokeOrderCanvas} key={replay}>
      <svg viewBox="0 0 1024 1024" role="img" aria-label={`Animated stroke order for ${character}`}>
        <path className={styles.strokeGuide} d="M 80 512 H 944 M 512 80 V 944" />
        <g transform="translate(0 900) scale(1 -1)">
          {stroke.data.strokes.map((path, index) => <path key={`${index}-${path.slice(0, 12)}`} className={styles.strokePath} d={path} pathLength={1} style={{ "--stroke-delay": `${index * 0.42}s` } as CSSProperties} />)}
        </g>
      </svg>
      <span>{stroke.data.strokes.length} strokes</span>
    </div>
    <Button type="button" tone="ghost" size="small" onClick={() => setReplay((value) => value + 1)}><RotateCcw size={16} aria-hidden />Replay</Button>
  </div>;
}
