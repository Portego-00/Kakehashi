import type { ReactNode } from "react";
import styles from "@/features/content/community.module.css";

const VIDEO_FILE_PATTERN = /\.(mp4|mov|m4v|webm|avi|mkv|3gp)(\?.*)?$/i;
const INLINE_PATTERN = /(!?\[[^\]]*\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g;

export function safeCommunityMediaUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function isCommunityVideoUrl(url: string, alt = "") {
  return VIDEO_FILE_PATTERN.test(url) || alt.toLocaleLowerCase().includes("video");
}

function inlineMarkdown(value: string, blockKey: string): ReactNode[] {
  return value.split(INLINE_PATTERN).filter(Boolean).map((part, index) => {
    const key = `${blockKey}-${index}`;
    const asset = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (asset) {
      const url = safeCommunityMediaUrl(asset[2]);
      if (!url) return <span key={key}>{part}</span>;
      if (isCommunityVideoUrl(url, asset[1])) return <video className={styles.markdownMedia} key={key} controls preload="metadata" src={url}>Your browser cannot play this video.</video>;
      // Dynamic community media has no trustworthy dimensions before it loads.
      // eslint-disable-next-line @next/next/no-img-element
      return <img className={styles.markdownMedia} key={key} src={url} alt={asset[1]} loading="lazy" />;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const url = safeCommunityMediaUrl(link[2]);
      return url ? <a key={key} href={url} target="_blank" rel="noreferrer">{link[1]}</a> : <span key={key}>{part}</span>;
    }
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={key}>{part.slice(1, -1)}</code>;
    return part;
  });
}

export function CommunityMarkdown({ children }: { children: string }) {
  const blocks = children.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return <div className={styles.markdown}>{blocks.map((block, index) => {
    const key = `community-markdown-${index}`;
    const lines = block.split("\n");
    if (lines.every((line) => /^\s*[-*]\s+/.test(line))) return <ul key={key}>{lines.map((line, lineIndex) => <li key={`${key}-${lineIndex}`}>{inlineMarkdown(line.replace(/^\s*[-*]\s+/, ""), `${key}-${lineIndex}`)}</li>)}</ul>;
    const heading = block.match(/^(#{1,3})\s+([\s\S]+)$/);
    if (heading && !heading[2].includes("\n")) {
      const content = inlineMarkdown(heading[2], key);
      if (heading[1].length === 1) return <h2 key={key}>{content}</h2>;
      return <h3 key={key}>{content}</h3>;
    }
    if (lines.every((line) => /^\s*>/.test(line))) return <blockquote key={key}>{inlineMarkdown(lines.map((line) => line.replace(/^\s*>\s?/, "")).join("\n"), key)}</blockquote>;
    return <p key={key}>{lines.flatMap((line, lineIndex) => [lineIndex ? <br key={`${key}-break-${lineIndex}`} /> : null, ...inlineMarkdown(line, `${key}-${lineIndex}`)])}</p>;
  })}</div>;
}
