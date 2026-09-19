"use client";
import { createElement, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { parseFuriganaRuns, sanitizeText } from "./model";
const subscribe = () => () => {};
export function RubyText({ text }: { text: string }) {
  return <>{parseFuriganaRuns(text).map((run, i) => run.kind === "ruby" ? <ruby key={i}>{run.base}<rp>(</rp><rt>{run.reading}</rt><rp>)</rp></ruby> : run.text)}</>;
}
const allowed = new Set(["p", "div", "span", "strong", "b", "em", "i", "u", "br", "ul", "ol", "li", "ruby", "rt", "rp", "h3", "h4", "blockquote", "table", "tbody", "tr", "td", "th"]);
function renderNode(node: Node, key: number, ruby = false): ReactNode {
  if (node.nodeType === 3) return ruby ? node.textContent : <RubyText key={key} text={node.textContent ?? ""} />;
  if (!(node instanceof Element)) return null;
  const tag = node.tagName.toLowerCase();
  if (["script", "style", "iframe", "object", "embed", "img", "svg"].includes(tag)) return null;
  const children = Array.from(node.childNodes).map((child, index) => renderNode(child, index, ruby || tag === "ruby"));
  if (tag === "a") {
    const href = node.getAttribute("href") ?? "";
    try {
      const url = new URL(href, "https://bunpro.jp");
      if (url.protocol === "https:") return <a key={key} href={url.href} target="_blank" rel="noreferrer">{children}</a>;
    } catch { /* Render unsupported links as text. */ }
  }
  const accent = Array.from(node.classList).some((name) => name.includes("gp-popout") || name.includes("chui"));
  return allowed.has(tag) ? createElement(tag, { key, ...(accent ? { "data-bunpro-accent": true } : {}) }, tag === "br" ? undefined : children) : <span key={key}>{children}</span>;
}
/** Render a small HTML allowlist; never transfer provider attributes or executable markup. */
export function BunproText({ value }: { value: unknown }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const text = typeof value === "string" ? value.replace(/\[\[[\s\S]*?\]\]/g, "") : "";
  const content = useMemo(() => mounted ? Array.from(new DOMParser().parseFromString(text, "text/html").body.childNodes).map((node, index) => renderNode(node, index)) : sanitizeText(text), [mounted, text]);
  return <>{content}</>;
}
