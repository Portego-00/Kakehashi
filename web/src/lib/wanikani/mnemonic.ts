const MNEMONIC_TAGS = ["em", "i", "radical", "kanji", "vocabulary", "meaning", "reading", "ja", "a"] as const;

type MnemonicTag = (typeof MNEMONIC_TAGS)[number];

export type MnemonicTokenType = "text" | "em" | "radical" | "kanji" | "vocabulary" | "meaning" | "reading";

export interface MnemonicToken {
  type: MnemonicTokenType;
  text: string;
  language?: "ja";
  href?: string;
}

const KNOWN_TAGS = new Set<string>(MNEMONIC_TAGS);
const TAG_ALIASES: Record<string, MnemonicTag> = { erading: "reading" };

function decodeNumericEntity(rawValue: string, radix: 10 | 16, fallback: string) {
  const codePoint = Number.parseInt(rawValue, radix);
  if (!Number.isFinite(codePoint)) return fallback;
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return fallback;
  }
}

export function decodeMnemonicEntities(value: string) {
  return value
    .replace(/&amp;/giu, "&")
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&apos;|&#39;/giu, "'")
    .replace(/&#x([0-9a-f]+);/giu, (match, hexValue: string) => decodeNumericEntity(hexValue, 16, match))
    .replace(/&#(\d+);/gu, (match, decimalValue: string) => decodeNumericEntity(decimalValue, 10, match));
}

function resolveTagName(rawName: string): MnemonicTag | null {
  const normalizedName = rawName.trim().toLowerCase();
  return TAG_ALIASES[normalizedName] ?? (KNOWN_TAGS.has(normalizedName) ? normalizedName as MnemonicTag : null);
}

export function normalizeMnemonicMarkup(value: string) {
  return decodeMnemonicEntities(value)
    .replace(/\breading>([^<>]*?)\/erading>/giu, "<reading>$1</reading>")
    .replace(/\breading>([^<>]*?)\/reading>/giu, "<reading>$1</reading>")
    .replace(/<\s*\/\s*erading\s*>/giu, "</reading>")
    .replace(/<\s*erading(\s[^>]*)?>/giu, "<reading$1>");
}

function tokenTypeForTags(tags: MnemonicTag[]): MnemonicTokenType {
  const styledTag = tags.findLast((tag) => tag !== "ja" && tag !== "a");
  if (styledTag === "i") return "em";
  return styledTag ?? "text";
}

function safeLinkFromAttributes(attributes: string) {
  const match = attributes.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/iu);
  const href = (match?.[1] ?? match?.[2] ?? match?.[3])?.trim();
  if (!href) return undefined;
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:" ? href : undefined;
  } catch {
    return undefined;
  }
}

export function tokenizeMnemonic(value: string): MnemonicToken[] {
  if (!value) return [];
  const source = normalizeMnemonicMarkup(value);
  const tokens: MnemonicToken[] = [];
  const openTags: Array<{ tag: MnemonicTag; href?: string }> = [];
  const tagPattern = /<\s*(\/?)\s*([a-z][\w-]*)\b([^>]*)>/giu;
  let cursor = 0;
  let match: RegExpExecArray | null;

  const appendText = (text: string) => {
    if (!text) return;
    const tags = openTags.map(({ tag }) => tag);
    const type = tokenTypeForTags(tags);
    const language = tags.includes("ja") ? "ja" : undefined;
    const href = openTags.findLast(({ tag }) => tag === "a")?.href;
    const previous = tokens.at(-1);
    if (previous?.type === type && previous.language === language && previous.href === href) previous.text += text;
    else tokens.push({ type, text, ...(language ? { language } : {}), ...(href ? { href } : {}) });
  };

  while ((match = tagPattern.exec(source))) {
    appendText(source.slice(cursor, match.index));
    cursor = tagPattern.lastIndex;
    const tag = resolveTagName(match[2]);
    if (!tag) continue;
    if (match[1] === "/") {
      const matchingIndex = openTags.findLastIndex((entry) => entry.tag === tag);
      if (matchingIndex >= 0) openTags.splice(matchingIndex);
    } else if (!/\/\s*$/u.test(match[3] ?? "")) {
      openTags.push({ tag, ...(tag === "a" ? { href: safeLinkFromAttributes(match[3] ?? "") } : {}) });
    }
  }

  appendText(source.slice(cursor));
  return tokens;
}

export function stripMnemonicMarkup(value: string) {
  return tokenizeMnemonic(value).map((token) => token.text).join("");
}
