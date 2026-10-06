"use client";
import { createElement, Fragment, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { parseFuriganaRuns, sanitizeText } from "./model";
import { BunproRuby } from "./BunproFurigana";
const subscribe = () => () => {};
export function RubyText({ text }: { text: string }) {
  return <>{parseFuriganaRuns(text).map((run, i) => run.kind === "ruby" ? <BunproRuby key={i} base={run.base}>{run.base}<rp>(</rp><rt>{run.reading}</rt><rp>)</rp></BunproRuby> : run.text)}</>;
}
export function BunproSentence({ parts, children }: { parts: string[]; children: ReactNode }) {
  return <>{parts.map((part, index) => <Fragment key={index}>{index > 0 ? children : null}<RubyText text={part} /></Fragment>)}</>;
}
const allowed = new Set(["p", "div", "section", "span", "strong", "b", "em", "i", "u", "sup", "sub", "del", "s", "strike", "br", "ul", "ol", "li", "ruby", "rt", "rp", "h3", "h4", "blockquote", "table", "tbody", "tr", "td", "th"]);
function renderNode(node: Node, key: number, grammarId?: string, ruby = false): ReactNode {
  if (node.nodeType === 3) return ruby ? node.textContent : <RubyText key={key} text={node.textContent ?? ""} />;
  if (!(node instanceof Element)) return null;
  const tag = node.tagName.toLowerCase();
  if (["script", "style", "iframe", "object", "embed", "img", "svg"].includes(tag)) return null;
  const children = Array.from(node.childNodes).map((child, index) => renderNode(child, index, grammarId, ruby || tag === "ruby"));
  if (tag === "a") {
    const href = node.getAttribute("href") ?? "";
    try {
      const url = new URL(href, "https://bunpro.jp");
      if (url.protocol === "https:") return <a key={key} href={url.href} target="_blank" rel="noreferrer">{children}</a>;
    } catch { /* Render unsupported links as text. */ }
  }
  const accent = Boolean(grammarId && node.getAttribute("data-gp-id") === grammarId);
  const caution = node.classList.contains("chui");
  const cautionSection = node.classList.contains("caution");
  const hiddenReading = tag === "rt" && node.classList.contains("bp-js-hide-furi");
  const props = { key, ...(accent ? { "data-bunpro-accent": true } : {}), ...(caution ? { "data-bunpro-caution": true } : {}), ...(cautionSection ? { "data-bunpro-caution-section": true } : {}), ...(hiddenReading ? { "data-bunpro-furigana": "hover" } : {}) };
  if (tag === "ruby") {
    const base = Array.from(node.childNodes).filter(child => !(child instanceof Element) || !["rt", "rp"].includes(child.tagName.toLowerCase())).map(child => child.textContent).join("");
    const { key: rubyKey, ...rubyProps } = props;
    return <BunproRuby key={rubyKey} {...rubyProps} base={base}>{children}</BunproRuby>;
  }
  return allowed.has(tag) ? createElement(tag, props, tag === "br" ? undefined : children) : <span {...props}>{children}</span>;
}
/** Render a small HTML allowlist; never transfer provider attributes or executable markup. */
export function BunproText({ value, grammarId }: { value: unknown; grammarId?: string }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const text = typeof value === "string" ? value.replace(/\[\[[\s\S]*?\]\]/g, "") : "";
  const content = useMemo(() => mounted ? Array.from(new DOMParser().parseFromString(text, "text/html").body.childNodes).map((node, index) => renderNode(node, index, grammarId)) : sanitizeText(text), [mounted, text, grammarId]);
  return <>{content}</>;
}
