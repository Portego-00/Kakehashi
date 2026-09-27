"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { communityImageSource } from "./media";
import styles from "@/features/content/community.module.css";

const VIDEO_FILE_PATTERN = /\.(mp4|mov|m4v|webm|avi|mkv|3gp)(\?.*)?$/i;
const plugins = [remarkGfm, remarkBreaks];

export function safeCommunityMediaUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch { return null; }
}

export function isCommunityVideoUrl(url: string, alt = "") {
  return VIDEO_FILE_PATTERN.test(url) || alt.toLocaleLowerCase().includes("video");
}

function CommunityImage({ src, alt = "", title }: { src: string; alt?: string; title?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={styles.mediaFallback}>Image unavailable. <a href={src} target="_blank" rel="noreferrer">Open original attachment</a></span>;
  // Community attachments have unknown dimensions until they load.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={styles.markdownMedia} src={communityImageSource(src)} alt={alt} title={title} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

export function CommunityMarkdown({ children }: { children: string }) {
  return <div className={styles.markdown}><Markdown remarkPlugins={plugins} skipHtml urlTransform={(url) => safeCommunityMediaUrl(url) || ""} components={{
    h1: ({ children }) => <h2>{children}</h2>,
    a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
    img: ({ src, alt, title }) => {
      if (typeof src !== "string" || !src) return <span>{alt || "Invalid image URL"}</span>;
      if (isCommunityVideoUrl(src, alt)) return <video className={styles.markdownMedia} controls preload="metadata" src={src}>Your browser cannot play this video.</video>;
      return <CommunityImage key={src} src={src} alt={alt} title={title} />;
    },
  }}>{children}</Markdown></div>;
}
