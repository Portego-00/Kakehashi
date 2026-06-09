import { Directory, File, Paths } from "expo-file-system";
import { XMLParser } from "fast-xml-parser";
import { unzipSync } from "fflate";
import { Buffer } from "buffer";
import formatStyleSheet from "./epub/format-style-sheet";

const EPUB_LIBRARY_DIR_NAME = "epub-library";
const EPUB_INDEX_FILE_NAME = "index.json";
const EPUB_SCHEMA_VERSION = 11;
const COVERAGE_SAMPLE_TEXT_LIMIT = 32000;

const CONTROL_CHARACTERS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/gim;
const SELF_CLOSING_META_LINK_REGEX = /><\/(meta|link)>/gim;
const WRITING_MODE_REGEX = /(?:-epub-|-webkit-)?writing-mode\s*:\s*[^;}{]+;?/gi;
const VENDOR_DECLARATION_REGEX = /(-(?:epub|webkit)-([a-z-]+)\s*:\s*([^;}{]+);)/gi;
const CSS_URL_REGEX = /url\(\s*(['"]?)([^'"()]+)\1\s*\)/gi;
const HTML_ASSET_ATTR_REGEX = /\b(src|href|xlink:href|poster)\s*=\s*(["'])(.*?)\2/gi;
const SCRIPT_TAG_REGEX = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const STYLESHEET_LINK_REGEX = /<link\b[^>]*rel\s*=\s*(["'])?stylesheet\1?[^>]*>/gi;
const BODY_TAG_REGEX = /<body\b[^>]*>([\s\S]*?)<\/body>/i;
const BODY_OPEN_TAG_REGEX = /<body\b([^>]*)>/i;
const HTML_OPEN_TAG_REGEX = /<html\b([^>]*)>/i;
const INTERNAL_HASH_REGEX = /#(.+)$/;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

export interface EpubLibraryItem {
  id: string;
  title: string;
  language: string;
  fileName: string;
  coverUri?: string;
  coverageSampleText?: string;
  importedAt: number;
  updatedAt: number;
  chapterCount: number;
  estimatedPages: number;
  lastReadPage: number;
}

interface StoredEpubBook {
  schemaVersion: number;
  metadata: EpubLibraryItem;
  html?: string;
  htmlUri?: string;
  htmlFileName?: string;
}

interface PersistedEpubBookRecord {
  schemaVersion: number;
  metadata: EpubLibraryItem;
  htmlFileName?: string;
  html?: string;
}

interface ManifestItem {
  id: string;
  href: string;
  path: string;
  mediaType: string;
  properties?: string;
  fallback?: string;
}

interface SpineItem {
  idref: string;
}

interface ChapterReference {
  path: string;
  sectionId: string;
}

interface ParsedEpubResult {
  title: string;
  language: string;
  chapterCount: number;
  html: string;
  coverDataUri: string | null;
  coverageSampleText: string;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  css: "text/css",
  gif: "image/gif",
  htm: "text/html",
  html: "text/html",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  ncx: "application/x-dtbncx+xml",
  otf: "font/otf",
  png: "image/png",
  svg: "image/svg+xml",
  ttf: "font/ttf",
  txt: "text/plain",
  webp: "image/webp",
  woff: "font/woff",
  woff2: "font/woff2",
  xhtml: "application/xhtml+xml",
  xml: "application/xml",
};

const libraryDirectory = new Directory(Paths.document, EPUB_LIBRARY_DIR_NAME);
const indexFile = new File(libraryDirectory, EPUB_INDEX_FILE_NAME);

function normalizePath(inputPath: string): string {
  return inputPath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\//, "");
}

function stripQueryAndHash(value: string): string {
  const [pathPart] = value.split("#");
  return pathPart.split("?")[0] || "";
}

function dirname(filePath: string): string {
  const normalized = normalizePath(filePath);
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex >= 0 ? normalized.slice(0, slashIndex) : "";
}

function resolveWithBase(basePath: string, relativePath: string): string {
  const normalizedRelative = normalizePath(relativePath);

  if (!normalizedRelative) {
    return normalizePath(basePath);
  }

  if (isExternalReference(relativePath)) {
    return relativePath;
  }

  const baseSegments = normalizePath(basePath)
    .split("/")
    .filter(Boolean);
  const parts = [...baseSegments];

  for (const segment of normalizedRelative.split("/")) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      parts.pop();
      continue;
    }

    parts.push(segment);
  }

  return parts.join("/");
}

function resolvePathFromFile(baseFilePath: string, relativePath: string): string {
  return resolveWithBase(dirname(baseFilePath), relativePath);
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function readXml(fileMap: Map<string, Uint8Array>, path: string): string {
  const normalized = normalizePath(path);
  const bytes = fileMap.get(normalized);

  if (!bytes) {
    throw new Error(`Missing required EPUB file: ${normalized}`);
  }

  return decodeUtf8(bytes);
}

function decodeUtf8(data: Uint8Array): string {
  return new TextDecoder("utf-8").decode(data);
}

function isExternalReference(url: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url.trim());
}

function getMediaTypeForPath(path: string, fallback?: string): string {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return fallback || MIME_BY_EXTENSION[extension] || "application/octet-stream";
}

function toDataUri(bytes: Uint8Array, mediaType: string): string {
  return `data:${mediaType};base64,${Buffer.from(bytes).toString("base64")}`;
}

function isImageMediaType(mediaType: string): boolean {
  return mediaType.toLowerCase().startsWith("image/");
}

function getCoverIdFromMetadata(
  metadataRoot: Record<string, unknown> | undefined
): string {
  const metadataEntries = toArray(
    ((metadataRoot?.["opf:meta"] as unknown) ?? metadataRoot?.meta) as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined
  );

  for (const entry of metadataEntries) {
    const name = String(entry?.["@_name"] ?? "")
      .trim()
      .toLowerCase();
    const content = String(entry?.["@_content"] ?? "").trim();

    if (name === "cover" && content) {
      return content;
    }
  }

  return "";
}

function extractCoverDataUri(
  metadataRoot: Record<string, unknown> | undefined,
  manifest: ManifestItem[],
  manifestById: Map<string, ManifestItem>,
  fileMap: Map<string, Uint8Array>
): string | null {
  const candidates: ManifestItem[] = [];
  const candidateIds = new Set<string>();
  const addCandidate = (item: ManifestItem | null | undefined) => {
    if (!item || candidateIds.has(item.id)) {
      return;
    }
    candidateIds.add(item.id);
    candidates.push(item);
  };

  const coverId = getCoverIdFromMetadata(metadataRoot);
  if (coverId) {
    addCandidate(manifestById.get(coverId));
  }

  for (const manifestItem of manifest) {
    const properties = manifestItem.properties?.toLowerCase() ?? "";
    const href = manifestItem.href.toLowerCase();
    const path = manifestItem.path.toLowerCase();
    const id = manifestItem.id.toLowerCase();

    if (properties.split(/\s+/).includes("cover-image")) {
      addCandidate(manifestItem);
      continue;
    }

    if (
      /(?:^|\/)cover(?:[^/]+)?\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(path)
    ) {
      addCandidate(manifestItem);
      continue;
    }

    if (href.includes("cover") || id.includes("cover")) {
      addCandidate(manifestItem);
    }
  }

  for (const candidate of candidates) {
    const bytes = fileMap.get(candidate.path);
    if (!bytes) {
      continue;
    }

    const mediaType = getMediaTypeForPath(candidate.path, candidate.mediaType);
    if (!isImageMediaType(mediaType)) {
      continue;
    }

    return toDataUri(bytes, mediaType);
  }

  return null;
}

function parseDataUri(dataUri: string): { mediaType: string; base64: string } | null {
  const match = /^data:([^;]+);base64,([\s\S]+)$/i.exec(dataUri.trim());
  if (!match) {
    return null;
  }

  return {
    mediaType: match[1].toLowerCase(),
    base64: match[2],
  };
}

function getFileExtensionFromMediaType(mediaType: string): string {
  switch (mediaType.toLowerCase()) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    case "image/avif":
      return "avif";
    default: {
      const clean = mediaType.split("/")[1]?.split("+")[0]?.trim().toLowerCase();
      return clean || "img";
    }
  }
}

function persistCoverFromDataUri(bookId: string, dataUri: string): string | undefined {
  const parsed = parseDataUri(dataUri);

  if (!parsed || !isImageMediaType(parsed.mediaType)) {
    return undefined;
  }

  const extension = getFileExtensionFromMediaType(parsed.mediaType);
  const fileName = `${bookId}-cover.${extension}`;
  const coverFile = new File(libraryDirectory, fileName);

  if (coverFile.exists) {
    coverFile.delete();
  }

  coverFile.create({ intermediates: true, overwrite: true });
  coverFile.write(parsed.base64, { encoding: "base64" });
  return coverFile.uri;
}

function extractMetadataText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const text = extractMetadataText(entry);
      if (text) {
        return text;
      }
    }
    return "";
  }

  if (value && typeof value === "object" && "#text" in value) {
    const textValue = (value as { "#text"?: unknown })["#text"];
    return typeof textValue === "string" ? textValue.trim() : "";
  }

  return "";
}

function canonicalLanguage(language: string): string {
  if (!language) {
    return "ja";
  }

  try {
    const canonical = Intl.getCanonicalLocales(language.trim());
    return canonical[0] || "ja";
  } catch {
    return language.trim() || "ja";
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeCssForReader(cssText: string): string {
  let normalized = cssText.replace(WRITING_MODE_REGEX, "");

  normalized = normalized.replace(VENDOR_DECLARATION_REGEX, (fullMatch, _prefixed, property, value) => {
    if (property.toLowerCase() === "writing-mode") {
      return "";
    }

    return `${fullMatch}\n${property}: ${value};`;
  });

  return normalized;
}

function extractBodyContent(html: string): string {
  const bodyMatch = BODY_TAG_REGEX.exec(html);
  if (bodyMatch?.[1]) {
    return bodyMatch[1];
  }

  return html;
}

function extractCoverageSampleText(htmlFragment: string): string {
  if (!htmlFragment) {
    return "";
  }

  return htmlFragment
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<rt\b[^>]*>[\s\S]*?<\/rt>/gi, " ")
    .replace(/<rp\b[^>]*>[\s\S]*?<\/rp>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function appendCoverageSample(existingSample: string, fragment: string): string {
  if (existingSample.length >= COVERAGE_SAMPLE_TEXT_LIMIT) {
    return existingSample;
  }

  const sampleFragment = extractCoverageSampleText(fragment);
  if (!sampleFragment) {
    return existingSample;
  }

  const merged = existingSample
    ? `${existingSample} ${sampleFragment}`
    : sampleFragment;

  return merged.slice(0, COVERAGE_SAMPLE_TEXT_LIMIT).trim();
}

function getAttributeValue(tagAttributes: string, attributeName: string): string {
  const attributeRegex = new RegExp(
    `${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i"
  );
  const match = attributeRegex.exec(tagAttributes);

  if (!match) {
    return "";
  }

  return (match[1] || match[2] || match[3] || "").trim();
}

function extractChapterShellData(chapterHtml: string): {
  bodyContent: string;
  htmlClass: string;
  bodyClass: string;
  bodyId: string;
} {
  const bodyContent = extractBodyContent(chapterHtml);
  const htmlOpenTagMatch = HTML_OPEN_TAG_REGEX.exec(chapterHtml);
  const bodyOpenTagMatch = BODY_OPEN_TAG_REGEX.exec(chapterHtml);

  const htmlAttributes = htmlOpenTagMatch?.[1] ?? "";
  const bodyAttributes = bodyOpenTagMatch?.[1] ?? "";

  return {
    bodyContent,
    htmlClass: getAttributeValue(htmlAttributes, "class"),
    bodyClass: getAttributeValue(bodyAttributes, "class"),
    bodyId: getAttributeValue(bodyAttributes, "id"),
  };
}

function rewriteCssUrls(
  cssText: string,
  cssFilePath: string,
  getDataUriForPath: (path: string, mediaTypeHint?: string) => string | null
): string {
  return cssText.replace(CSS_URL_REGEX, (fullMatch, _quote, rawPath) => {
    const value = rawPath.trim();

    if (!value || value.startsWith("#") || isExternalReference(value) || value.startsWith("data:")) {
      return fullMatch;
    }

    const target = stripQueryAndHash(value);
    const resolvedPath = resolvePathFromFile(cssFilePath, target);
    const dataUri = getDataUriForPath(resolvedPath);

    if (!dataUri) {
      return fullMatch;
    }

    return `url("${dataUri}")`;
  });
}

function rewriteChapterAssets(
  chapterHtml: string,
  chapterPath: string,
  chapterLookup: Map<string, ChapterReference>,
  getDataUriForPath: (path: string, mediaTypeHint?: string) => string | null
): string {
  let html = chapterHtml
    .replace(CONTROL_CHARACTERS_REGEX, "")
    .replace(SELF_CLOSING_META_LINK_REGEX, ">")
    .replace(SCRIPT_TAG_REGEX, "")
    .replace(STYLESHEET_LINK_REGEX, "");

  html = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_match, cssContent) => {
    const formatted = normalizeCssForReader(
      rewriteCssUrls(cssContent || "", chapterPath, getDataUriForPath)
    );
    return `<style>${formatted}</style>`;
  });

  return html.replace(HTML_ASSET_ATTR_REGEX, (fullMatch, attribute, quote, rawValue) => {
    const value = String(rawValue || "").trim();

    if (!value || value.startsWith("data:") || isExternalReference(value)) {
      return fullMatch;
    }

    const hashMatch = INTERNAL_HASH_REGEX.exec(value);
    const hashValue = hashMatch?.[1] ?? "";
    const targetPath = stripQueryAndHash(value);

    if (attribute.toLowerCase() === "href") {
      if (value.startsWith("#")) {
        return `${attribute}=${quote}${value}${quote}`;
      }

      const resolvedHrefPath = resolvePathFromFile(chapterPath, targetPath);
      const chapterReference = chapterLookup.get(resolvedHrefPath);

      if (chapterReference) {
        const resolvedTarget = hashValue
          ? `#${hashValue}`
          : `#${chapterReference.sectionId}`;
        return `${attribute}=${quote}${resolvedTarget}${quote}`;
      }

      const asDataUri = getDataUriForPath(resolvedHrefPath);
      if (asDataUri) {
        return `${attribute}=${quote}${asDataUri}${quote}`;
      }

      return fullMatch;
    }

    const resolvedAssetPath = resolvePathFromFile(chapterPath, targetPath);
    const dataUri = getDataUriForPath(resolvedAssetPath);

    if (!dataUri) {
      return fullMatch;
    }

    return `${attribute}=${quote}${dataUri}${quote}`;
  });
}

function getReaderRuntimeScript(): string {
  return `      (function () {
        // wk-horizontal-pagination-v14
        const scrollEl = document.getElementById("wk-scroll");
        const contentEl = document.getElementById("wk-content");
        const chip = document.getElementById("wk-page-chip");

        let totalPages = 1;
        let maxScroll = 0;
        let pageSize = 1;
        let pageStep = 1;
        let currentPage = 0;
        let scrollTicking = false;
        let rtlScrollType = "default";
        let isChromeVisible = true;
        let lastLookupTap = null;
        const LOOKUP_HIGHLIGHT_ATTR = "data-wk-lookup-active";
        const LOOKUP_OVERLAY_ROOT_ID = "wk-lookup-overlay-root";

        function postMessage(type, payload) {
          if (!window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) {
            return;
          }

          window.ReactNativeWebView.postMessage(
            JSON.stringify({
              type,
              payload,
            })
          );
        }

        function log() {}

        function clamp(value, min, max) {
          return Math.max(min, Math.min(max, value));
        }

        function detectRtlScrollType() {
          if (!document.body) {
            return "default";
          }

          const probe = document.createElement("div");
          const probeInner = document.createElement("div");

          probe.setAttribute("dir", "rtl");
          probe.style.width = "4px";
          probe.style.height = "1px";
          probe.style.position = "absolute";
          probe.style.top = "-9999px";
          probe.style.overflow = "scroll";
          probe.style.visibility = "hidden";
          probeInner.style.width = "8px";
          probeInner.style.height = "1px";
          probe.appendChild(probeInner);
          document.body.appendChild(probe);

          let detected = "default";
          if (probe.scrollLeft > 0) {
            detected = "default";
          } else {
            probe.scrollLeft = 1;
            detected = probe.scrollLeft === 0 ? "negative" : "reverse";
          }

          document.body.removeChild(probe);
          return detected;
        }

        function applyHorizontalPaginationStyles() {
          if (!scrollEl || !contentEl) {
            return;
          }

          document.documentElement.style.setProperty("--wk-page-gap", "0px");
          scrollEl.style.overflowX = "auto";
          scrollEl.style.overflowY = "hidden";
          scrollEl.style.direction = "rtl";
          contentEl.style.columnCount = "auto";
          contentEl.style.columnWidth = "calc(100vh - 36px)";
          contentEl.style.columnGap = "var(--wk-page-gap)";
          contentEl.style.columnFill = "auto";
          contentEl.style.height = "calc(100vh - 36px)";
          contentEl.style.minHeight = "calc(100vh - 36px)";
          contentEl.style.width = "max-content";
          contentEl.style.maxWidth = "none";
          contentEl.style.display = "block";
          contentEl.style.direction = "ltr";
          contentEl.style.justifyContent = "flex-start";
          contentEl.style.alignItems = "flex-start";
          contentEl.style.alignContent = "flex-start";
        }

        function getViewportWidth() {
          return Math.max(window.innerWidth || (scrollEl ? scrollEl.clientWidth : 1) || 1, 1);
        }

        function getRawMaxScroll() {
          if (!scrollEl) {
            return 0;
          }
          return Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
        }

        function getCurrentOffset() {
          if (!scrollEl) {
            return 0;
          }

          const rawOffset = scrollEl.scrollLeft || 0;
          const rawMax = getRawMaxScroll();

          if (rtlScrollType === "negative") {
            return rawMax + rawOffset;
          }
          if (rtlScrollType === "reverse") {
            return rawMax - rawOffset;
          }
          return rawOffset;
        }

        function scrollToOffset(offset, smooth) {
          if (!scrollEl) {
            return;
          }

          const rawMax = getRawMaxScroll();
          const clampedOffset = clamp(offset, 0, rawMax);
          let targetLeft = clampedOffset;

          if (rtlScrollType === "negative") {
            targetLeft = clampedOffset - rawMax;
          } else if (rtlScrollType === "reverse") {
            targetLeft = rawMax - clampedOffset;
          }

          scrollEl.scrollTo({
            left: targetLeft,
            top: 0,
            behavior: smooth ? "smooth" : "auto",
          });
        }

        function recalculatePageMetrics() {
          if (!scrollEl) {
            return;
          }

          applyHorizontalPaginationStyles();
          pageSize = getViewportWidth();
          maxScroll = getRawMaxScroll();
          totalPages = Math.max(1, Math.floor(maxScroll / pageSize) + 1);
          pageStep = totalPages > 1 ? maxScroll / (totalPages - 1) : pageSize;

          if (!Number.isFinite(pageStep) || pageStep <= 0) {
            pageStep = pageSize;
          }

          currentPage = clamp(currentPage, 0, totalPages - 1);

          log("recalc", {
            pageSize,
            pageStep,
            maxScroll,
            totalPages,
            rtlScrollType,
            scrollWidth: scrollEl.scrollWidth,
            clientWidth: scrollEl.clientWidth,
          });
        }

        function pageToOffset(pageIndex) {
          if (totalPages <= 1) {
            return maxScroll;
          }

          const safeIndex = clamp(pageIndex, 0, totalPages - 1);
          return clamp(maxScroll - safeIndex * pageStep, 0, maxScroll);
        }

        function offsetToPage(offset) {
          if (totalPages <= 1 || pageStep <= 0) {
            return 0;
          }

          const safeOffset = clamp(offset, 0, maxScroll);
          return clamp(Math.round((maxScroll - safeOffset) / pageStep), 0, totalPages - 1);
        }

        function updateChip() {
          if (!chip) {
            return;
          }
          chip.textContent = (currentPage + 1) + " / " + totalPages;
        }

        function updateChromeVisibility() {
          if (!chip) {
            return;
          }
          chip.style.opacity = isChromeVisible ? "1" : "0";
        }

        function emitPageUpdate() {
          updateChip();
          postMessage("page", {
            page: currentPage + 1,
            totalPages,
          });
        }

        function jumpToPage(nextPage, smooth) {
          currentPage = clamp(nextPage, 0, totalPages - 1);
          const targetOffset = pageToOffset(currentPage);
          scrollToOffset(targetOffset, smooth);
          emitPageUpdate();
          log("jumpToPage", {
            targetPage: currentPage + 1,
            totalPages,
            smooth: Boolean(smooth),
            targetOffset,
          });
        }

        function syncPageFromScroll() {
          const inferredPage = offsetToPage(getCurrentOffset());

          if (inferredPage !== currentPage) {
            currentPage = inferredPage;
            emitPageUpdate();
          }
        }

        function nextPage() {
          jumpToPage(currentPage + 1, true);
        }

        function previousPage() {
          jumpToPage(currentPage - 1, true);
        }

        function setTheme(theme) {
          if (!theme || typeof theme !== "object") {
            return;
          }

          const root = document.documentElement;
          if (typeof theme.backgroundColor === "string") {
            root.style.setProperty("--reader-background", theme.backgroundColor);
          }
          if (typeof theme.textColor === "string") {
            root.style.setProperty("--reader-foreground", theme.textColor);
          }
          if (typeof theme.linkColor === "string") {
            root.style.setProperty("--reader-link", theme.linkColor);
          }
          if (typeof theme.chipBackground === "string") {
            root.style.setProperty("--reader-page-chip-bg", theme.chipBackground);
          }
          if (typeof theme.chipTextColor === "string") {
            root.style.setProperty("--reader-page-chip-fg", theme.chipTextColor);
          }
          if (typeof theme.lookupHighlightBackground === "string") {
            root.style.setProperty(
              "--reader-lookup-highlight-bg",
              theme.lookupHighlightBackground
            );
          }
          if (typeof theme.lookupHighlightBorder === "string") {
            root.style.setProperty(
              "--reader-lookup-highlight-border",
              theme.lookupHighlightBorder
            );
          }
          if (typeof theme.lookupHighlightText === "string") {
            root.style.setProperty("--reader-lookup-highlight-fg", theme.lookupHighlightText);
          }
        }

        function openInternalLink(anchor) {
          if (!scrollEl) {
            return false;
          }

          const targetId = anchor.replace(/^#/, "");
          if (!targetId) {
            return false;
          }

          const target = document.getElementById(targetId);
          if (!target) {
            log("openInternalLink miss", { targetId });
            return false;
          }

          target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
          requestAnimationFrame(syncPageFromScroll);
          log("openInternalLink", { targetId });
          return true;
        }

        const LOOKUP_CONTEXT_RADIUS = 180;
        const JAPANESE_CHARACTER_REGEX = /[\u3040-\u30ff\u3400-\u9fff\u3005\u303b\uff66-\uff9f]/;

        function isRubyAnnotationNode(node) {
          if (!node || !node.nodeName) {
            return false;
          }
          const nodeName = node.nodeName.toUpperCase();
          return nodeName === "RT" || nodeName === "RP";
        }

        function resolveTextNodeAtOffset(node, offset) {
          if (!node) {
            return null;
          }

          if (node.nodeType === Node.TEXT_NODE) {
            return {
              node,
              offset: clamp(offset, 0, (node.textContent || "").length),
            };
          }

          const childNodes = node.childNodes ? Array.from(node.childNodes) : [];
          if (childNodes.length === 0) {
            return null;
          }

          const childAtOffset = childNodes[offset];
          const fallbackChild = childAtOffset || childNodes[offset - 1] || childNodes[0];
          if (!fallbackChild) {
            return null;
          }

          if (fallbackChild.nodeType === Node.TEXT_NODE) {
            return {
              node: fallbackChild,
              offset: childAtOffset ? 0 : (fallbackChild.textContent || "").length,
            };
          }

          const textNodeFilter = window.NodeFilter ? NodeFilter.SHOW_TEXT : 4;
          const walker = document.createTreeWalker(fallbackChild, textNodeFilter);
          const firstTextNode = walker.nextNode();
          if (!firstTextNode) {
            return null;
          }

          return {
            node: firstTextNode,
            offset: childAtOffset ? 0 : (firstTextNode.textContent || "").length,
          };
        }

        function getCaretFromPoint(clientX, clientY) {
          if (document.caretPositionFromPoint) {
            const caretPosition = document.caretPositionFromPoint(clientX, clientY);
            if (caretPosition && caretPosition.offsetNode) {
              return resolveTextNodeAtOffset(caretPosition.offsetNode, caretPosition.offset);
            }
          }

          if (document.caretRangeFromPoint) {
            const caretRange = document.caretRangeFromPoint(clientX, clientY);
            if (caretRange && caretRange.startContainer) {
              return resolveTextNodeAtOffset(caretRange.startContainer, caretRange.startOffset);
            }
          }

          return null;
        }

        function adjustCaretToTappedCharacter(textNode, offset, clientX, clientY) {
          if (!textNode || textNode.nodeType !== Node.TEXT_NODE || offset <= 0) {
            return { node: textNode, offset };
          }

          try {
            const previousCharacterRange = document.createRange();
            previousCharacterRange.setStart(textNode, offset - 1);
            previousCharacterRange.setEnd(textNode, offset);
            const characterBounds = previousCharacterRange.getBoundingClientRect();

            if (
              characterBounds &&
              characterBounds.left <= clientX &&
              characterBounds.right >= clientX &&
              characterBounds.top <= clientY &&
              characterBounds.bottom >= clientY
            ) {
              return { node: textNode, offset: offset - 1 };
            }
          } catch (error) {}

          return { node: textNode, offset };
        }

        function collectLookupTextNodes(rootNode, outputNodes) {
          if (!rootNode) {
            return;
          }

          if (rootNode.nodeType === Node.TEXT_NODE) {
            const parentNode = rootNode.parentNode;
            if (!isRubyAnnotationNode(parentNode)) {
              outputNodes.push(rootNode);
            }
            return;
          }

          if (rootNode.nodeType !== Node.ELEMENT_NODE) {
            return;
          }

          if (isRubyAnnotationNode(rootNode)) {
            return;
          }

          const nodeName = rootNode.nodeName ? rootNode.nodeName.toUpperCase() : "";
          if (nodeName === "SCRIPT" || nodeName === "STYLE") {
            return;
          }

          const childNodes = rootNode.childNodes ? Array.from(rootNode.childNodes) : [];
          childNodes.forEach(function (childNode) {
            collectLookupTextNodes(childNode, outputNodes);
          });
        }

        function findLookupContainer(startNode) {
          let currentNode = startNode;
          while (currentNode && currentNode !== contentEl) {
            const nodeName = currentNode.nodeName ? currentNode.nodeName.toUpperCase() : "";
            if (
              nodeName === "P" ||
              nodeName === "LI" ||
              nodeName === "DIV" ||
              nodeName === "SECTION" ||
              nodeName === "ARTICLE" ||
              nodeName === "H1" ||
              nodeName === "H2" ||
              nodeName === "H3" ||
              nodeName === "H4" ||
              nodeName === "H5" ||
              nodeName === "H6" ||
              nodeName === "BLOCKQUOTE"
            ) {
              return currentNode;
            }
            currentNode = currentNode.parentNode;
          }

          return contentEl || document.body;
        }

        function removeLookupOverlayRoot() {
          const overlayRoot = document.getElementById(LOOKUP_OVERLAY_ROOT_ID);
          if (overlayRoot && overlayRoot.parentNode) {
            overlayRoot.parentNode.removeChild(overlayRoot);
          }
        }

        function getLookupOverlayRoot() {
          const existingRoot = document.getElementById(LOOKUP_OVERLAY_ROOT_ID);
          if (existingRoot) {
            existingRoot.innerHTML = "";
            return existingRoot;
          }

          const root = document.createElement("div");
          root.id = LOOKUP_OVERLAY_ROOT_ID;
          root.className = "wk-lookup-overlay-root";
          document.body.appendChild(root);
          return root;
        }

        function clearLookupSelection() {
          removeLookupOverlayRoot();

          const activeHighlights = document.querySelectorAll(
            "span[" + LOOKUP_HIGHLIGHT_ATTR + '="1"]'
          );
          if (!activeHighlights.length) {
            return;
          }

          const parentsToNormalize = [];
          activeHighlights.forEach(function (highlightEl) {
            const parentNode = highlightEl.parentNode;
            if (!parentNode) {
              return;
            }

            parentNode.replaceChild(
              document.createTextNode(highlightEl.textContent || ""),
              highlightEl
            );
            if (parentsToNormalize.indexOf(parentNode) < 0) {
              parentsToNormalize.push(parentNode);
            }
          });

          parentsToNormalize.forEach(function (parentNode) {
            if (parentNode && parentNode.normalize) {
              parentNode.normalize();
            }
          });
        }

        function buildLookupTextEntries(containerNode) {
          const textNodes = [];
          collectLookupTextNodes(containerNode, textNodes);
          if (textNodes.length === 0) {
            return { entries: [], joinedText: "" };
          }

          const entries = [];
          let cursor = 0;
          let joinedText = "";

          textNodes.forEach(function (node) {
            const text = node.textContent || "";
            const start = cursor;
            const end = start + text.length;

            entries.push({
              node,
              start,
              end,
            });
            cursor = end;
            joinedText += text;
          });

          return { entries, joinedText };
        }

        function findBestLookupMatchStart(text, query, anchorIndex) {
          if (!text || !query) {
            return -1;
          }

          let bestStart = -1;
          let bestScore = Number.POSITIVE_INFINITY;
          let searchFrom = 0;

          while (searchFrom <= text.length) {
            const matchStart = text.indexOf(query, searchFrom);
            if (matchStart < 0) {
              break;
            }

            const matchEnd = matchStart + query.length;
            let score = 0;

            if (anchorIndex < matchStart) {
              score = matchStart - anchorIndex;
            } else if (anchorIndex >= matchEnd) {
              score = anchorIndex - (matchEnd - 1);
            } else {
              score = -1000;
            }

            if (score < bestScore) {
              bestScore = score;
              bestStart = matchStart;
              if (score === -1000) {
                break;
              }
            }

            searchFrom = matchStart + 1;
          }

          return bestStart;
        }

        function shouldMergeHighlightRects(a, b) {
          if (!a || !b) {
            return false;
          }

          const horizontalOverlap =
            Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const verticalOverlap =
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          const horizontalGap = Math.max(
            0,
            Math.max(a.left, b.left) - Math.min(a.right, b.right)
          );
          const verticalGap = Math.max(
            0,
            Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom)
          );

          const verticalFlowMatch =
            horizontalOverlap >= Math.min(a.width, b.width) * 0.4 && verticalGap <= 4;
          const horizontalFlowMatch =
            verticalOverlap >= Math.min(a.height, b.height) * 0.4 && horizontalGap <= 4;
          const touchesOrOverlaps = horizontalGap <= 1 && verticalGap <= 1;

          return touchesOrOverlaps || verticalFlowMatch || horizontalFlowMatch;
        }

        function mergeHighlightRects(rects) {
          if (!rects.length) {
            return [];
          }

          const mergedRects = [];
          rects.forEach(function (rect) {
            if (!rect) {
              return;
            }

            let merged = false;
            for (let i = 0; i < mergedRects.length; i += 1) {
              const current = mergedRects[i];
              if (!shouldMergeHighlightRects(current, rect)) {
                continue;
              }

              const nextLeft = Math.min(current.left, rect.left);
              const nextTop = Math.min(current.top, rect.top);
              const nextRight = Math.max(current.right, rect.right);
              const nextBottom = Math.max(current.bottom, rect.bottom);

              mergedRects[i] = {
                left: nextLeft,
                top: nextTop,
                right: nextRight,
                bottom: nextBottom,
                width: nextRight - nextLeft,
                height: nextBottom - nextTop,
              };
              merged = true;
              break;
            }

            if (!merged) {
              mergedRects.push({
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
              });
            }
          });

          // One extra pass catches chains: A merges B, then AB merges C.
          let changed = true;
          while (changed) {
            changed = false;
            for (let i = 0; i < mergedRects.length; i += 1) {
              for (let j = i + 1; j < mergedRects.length; j += 1) {
                if (!shouldMergeHighlightRects(mergedRects[i], mergedRects[j])) {
                  continue;
                }

                const a = mergedRects[i];
                const b = mergedRects[j];
                const nextLeft = Math.min(a.left, b.left);
                const nextTop = Math.min(a.top, b.top);
                const nextRight = Math.max(a.right, b.right);
                const nextBottom = Math.max(a.bottom, b.bottom);

                mergedRects[i] = {
                  left: nextLeft,
                  top: nextTop,
                  right: nextRight,
                  bottom: nextBottom,
                  width: nextRight - nextLeft,
                  height: nextBottom - nextTop,
                };
                mergedRects.splice(j, 1);
                changed = true;
                break;
              }
              if (changed) {
                break;
              }
            }
          }

          return mergedRects;
        }

        function applyLookupHighlight(entries, startOffset, endOffset) {
          if (!entries.length || endOffset <= startOffset) {
            return false;
          }

          const overlayRoot = getLookupOverlayRoot();
          let didHighlight = false;
          const rawRects = [];

          entries.forEach(function (entry) {
            if (!entry || !entry.node) {
              return;
            }

            if (entry.end <= startOffset || entry.start >= endOffset) {
              return;
            }

            const nodeText = entry.node.textContent || "";
            const localStart = clamp(startOffset - entry.start, 0, nodeText.length);
            const localEnd = clamp(endOffset - entry.start, 0, nodeText.length);

            if (localEnd <= localStart) {
              return;
            }

            const range = document.createRange();
            try {
              range.setStart(entry.node, localStart);
              range.setEnd(entry.node, localEnd);
            } catch (error) {
              return;
            }

            const rects = Array.from(range.getClientRects());
            rects.forEach(function (rect) {
              if (!rect || rect.width <= 0 || rect.height <= 0) {
                return;
              }
              rawRects.push({
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
              });
            });
          });

          const mergedRects = mergeHighlightRects(rawRects);
          mergedRects.forEach(function (rect) {
            if (!rect || rect.width <= 0 || rect.height <= 0) {
              return;
            }

            const overlay = document.createElement("span");
            overlay.className = "wk-lookup-overlay";
            overlay.style.left = rect.left + "px";
            overlay.style.top = rect.top + "px";
            overlay.style.width = rect.width + "px";
            overlay.style.height = rect.height + "px";
            overlayRoot.appendChild(overlay);
            didHighlight = true;
          });

          if (!didHighlight) {
            removeLookupOverlayRoot();
          }

          return didHighlight;
        }

        function setLookupSelection(selection) {
          clearLookupSelection();

          if (!selection || typeof selection !== "object" || !lastLookupTap) {
            return;
          }

          const targetTextRaw = typeof selection.text === "string" ? selection.text : "";
          const targetText = targetTextRaw.trim();
          const lookupContainer = lastLookupTap.container;

          if (!lookupContainer || !lookupContainer.isConnected) {
            return;
          }

          const { entries, joinedText } = buildLookupTextEntries(lookupContainer);
          if (!entries.length || !joinedText) {
            return;
          }

          const fallbackIndex = Number(lastLookupTap.absoluteIndex);
          const anchorIndex = clamp(
            Number.isFinite(fallbackIndex) ? fallbackIndex : 0,
            0,
            Math.max(joinedText.length - 1, 0)
          );

          let highlightStart = anchorIndex;
          let highlightEnd = anchorIndex + 1;

          if (targetText) {
            const bestMatchStart = findBestLookupMatchStart(joinedText, targetText, anchorIndex);
            if (bestMatchStart >= 0) {
              highlightStart = bestMatchStart;
              highlightEnd = bestMatchStart + targetText.length;
            }
          }

          highlightStart = clamp(highlightStart, 0, joinedText.length);
          highlightEnd = clamp(Math.max(highlightEnd, highlightStart + 1), 0, joinedText.length);

          applyLookupHighlight(entries, highlightStart, highlightEnd);
        }

        function buildWordTapPayload(event) {
          const caret = getCaretFromPoint(event.clientX, event.clientY);
          if (!caret || !caret.node) {
            return null;
          }

          const adjustedCaret = adjustCaretToTappedCharacter(
            caret.node,
            caret.offset,
            event.clientX,
            event.clientY
          );

          if (!adjustedCaret.node || adjustedCaret.node.nodeType !== Node.TEXT_NODE) {
            return null;
          }

          const lookupContainer = findLookupContainer(adjustedCaret.node);
          if (!lookupContainer) {
            return null;
          }

          const textNodes = [];
          collectLookupTextNodes(lookupContainer, textNodes);
          if (textNodes.length === 0) {
            return null;
          }

          const indexByNode = new Map();
          let joinedText = "";

          textNodes.forEach(function (node) {
            indexByNode.set(node, joinedText.length);
            joinedText += node.textContent || "";
          });

          if (!joinedText) {
            return null;
          }

          const nodePrefix = indexByNode.get(adjustedCaret.node);
          if (typeof nodePrefix !== "number") {
            return null;
          }

          const nodeTextLength = (adjustedCaret.node.textContent || "").length;
          const safeNodeOffset = clamp(adjustedCaret.offset, 0, nodeTextLength);
          const absoluteIndex = clamp(
            nodePrefix + safeNodeOffset,
            0,
            Math.max(joinedText.length - 1, 0)
          );

          const tappedCharacter = joinedText.charAt(absoluteIndex) || "";
          if (!JAPANESE_CHARACTER_REGEX.test(tappedCharacter)) {
            return null;
          }

          const start = Math.max(0, absoluteIndex - LOOKUP_CONTEXT_RADIUS);
          const end = Math.min(joinedText.length, absoluteIndex + LOOKUP_CONTEXT_RADIUS + 1);
          const contextText = joinedText.slice(start, end);
          if (!contextText) {
            return null;
          }

          lastLookupTap = {
            container: lookupContainer,
            absoluteIndex,
          };

          return {
            text: contextText,
            index: absoluteIndex - start,
            character: tappedCharacter,
          };
        }

        function normalizeTextAlignment() {
          if (!contentEl || !window.getComputedStyle) {
            return;
          }

          let normalizedCount = 0;
          const textNodes = contentEl.querySelectorAll(
            "p, div, section, article, li, blockquote, span, h1, h2, h3, h4, h5, h6"
          );

          textNodes.forEach(function (node) {
            const styles = window.getComputedStyle(node);
            const computedTextAlign = (styles.textAlign || "").toLowerCase();
            const computedTextAlignLast = (styles.textAlignLast || "").toLowerCase();
            let updated = false;

            if (computedTextAlign === "right" || computedTextAlign === "end") {
              node.style.setProperty("text-align", "start", "important");
              updated = true;
            }

            if (computedTextAlignLast === "right" || computedTextAlignLast === "end") {
              node.style.setProperty("text-align-last", "start", "important");
              updated = true;
            }

            if (updated) {
              normalizedCount += 1;
            }
          });

          log("normalizeTextAlignment", { normalizedCount });
        }

        function normalizeTextFlow() {
          if (!contentEl || !window.getComputedStyle) {
            return;
          }

          let normalizedCount = 0;
          const contentNodes = contentEl.querySelectorAll(
            "p, div, section, article, li, blockquote, span, h1, h2, h3, h4, h5, h6"
          );

          contentNodes.forEach(function (node) {
            const styles = window.getComputedStyle(node);
            const hasMediaDescendant = Boolean(
              node.querySelector &&
                node.querySelector("img, svg, video, canvas, iframe, object, embed")
            );
            let updated = false;

            const display = (styles.display || "").toLowerCase();
            if (!hasMediaDescendant && (display === "flex" || display === "inline-flex")) {
              node.style.setProperty("display", "block", "important");
              updated = true;
            }

            const justifyContent = (styles.justifyContent || "").toLowerCase();
            if (justifyContent === "flex-end" || justifyContent === "end") {
              node.style.setProperty("justify-content", "flex-start", "important");
              updated = true;
            }

            const alignItems = (styles.alignItems || "").toLowerCase();
            if (alignItems === "flex-end" || alignItems === "end") {
              node.style.setProperty("align-items", "flex-start", "important");
              updated = true;
            }

            const alignContent = (styles.alignContent || "").toLowerCase();
            if (alignContent === "flex-end" || alignContent === "end") {
              node.style.setProperty("align-content", "flex-start", "important");
              updated = true;
            }

            const verticalAlign = (styles.verticalAlign || "").toLowerCase();
            if (verticalAlign === "bottom" || verticalAlign === "text-bottom") {
              node.style.setProperty("vertical-align", "top", "important");
              updated = true;
            }

            const direction = (styles.direction || "").toLowerCase();
            if (direction === "rtl") {
              node.style.setProperty("direction", "ltr", "important");
              updated = true;
            }

            if (updated) {
              normalizedCount += 1;
            }
          });

          log("normalizeTextFlow", { normalizedCount });
        }

        function normalizeContainerFlow() {
          if (!contentEl) {
            return;
          }

          const nodes = [contentEl].concat(Array.from(contentEl.querySelectorAll(".wk-epub-section")));

          nodes.forEach(function (node) {
            node.style.setProperty("display", "block", "important");
            node.style.setProperty("direction", "ltr", "important");
            node.style.setProperty("justify-content", "flex-start", "important");
            node.style.setProperty("align-items", "flex-start", "important");
            node.style.setProperty("align-content", "flex-start", "important");
            node.style.setProperty("vertical-align", "top", "important");
            node.style.setProperty("margin-top", "0", "important");
            node.style.setProperty("padding-top", "0", "important");
          });

          log("normalizeContainerFlow", { normalizedCount: nodes.length });
        }

        function logDirectionDiagnostics() {
          if (!scrollEl || !contentEl || !window.getComputedStyle) {
            return;
          }

          const scrollStyles = window.getComputedStyle(scrollEl);
          const contentStyles = window.getComputedStyle(contentEl);
          const sampleNode = contentEl.querySelector("p, div, span, li");
          const sampleStyles = sampleNode ? window.getComputedStyle(sampleNode) : null;

          log("directionDiagnostics", {
            scrollDirection: scrollStyles.direction,
            scrollWritingMode: scrollStyles.writingMode || null,
            contentDirection: contentStyles.direction,
            contentWritingMode: contentStyles.writingMode || null,
            sampleDirection: sampleStyles ? sampleStyles.direction : null,
            sampleWritingMode: sampleStyles ? sampleStyles.writingMode || null : null,
            sampleTextAlign: sampleStyles ? sampleStyles.textAlign : null,
            sampleDisplay: sampleStyles ? sampleStyles.display : null,
          });
        }

        window.__WK_EPUB__ = {
          next: nextPage,
          prev: previousPage,
          goTo: function (pageNumber, smooth) {
            const normalizedPageNumber = Number(pageNumber);
            const shouldSmooth = typeof smooth === "boolean" ? smooth : false;
            log("goTo()", { pageNumber: normalizedPageNumber, smooth: shouldSmooth });

            if (!Number.isFinite(normalizedPageNumber)) {
              return;
            }

            jumpToPage(normalizedPageNumber - 1, shouldSmooth);
          },
          recalc: function () {
            applyHorizontalPaginationStyles();
            const ratio = totalPages > 1 ? currentPage / (totalPages - 1) : 0;
            recalculatePageMetrics();
            currentPage = Math.round(ratio * Math.max(totalPages - 1, 0));
            jumpToPage(currentPage, false);
          },
          getPageInfo: function () {
            return {
              page: currentPage + 1,
              totalPages,
            };
          },
          setTheme,
          setChromeVisible: function (visible) {
            isChromeVisible = Boolean(visible);
            updateChromeVisibility();
          },
          setLookupSelection,
          clearLookupSelection,
        };

        document.addEventListener("click", function (event) {
          const target = event.target;
          const anchor = target && target.closest ? target.closest("a[href]") : null;

          if (anchor) {
            const href = anchor.getAttribute("href") || "";
            if (href.startsWith("#")) {
              event.preventDefault();
              openInternalLink(href);
            }
            return;
          }

          const wordTapPayload = buildWordTapPayload(event);
          if (wordTapPayload) {
            postMessage("wordTap", wordTapPayload);
            return;
          }

          postMessage("toggleChrome");
        });

        if (scrollEl) {
          scrollEl.addEventListener(
            "scroll",
            function () {
              if (scrollTicking) {
                return;
              }

              scrollTicking = true;
              requestAnimationFrame(function () {
                syncPageFromScroll();
                scrollTicking = false;
              });
            },
            { passive: true }
          );
        }

        window.addEventListener("resize", function () {
          log("resize");
          applyHorizontalPaginationStyles();
          const ratio = totalPages > 1 ? currentPage / (totalPages - 1) : 0;
          recalculatePageMetrics();
          currentPage = Math.round(ratio * Math.max(totalPages - 1, 0));
          jumpToPage(currentPage, false);
        });

        function scheduleRecalculate(reason) {
          requestAnimationFrame(function () {
            applyHorizontalPaginationStyles();
            recalculatePageMetrics();
            emitPageUpdate();
            log("scheduleRecalculate", { reason, currentPage: currentPage + 1, totalPages });
          });
        }

        function initialize() {
          if (!scrollEl || !contentEl) {
            postMessage("error", { message: "EPUB container not available" });
            return;
          }

          applyHorizontalPaginationStyles();
          rtlScrollType = detectRtlScrollType();
          normalizeTextAlignment();
          normalizeTextFlow();
          normalizeContainerFlow();
          logDirectionDiagnostics();

          log("initialize", {
            hasScroll: Boolean(scrollEl),
            hasContent: Boolean(contentEl),
            contentChildren: contentEl.children.length,
            rtlScrollType,
          });

          const images = contentEl.querySelectorAll("img");
          images.forEach(function (img) {
            if (!img.complete) {
              img.addEventListener(
                "load",
                function () {
                  scheduleRecalculate("image-load");
                },
                { once: true }
              );
              img.addEventListener(
                "error",
                function () {
                  scheduleRecalculate("image-error");
                },
                { once: true }
              );
            }
          });

          if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () {
              scheduleRecalculate("fonts-ready");
            });
          }

          recalculatePageMetrics();
          const requestedInitialPage = Number(window.__WK_EPUB_INITIAL_PAGE__);
          const safeInitialPage = Number.isFinite(requestedInitialPage)
            ? clamp(Math.floor(requestedInitialPage), 1, totalPages)
            : 1;

          currentPage = safeInitialPage - 1;
          jumpToPage(currentPage, false);
          updateChromeVisibility();

          postMessage("ready", {
            page: currentPage + 1,
            totalPages,
          });

          setTimeout(function () {
            scheduleRecalculate("post-init-timeout");
          }, 120);
        }

        if (document.readyState === "complete" || document.readyState === "interactive") {
          requestAnimationFrame(initialize);
        } else {
          document.addEventListener("DOMContentLoaded", initialize, { once: true });
        }
      })();`;
}

function buildReaderDocument(title: string, compiledStyles: string, sectionsMarkup: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        --reader-background: #0f1117;
        --reader-foreground: #f3f5f7;
        --reader-link: #58a6ff;
        --reader-page-chip-bg: rgba(15, 17, 23, 0.66);
        --reader-page-chip-fg: #f3f5f7;
        --reader-lookup-highlight-bg: rgba(88, 166, 255, 0.28);
        --reader-lookup-highlight-border: rgba(88, 166, 255, 0.55);
        --reader-lookup-highlight-fg: inherit;
        --wk-page-gap: 0px;
      }

      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: var(--reader-background);
        color: var(--reader-foreground);
      }

      body {
        font-family: "SourceHanSansJP-Regular", "Hiragino Sans", "Noto Sans JP", -apple-system,
          BlinkMacSystemFont, "Segoe UI", sans-serif;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }

      #wk-scroll {
        position: relative;
        box-sizing: border-box;
        height: 100vh;
        width: 100vw;
        padding: 18px;
        overflow-x: auto;
        overflow-y: hidden;
        direction: rtl;
        writing-mode: vertical-rl;
        text-orientation: mixed;
        font-size: 1rem;
        line-height: 1.8;
      }

      #wk-scroll::-webkit-scrollbar {
        width: 0;
        height: 0;
      }

      #wk-scroll {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      #wk-content {
        column-width: calc(100vh - 36px);
        column-gap: var(--wk-page-gap);
        column-fill: auto;
        direction: ltr;
        width: max-content;
        max-width: none;
        height: calc(100vh - 36px);
        min-height: calc(100vh - 36px);
      }

      #wk-scroll,
      #wk-scroll * {
        color: inherit;
      }

      #wk-scroll img,
      #wk-scroll svg,
      #wk-scroll video,
      #wk-scroll canvas,
      #wk-scroll iframe {
        writing-mode: horizontal-tb !important;
        direction: ltr !important;
        display: block;
        break-inside: avoid;
        max-inline-size: 100% !important;
        max-width: 100% !important;
        max-height: calc(100vh - 72px) !important;
        width: auto !important;
        height: auto !important;
        object-fit: contain !important;
        object-position: center center;
        margin: 0 auto;
      }

      #wk-scroll a {
        color: var(--reader-link);
        text-decoration: none;
      }

      .wk-lookup-overlay-root {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 2147482500;
      }

      .wk-lookup-overlay {
        position: absolute;
        background: var(--reader-lookup-highlight-bg);
        box-shadow: inset 0 0 0 1px var(--reader-lookup-highlight-border);
        border-radius: 0.28em;
      }

      .wk-epub-section {
        break-after: column;
        page-break-after: always;
      }

      .wk-epub-section:last-child {
        break-after: auto;
      }

      #wk-scroll p {
        margin-right: 0.25rem;
        margin-left: 0.25rem;
      }

      #wk-content p,
      #wk-content div,
      #wk-content section,
      #wk-content article,
      #wk-content li,
      #wk-content blockquote,
      #wk-content span,
      #wk-content h1,
      #wk-content h2,
      #wk-content h3,
      #wk-content h4,
      #wk-content h5,
      #wk-content h6 {
        text-align: start !important;
        text-align-last: start !important;
        justify-content: flex-start !important;
        align-items: flex-start !important;
        align-content: flex-start !important;
        vertical-align: top !important;
      }

      #wk-page-chip {
        position: fixed;
        bottom: 14px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2147483000;
        padding: 6px 12px;
        border-radius: 999px;
        font-size: 12px;
        letter-spacing: 0.03em;
        background: var(--reader-page-chip-bg);
        color: var(--reader-page-chip-fg);
        backdrop-filter: blur(8px);
        pointer-events: none;
        transition: opacity 180ms ease;
      }

      ${compiledStyles}
    </style>
  </head>
  <body>
    <main id="wk-scroll">
      <div id="wk-content">${sectionsMarkup}</div>
    </main>
    <div id="wk-page-chip">1 / 1</div>
    <script>
