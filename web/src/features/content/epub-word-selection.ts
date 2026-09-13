import { containsJapanese, segmentJapaneseText } from "./annotation";

const LOOKUP_CONTAINER_NAMES = new Set([
  "ARTICLE",
  "BLOCKQUOTE",
  "DIV",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "LI",
  "P",
  "SECTION",
]);
const SKIPPED_TEXT_NAMES = new Set(["NOSCRIPT", "RP", "RT", "SCRIPT", "STYLE", "TEXTAREA"]);
const TAP_OFFSET_SCAN_ORDER = [0, -1, 1, -2, 2] as const;

export interface EpubTextEntry {
  node: Text;
  start: number;
  end: number;
}

export interface EpubWordSelectionRequest {
  id: string;
  text: string;
  index: number;
  surface: string;
  sourceId?: string;
}

export interface EpubWordSelectionAnchor {
  container: Element;
  document: Document;
  entries: EpubTextEntry[];
  joinedText: string;
  absoluteIndex: number;
  initialStart: number;
  initialEnd: number;
  request: EpubWordSelectionRequest;
}

interface CaretPoint {
  node: Text;
  offset: number;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function nodeName(node: Node | null | undefined) {
  return node?.nodeName?.toLocaleUpperCase() ?? "";
}

function isSkippedTextNode(node: Node) {
  let current: Node | null = node.parentNode;
  while (current && current.nodeType === 1) {
    if (SKIPPED_TEXT_NAMES.has(nodeName(current))) return true;
    current = current.parentNode;
  }
  return false;
}

function collectTextNodes(root: Node, output: Text[]) {
  if (root.nodeType === 3) {
    if (!isSkippedTextNode(root) && root.textContent) output.push(root as Text);
    return;
  }
  if (root.nodeType !== 1 || SKIPPED_TEXT_NAMES.has(nodeName(root))) return;
  for (const child of Array.from(root.childNodes)) collectTextNodes(child, output);
}

function firstRubyBaseTextNode(startNode: Node) {
  let ruby: Node | null = startNode.parentNode;
  while (ruby && nodeName(ruby) !== "RUBY") ruby = ruby.parentNode;
  if (!ruby) return null;
  const nodes: Text[] = [];
  collectTextNodes(ruby, nodes);
  return nodes[0] ?? null;
}

function resolveTextNodeAtOffset(document: Document, node: Node | null, offset: number): CaretPoint | null {
  if (!node) return null;
  if (node.nodeType === 3) {
    const textNode = node as Text;
    return { node: textNode, offset: clamp(offset, 0, textNode.data.length) };
  }
  const children = Array.from(node.childNodes);
  const childAtOffset = children[offset];
  const fallback = childAtOffset ?? children[offset - 1] ?? children[0];
  if (!fallback) return null;
  if (fallback.nodeType === 3) {
    const textNode = fallback as Text;
    return { node: textNode, offset: childAtOffset ? 0 : textNode.data.length };
  }
  const walker = document.createTreeWalker(fallback, 4);
  const textNode = walker.nextNode();
  if (!textNode) return null;
  return { node: textNode as Text, offset: childAtOffset ? 0 : (textNode.textContent?.length ?? 0) };
}

export function epubCaretFromPoint(document: Document, clientX: number, clientY: number): CaretPoint | null {
  const caretDocument = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const position = caretDocument.caretPositionFromPoint?.(clientX, clientY);
  if (position?.offsetNode) return resolveTextNodeAtOffset(document, position.offsetNode, position.offset);
  const range = caretDocument.caretRangeFromPoint?.(clientX, clientY);
  return range ? resolveTextNodeAtOffset(document, range.startContainer, range.startOffset) : null;
}

export function adjustEpubCaretToTappedCharacter(
  document: Document,
  caret: CaretPoint,
  clientX: number,
  clientY: number,
): CaretPoint | null {
  const offsets = [...new Set([caret.offset, caret.offset - 1])]
    .filter((offset) => offset >= 0 && offset < caret.node.data.length);
  for (const offset of offsets) {
    try {
      const character = document.createRange();
      character.setStart(caret.node, offset);
      character.setEnd(caret.node, offset + 1);
      const rectangles = typeof character.getClientRects === "function"
        ? Array.from(character.getClientRects())
        : [character.getBoundingClientRect()];
      if (rectangles.some((bounds) => (
        bounds.width > 0
        && bounds.height > 0
        && bounds.left <= clientX
        && bounds.right >= clientX
        && bounds.top <= clientY
        && bounds.bottom >= clientY
      ))) return { node: caret.node, offset };
    } catch {
      // A malformed chapter can expose a stale caret while EPUB.js is relocating.
    }
  }
  return null;
}

export function epubLookupContainer(startNode: Node, contentRoot: Element) {
  let current: Node | null = startNode.nodeType === 1 ? startNode : startNode.parentNode;
  while (current && current !== contentRoot) {
    if (LOOKUP_CONTAINER_NAMES.has(nodeName(current))) return current as Element;
    current = current.parentNode;
  }
  return contentRoot;
}

function textEntries(nodes: Text[]) {
  let cursor = 0;
  const entries = nodes.map((node) => {
    const start = cursor;
    cursor += node.data.length;
    return { node, start, end: cursor };
  });
  return { entries, joinedText: nodes.map((node) => node.data).join("") };
}

export function epubTextEntries(container: Node) {
  const nodes: Text[] = [];
  collectTextNodes(container, nodes);
  return textEntries(nodes);
}

function epubLookupTextEntries(container: Element, contentRoot: Element) {
  const nodes: Text[] = [];
  collectTextNodes(container, nodes);
  return textEntries(nodes.filter((node) => epubLookupContainer(node, contentRoot) === container));
}

export function epubLookupTextSources(contentRoot: Element) {
  const textNodes: Text[] = [];
  collectTextNodes(contentRoot, textNodes);
  const containers = new Set<Element>();
  for (const textNode of textNodes) {
    if (textNode.data.trim()) containers.add(epubLookupContainer(textNode, contentRoot));
  }
  return [...containers].flatMap((container) => {
    const source = epubLookupTextEntries(container, contentRoot);
    return containsJapanese(source.joinedText) ? [{ container, text: source.joinedText }] : [];
  });
}

function japaneseWordAtOffset(text: string, offset: number) {
  for (const delta of TAP_OFFSET_SCAN_ORDER) {
    const candidate = clamp(offset + delta, 0, Math.max(0, text.length - 1));
    const segment = segmentJapaneseText(text).find((segment) => (
      segment.japanese
      && segment.wordLike
      && candidate >= segment.start
      && candidate < segment.end
    ));
    if (segment) return segment;
  }
  return null;
}

export function buildEpubWordSelection(
  document: Document,
  contentRoot: Element,
  caretNode: Text,
  caretOffset: number,
  requestId: string,
): EpubWordSelectionAnchor | null {
  const container = epubLookupContainer(caretNode, contentRoot);
  const { entries, joinedText } = epubLookupTextEntries(container, contentRoot);
  if (!entries.length || !joinedText) return null;

  let mappedNode = caretNode;
  if (isSkippedTextNode(mappedNode)) {
    const rubyBase = firstRubyBaseTextNode(mappedNode);
    if (!rubyBase) return null;
    mappedNode = rubyBase;
    caretOffset = 0;
  }
  const entry = entries.find((candidate) => candidate.node === mappedNode);
  if (!entry) return null;
  const absoluteIndex = clamp(entry.start + caretOffset, 0, Math.max(0, joinedText.length - 1));
  if (!containsJapanese(joinedText.charAt(absoluteIndex))) return null;
  const word = japaneseWordAtOffset(joinedText, absoluteIndex);
  if (!word) return null;

  return {
    container,
    document,
    entries,
    joinedText,
    absoluteIndex,
    initialStart: word.start,
    initialEnd: word.end,
    request: {
      id: requestId,
      text: joinedText,
      index: absoluteIndex,
      surface: word.text,
    },
  };
}

export function nearestEpubTermRange(text: string, term: string, anchorIndex: number) {
  const query = term.trim();
  if (!text || !query) return null;
  let start = text.indexOf(query);
  let best: { start: number; end: number; distance: number } | null = null;
  while (start >= 0) {
    const end = start + query.length;
    const distance = anchorIndex < start ? start - anchorIndex : anchorIndex >= end ? anchorIndex - end + 1 : -1;
    if (!best || distance < best.distance) best = { start, end, distance };
    if (distance === -1) break;
    start = text.indexOf(query, start + 1);
  }
  return best ? { start: best.start, end: best.end } : null;
}

export function epubRangesForOffsets(anchor: EpubWordSelectionAnchor, start: number, end: number) {
  return anchor.entries.flatMap((entry) => {
    if (entry.end <= start || entry.start >= end) return [];
    const localStart = clamp(start - entry.start, 0, entry.node.data.length);
    const localEnd = clamp(end - entry.start, 0, entry.node.data.length);
    if (localEnd <= localStart) return [];
    const range = anchor.document.createRange();
    range.setStart(entry.node, localStart);
    range.setEnd(entry.node, localEnd);
    return [range];
  });
}

export function isEpubLookupIgnoredTarget(target: EventTarget | null) {
  let current = target && typeof target === "object" && "nodeType" in target ? target as Node : null;
  const ignored = new Set(["A", "AUDIO", "BUTTON", "CANVAS", "EMBED", "IFRAME", "IMG", "INPUT", "OBJECT", "SELECT", "SVG", "TEXTAREA", "VIDEO"]);
  if (current?.nodeType === 3) current = current.parentNode;
  while (current && current.nodeType === 1) {
    if (ignored.has(nodeName(current))) return true;
    current = current.parentNode;
  }
  return false;
}
