export type { SettingsArtworkName } from "../../../../../src/ui/settings/artwork";
import { screenPreview } from "../../../../../src/ui/settings/screen-previews";
import type { CSSProperties } from "react";
import {
  settingsArtwork,
  settingsArtworkName,
  type SettingsArtwork,
  type SettingsIllustrationName,
} from "../../../../../src/ui/settings/artwork";
import {
  isReviewModeSketch,
  reviewModeSketches,
  reviewSketch,
} from "../../../../../src/ui/settings/review-mode-sketch";
export function SettingsIcon({
  name,
  size = 24,
  className,
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const art: SettingsArtwork = settingsArtwork[settingsArtworkName(name)];
  return (
    <svg
      width={size}
      height={size}
      viewBox={art.viewBox ?? "0 0 24 24"}
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d={art.fill} fillRule={art.fillRule} fill="currentColor" opacity={art.solid ? 1 : .16} />
      {(art.paths ?? [art.line]).map((d, index) => <path
        key={index}
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />)}
    </svg>
  );
}
export function SettingsIllustration({
  name,
  className,
}: {
  name: SettingsIllustrationName;
  className?: string;
}) {
  if (isReviewModeSketch(name)) {
    const art = reviewModeSketches[name];
    return (
      <svg
        viewBox={reviewSketch.viewBox}
        className={className}
        width="160"
        height="112"
        aria-hidden="true"
        data-review-sketch={name}
      >
        <path d={reviewSketch.frame} fill="var(--color-surface)" />
        <path d={reviewSketch.prompt} fill="var(--color-kanji)" />
        <path
          d={reviewSketch.progress}
          stroke="white"
          strokeWidth="1.5"
          opacity=".55"
          strokeLinecap="round"
        />
        <path
          d={reviewSketch.character}
          stroke="white"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <path d={reviewSketch.strip} fill="var(--color-muted)" opacity=".15" />
        <path
          d={reviewSketch.question}
          stroke="var(--color-muted)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d={art.surface} fill="var(--color-accent)" opacity=".12" />
        <path
          d={art.outline}
          fill="none"
          stroke={
            name === "type" ? "var(--color-accent)" : "var(--color-rule-2)"
          }
          strokeWidth="2"
        />
        <path
          d={art.marks}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d={art.correct}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={art.wrong}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d={reviewSketch.frame}
          fill="none"
          stroke="var(--color-rule-2)"
          strokeWidth="1"
        />
      </svg>
    );
  }
  const shapes = screenPreview(name, "web", {
    background: "var(--color-surface)", surface: "var(--color-paper)",
    text: "var(--color-ink)", muted: "var(--color-muted)", rule: "var(--color-rule-2)",
    accent: "var(--color-accent)", kanji: "var(--color-kanji)",
    vocabulary: "var(--color-vocabulary)", radical: "var(--color-radical)",
  });
  return <svg viewBox="0 0 160 112" className={className} width="160" height="112" aria-hidden="true" data-screen-preview={name}>
    {shapes.map((shape, index) => "text" in shape
      ? <text key={index} x={shape.x} y={shape.y} fill={shape.color} fontSize={shape.size} fontWeight={shape.weight} fontFamily="inherit">{shape.text}</text>
      : <path key={index} d={shape.d} fill={shape.fill ?? "none"} stroke={shape.stroke} strokeWidth={shape.strokeWidth} opacity={shape.opacity} transform={shape.transform} strokeLinecap="round" strokeLinejoin="round" />)}
  </svg>;
}