${getReaderRuntimeScript()}
    </script>
  </body>
</html>`;
}

function migrateReaderHtml(html: string): string {
  let migratedHtml = html;

  migratedHtml = migratedHtml.replace(/const PAGE_GAP = 40;\s*/g, "");
  migratedHtml = migratedHtml.replace(
    /const step = pageSize \+ PAGE_GAP;\s*totalPages = Math\.max\(1, Math\.ceil\(\(maxScroll \+ 1\) \/ step\)\);/g,
    "totalPages = Math.max(1, Math.floor(maxScroll / pageSize) + 1);"
  );
  migratedHtml = migratedHtml.replace(
    /const step = pageSize \+ PAGE_GAP;\s*return clamp\(clamp\(pageIndex, 0, totalPages - 1\) \* step, 0, maxScroll\);/g,
    "return clamp(clamp(pageIndex, 0, totalPages - 1) * pageSize, 0, maxScroll);"
  );
  migratedHtml = migratedHtml.replace(
    /const step = pageSize \+ PAGE_GAP;\s*return clamp\(Math\.round\(offset \/ step\), 0, totalPages - 1\);/g,
    "return clamp(Math.round(offset / pageSize), 0, totalPages - 1);"
  );

  if (!migratedHtml.includes("wk-horizontal-pagination-v14")) {
    const runtimeScriptTag = `<script>\n${getReaderRuntimeScript()}\n    </script>`;

    const replacedRuntimeScript = migratedHtml.replace(
      /<script>\s*\(function \(\) \{[\s\S]*?\}\)\(\);\s*<\/script>/,
      runtimeScriptTag
    );

    if (replacedRuntimeScript !== migratedHtml) {
      migratedHtml = replacedRuntimeScript;
    } else {
      const replacedGenericScript = migratedHtml.replace(
        /<script\b[^>]*>[\s\S]*?<\/script>/,
        runtimeScriptTag
      );
      if (replacedGenericScript !== migratedHtml) {
        migratedHtml = replacedGenericScript;
      } else if (migratedHtml.includes("</body>")) {
        migratedHtml = migratedHtml.replace("</body>", `    ${runtimeScriptTag}\n  </body>`);
      } else {
        migratedHtml += `\n${runtimeScriptTag}\n`;
      }
    }
  }

  return migratedHtml;
}

function readFileMapFromArchive(fileBytes: Uint8Array): Map<string, Uint8Array> {
  const archive = unzipSync(fileBytes);
  const map = new Map<string, Uint8Array>();

  for (const [name, value] of Object.entries(archive)) {
    const normalizedName = normalizePath(name);
    if (!normalizedName || normalizedName.endsWith("/")) {
      continue;
    }
    map.set(normalizedName, value);
  }

  return map;
}

function getPackageRoot(parsedOpf: Record<string, unknown>) {
  return (
    (parsedOpf["opf:package"] as Record<string, unknown> | undefined) ??
    (parsedOpf.package as Record<string, unknown> | undefined)
  );
}

function getManifestItems(packageRoot: Record<string, unknown>, opfDirectory: string): ManifestItem[] {
  const manifestRoot =
    (packageRoot["opf:manifest"] as Record<string, unknown> | undefined) ??
    (packageRoot.manifest as Record<string, unknown> | undefined);

  const rawItems = toArray(
    ((manifestRoot?.["opf:item"] as unknown) ?? manifestRoot?.item) as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined
  );

  return rawItems
    .map((item) => {
      const href = String(item["@_href"] ?? "").trim();
      const id = String(item["@_id"] ?? "").trim();
      const mediaType = String(item["@_media-type"] ?? "").trim();

      if (!href || !id || !mediaType) {
        return null;
      }

      const manifestItem: ManifestItem = {
        id,
        href,
        path: resolveWithBase(opfDirectory, href),
        mediaType,
      };

      if (typeof item["@_properties"] === "string") {
        manifestItem.properties = item["@_properties"];
      }

      if (typeof item["@_fallback"] === "string") {
        manifestItem.fallback = item["@_fallback"];
      }

      return manifestItem;
    })
    .filter((item): item is ManifestItem => Boolean(item));
}

function getSpineItems(packageRoot: Record<string, unknown>): SpineItem[] {
  const spineRoot =
    (packageRoot["opf:spine"] as Record<string, unknown> | undefined) ??
    (packageRoot.spine as Record<string, unknown> | undefined);

  const rawRefs = toArray(
    ((spineRoot?.["opf:itemref"] as unknown) ?? spineRoot?.itemref) as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined
  );

  return rawRefs
    .map((item) => {
      const idref = String(item["@_idref"] ?? "").trim();
      if (!idref) {
        return null;
      }
      return { idref };
    })
    .filter((item): item is SpineItem => Boolean(item));
}

function parseEpubDocument(fileBytes: Uint8Array, fileName: string): ParsedEpubResult {
  const fileMap = readFileMapFromArchive(fileBytes);
  const containerXml = readXml(fileMap, "META-INF/container.xml");
  const parsedContainer = parser.parse(containerXml) as Record<string, any>;

  const rootFileCandidates = toArray(
    parsedContainer?.container?.rootfiles?.rootfile as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined
  );

  const opfPath =
    rootFileCandidates
      .map((entry) => String(entry["@_full-path"] ?? "").trim())
      .find(Boolean) || "";

  if (!opfPath) {
    throw new Error("Unable to locate OPF file in EPUB container.xml");
  }

  const parsedOpf = parser.parse(readXml(fileMap, opfPath)) as Record<string, unknown>;
  const packageRoot = getPackageRoot(parsedOpf);

  if (!packageRoot) {
    throw new Error("Invalid OPF format: package root not found");
  }

  const opfDirectory = dirname(opfPath);
  const manifest = getManifestItems(packageRoot, opfDirectory);
  const spine = getSpineItems(packageRoot);

  if (!manifest.length || !spine.length) {
    throw new Error("EPUB manifest or spine is empty");
  }

  const metadataRoot =
    (packageRoot["opf:metadata"] as Record<string, unknown> | undefined) ??
    (packageRoot.metadata as Record<string, unknown> | undefined);

  const title =
    extractMetadataText(metadataRoot?.["dc:title"]) || fileName.replace(/\.epub$/i, "").trim();
  const language = canonicalLanguage(extractMetadataText(metadataRoot?.["dc:language"]));

  const manifestById = new Map(manifest.map((item) => [item.id, item]));
  const manifestByPath = new Map(manifest.map((item) => [item.path, item]));
  const coverDataUri = extractCoverDataUri(metadataRoot, manifest, manifestById, fileMap);

  const chapterReferences: ChapterReference[] = [];

  for (let i = 0; i < spine.length; i += 1) {
    const spineItem = spine[i];
    const manifestItem = manifestById.get(spineItem.idref);

    if (!manifestItem) {
      continue;
    }

    const targetManifest = manifestItem?.fallback
      ? manifestById.get(manifestItem.fallback) ?? manifestItem
      : manifestItem;

    if (!targetManifest) {
      continue;
    }

    if (
      targetManifest.mediaType !== "application/xhtml+xml" &&
      targetManifest.mediaType !== "text/html" &&
      targetManifest.mediaType !== "application/xml"
    ) {
      continue;
    }

    chapterReferences.push({
      path: targetManifest.path,
      sectionId: `wk-epub-section-${chapterReferences.length + 1}`,
    });
  }

  if (!chapterReferences.length) {
    throw new Error("EPUB does not contain readable HTML chapters");
  }

  const chapterLookup = new Map(chapterReferences.map((chapter) => [chapter.path, chapter]));
  const dataUriCache = new Map<string, string>();

  const getDataUriForPath = (path: string, mediaTypeHint?: string): string | null => {
    const normalizedPath = normalizePath(path);

    if (!normalizedPath || isExternalReference(normalizedPath)) {
      return null;
    }

    const cached = dataUriCache.get(normalizedPath);
    if (cached) {
      return cached;
    }

    const bytes = fileMap.get(normalizedPath);
    if (!bytes) {
      return null;
    }

    const mediaType = getMediaTypeForPath(
      normalizedPath,
      mediaTypeHint || manifestByPath.get(normalizedPath)?.mediaType
    );
    const dataUri = toDataUri(bytes, mediaType);
    dataUriCache.set(normalizedPath, dataUri);
    return dataUri;
  };

  const rawStylesheet = manifest
    .filter((item) => item.mediaType === "text/css")
    .map((cssItem) => {
      const cssBytes = fileMap.get(cssItem.path);
      if (!cssBytes) {
        return "";
      }

      const decodedCss = decodeUtf8(cssBytes);
      const cssWithRebasedUrls = rewriteCssUrls(decodedCss, cssItem.path, getDataUriForPath);
      return normalizeCssForReader(cssWithRebasedUrls);
    })
    .filter(Boolean)
    .join("\n\n");

  const stylesheet = formatStyleSheet(rawStylesheet, "#wk-scroll");
  let coverageSampleText = "";

  const sectionsMarkup = chapterReferences
    .map((chapter, chapterIndex) => {
      const chapterBytes = fileMap.get(chapter.path);

      if (!chapterBytes) {
        return "";
      }

      const chapterText = decodeUtf8(chapterBytes);
      const shellData = extractChapterShellData(chapterText);
      coverageSampleText = appendCoverageSample(coverageSampleText, shellData.bodyContent);
      const rewritten = rewriteChapterAssets(
        shellData.bodyContent,
        chapter.path,
        chapterLookup,
        getDataUriForPath
      );

      const htmlClass = shellData.htmlClass
        ? ` ttu-book-html-wrapper ${shellData.htmlClass}`
        : " ttu-book-html-wrapper";
      const bodyClass = shellData.bodyClass
        ? ` ttu-book-body-wrapper ${shellData.bodyClass}`
        : " ttu-book-body-wrapper";
      const bodyIdAttribute = shellData.bodyId ? ` id="${escapeHtml(shellData.bodyId)}"` : "";

      return `<section class="wk-epub-section" id="${chapter.sectionId}" data-wk-index="${chapterIndex + 1}">
  <div class="${htmlClass.trim()}">
    <div class="${bodyClass.trim()}"${bodyIdAttribute}>${rewritten}</div>
  </div>
</section>`;
    })
    .filter(Boolean)
    .join("\n");

  const html = buildReaderDocument(title, stylesheet, sectionsMarkup);

  return {
    title,
    language,
    chapterCount: chapterReferences.length,
    html,
    coverDataUri,
    coverageSampleText,
  };
}

async function ensureLibraryReady(): Promise<void> {
  libraryDirectory.create({ intermediates: true, idempotent: true });

  if (!indexFile.exists) {
    indexFile.create({ intermediates: true, overwrite: true });
    indexFile.write("[]");
  }
}

async function readIndex(): Promise<EpubLibraryItem[]> {
  await ensureLibraryReady();

  try {
    const indexContent = await indexFile.text();
    const parsed = JSON.parse(indexContent) as EpubLibraryItem[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry) => entry && typeof entry.id === "string")
      .sort((left, right) => right.updatedAt - left.updatedAt);
  } catch (error) {
    console.error("Failed to read EPUB index:", error);
    return [];
  }
}

async function writeIndex(entries: EpubLibraryItem[]): Promise<void> {
  await ensureLibraryReady();
  indexFile.write(JSON.stringify(entries, null, 2));
}

function getBookFile(bookId: string): File {
  return new File(libraryDirectory, `${bookId}.json`);
}

function getBookHtmlFileName(bookId: string): string {
  return `${bookId}.html`;
}

function getBookHtmlFile(bookId: string, htmlFileName?: string): File {
  return new File(libraryDirectory, htmlFileName || getBookHtmlFileName(bookId));
}

function createBookId(): string {
  return `epub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isPickerCancellation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return /cancel|canceled|cancelled|abort/i.test(message);
}

async function saveStoredBook(book: StoredEpubBook): Promise<void> {
  const bookId = book.metadata.id;
  const destination = getBookFile(bookId);
  const htmlFileName = (book.htmlFileName || getBookHtmlFileName(bookId)).trim();
  const htmlFile = getBookHtmlFile(bookId, htmlFileName);

  if (typeof book.html === "string") {
    if (!htmlFile.exists) {
      htmlFile.create({ intermediates: true, overwrite: true });
    }
    htmlFile.write(book.html);
  } else if (!htmlFile.exists) {
    throw new Error(`Missing HTML payload for EPUB book ${bookId}`);
  }

  const persistedRecord: PersistedEpubBookRecord = {
    schemaVersion: EPUB_SCHEMA_VERSION,
    metadata: book.metadata,
    htmlFileName,
  };

  if (!destination.exists) {
    destination.create({ intermediates: true, overwrite: true });
  }
  destination.write(JSON.stringify(persistedRecord));
}

export const epubLibraryService = {
  async importFromPicker(): Promise<EpubLibraryItem | null> {
    try {
      const result = await File.pickFileAsync(undefined, "application/epub+zip");
      const pickedFile = Array.isArray(result) ? result[0] : result;

      if (!pickedFile) {
        return null;
      }

      return this.importFromFile(pickedFile);
    } catch (error) {
      if (isPickerCancellation(error)) {
        return null;
      }

      throw error;
    }
  },

  async importFromFile(file: File): Promise<EpubLibraryItem> {
    await ensureLibraryReady();

    const bytes = await file.bytes();
    const parsed = parseEpubDocument(bytes, file.name || "Untitled EPUB");
    const now = Date.now();
    const bookId = createBookId();
    const coverUri = parsed.coverDataUri
      ? persistCoverFromDataUri(bookId, parsed.coverDataUri)
      : undefined;

    const metadata: EpubLibraryItem = {
      id: bookId,
      title: parsed.title,
      language: parsed.language,
      fileName: file.name,
      coverUri,
      coverageSampleText: parsed.coverageSampleText,
      importedAt: now,
      updatedAt: now,
      chapterCount: parsed.chapterCount,
      estimatedPages: 0,
      lastReadPage: 1,
    };

    await saveStoredBook({
      schemaVersion: EPUB_SCHEMA_VERSION,
      metadata,
      html: parsed.html,
    });

    const currentIndex = await readIndex();
    const nextIndex = [metadata, ...currentIndex.filter((entry) => entry.id !== metadata.id)];
    await writeIndex(nextIndex);

    return metadata;
  },

  async listBooks(): Promise<EpubLibraryItem[]> {
    return readIndex();
  },

  async getBook(bookId: string): Promise<StoredEpubBook | null> {
    await ensureLibraryReady();

    const file = getBookFile(bookId);
    if (!file.exists) {
      return null;
    }

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as PersistedEpubBookRecord;

      if (!parsed || typeof parsed !== "object" || !parsed.metadata) {
        return null;
      }

      const htmlFileName = String(parsed.htmlFileName || getBookHtmlFileName(bookId)).trim();
      const htmlFile = getBookHtmlFile(bookId, htmlFileName);
      const hasLegacyEmbeddedHtml = typeof parsed.html === "string";
      const hasHtmlFile = htmlFile.exists;
      let resolvedHtmlUri: string | undefined;

      if (hasLegacyEmbeddedHtml) {
        const migratedHtml = migrateReaderHtml(parsed.html as string);
        await saveStoredBook({
          schemaVersion: EPUB_SCHEMA_VERSION,
          metadata: parsed.metadata,
          html: migratedHtml,
          htmlFileName,
        });
        resolvedHtmlUri = htmlFile.uri;
      } else if (hasHtmlFile) {
        if (parsed.schemaVersion !== EPUB_SCHEMA_VERSION) {
          const existingHtml = await htmlFile.text();
          const migratedHtml = migrateReaderHtml(existingHtml);
          if (migratedHtml !== existingHtml) {
            htmlFile.write(migratedHtml);
          }
        }

        if (
          parsed.schemaVersion !== EPUB_SCHEMA_VERSION ||
          !parsed.htmlFileName ||
          parsed.htmlFileName !== htmlFileName
        ) {
          await saveStoredBook({
            schemaVersion: EPUB_SCHEMA_VERSION,
            metadata: parsed.metadata,
            htmlUri: htmlFile.uri,
            htmlFileName,
          });
        }

        resolvedHtmlUri = htmlFile.uri;
      } else {
        return null;
      }

      return {
        schemaVersion: EPUB_SCHEMA_VERSION,
        metadata: parsed.metadata,
        htmlUri: resolvedHtmlUri,
        htmlFileName,
      };
    } catch (error) {
      console.error(`Failed to parse EPUB book ${bookId}:`, error);
      return null;
    }
  },

  async deleteBook(bookId: string): Promise<void> {
    await ensureLibraryReady();
    const currentIndex = await readIndex();
    const targetEntry = currentIndex.find((entry) => entry.id === bookId);

    const target = getBookFile(bookId);
    let htmlFileToDelete = getBookHtmlFile(bookId);

    if (target.exists) {
      target.delete();
    }

    if (htmlFileToDelete.exists) {
      htmlFileToDelete.delete();
    }

    if (targetEntry?.coverUri) {
      const coverFile = new File(targetEntry.coverUri);
      if (coverFile.exists) {
        coverFile.delete();
      }
    }

    await writeIndex(currentIndex.filter((entry) => entry.id !== bookId));
  },

  async updateReadingProgress(
    bookId: string,
    page: number,
    totalPages: number
  ): Promise<void> {
    const normalizedPage = Math.max(1, Math.floor(page || 1));
    const normalizedTotal = Math.max(1, Math.floor(totalPages || 1));

    const stored = await this.getBook(bookId);
    if (!stored) {
      return;
    }

    const updatedMetadata: EpubLibraryItem = {
      ...stored.metadata,
      lastReadPage: normalizedPage,
      estimatedPages: normalizedTotal,
      updatedAt: Date.now(),
    };

    await saveStoredBook({
      ...stored,
      metadata: updatedMetadata,
    });

    const index = await readIndex();
    const updatedIndex = index
      .map((entry) => (entry.id === bookId ? updatedMetadata : entry))
      .sort((left, right) => right.updatedAt - left.updatedAt);

    await writeIndex(updatedIndex);
  },
};

export type EpubStoredBook = StoredEpubBook;
