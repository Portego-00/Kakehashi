const WANI_KANI_MNEMONIC_TAGS = [
  "em",
  "radical",
  "kanji",
  "vocabulary",
  "reading",
  "ja",
] as const;

type WaniKaniMnemonicTag = (typeof WANI_KANI_MNEMONIC_TAGS)[number];

export type WaniKaniMnemonicTokenType =
  | "text"
  | "em"
  | "radical"
  | "kanji"
  | "vocabulary"
  | "reading";

export interface WaniKaniMnemonicToken {
  type: WaniKaniMnemonicTokenType;
  text: string;
}

const KNOWN_TAGS = new Set<string>(WANI_KANI_MNEMONIC_TAGS);

const TAG_ALIASES: Record<string, WaniKaniMnemonicTag> = {
  erading: "reading",
};

function decodeNumericEntity(
  rawValue: string,
  radix: 10 | 16,
  fallback: string,
): string {
  const codePoint = Number.parseInt(rawValue, radix);
  if (!Number.isFinite(codePoint)) {
    return fallback;
  }

  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return fallback;
  }
}

export function decodeWaniKaniMnemonicEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (match, hexValue: string) =>
      decodeNumericEntity(hexValue, 16, match),
    )
    .replace(/&#(\d+);/g, (match, decimalValue: string) =>
      decodeNumericEntity(decimalValue, 10, match),
    );
}

function resolveMnemonicTagName(rawName: string): WaniKaniMnemonicTag | null {
  const normalizedName = rawName.trim().toLowerCase();
  const aliasedName = TAG_ALIASES[normalizedName];
  if (aliasedName) {
    return aliasedName;
  }

  return KNOWN_TAGS.has(normalizedName)
    ? (normalizedName as WaniKaniMnemonicTag)
    : null;
}

export function normalizeWaniKaniMnemonicMarkup(value: string): string {
  return decodeWaniKaniMnemonicEntities(value)
    .replace(/\breading>([^<>]*?)\/erading>/gi, "<reading>$1</reading>")
    .replace(/\breading>([^<>]*?)\/reading>/gi, "<reading>$1</reading>")
    .replace(/<\s*\/\s*erading\s*>/gi, "</reading>")
    .replace(/<\s*erading(\s[^>]*)?>/gi, "<reading$1>");
}

function tokenTypeForTag(
  tag: WaniKaniMnemonicTag | undefined,
): WaniKaniMnemonicTokenType {
  return tag && tag !== "ja" ? tag : "text";
}

export function tokenizeWaniKaniMnemonic(
  mnemonic: string,
): WaniKaniMnemonicToken[] {
  if (!mnemonic) {
    return [];
  }

  const source = normalizeWaniKaniMnemonicMarkup(mnemonic);
  const tokens: WaniKaniMnemonicToken[] = [];
  const openTagStack: WaniKaniMnemonicTag[] = [];
  const tagRegex = /<\s*(\/?)\s*([a-z][\w-]*)\b([^>]*)>/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;

  const appendText = (text: string) => {
    if (!text) {
      return;
    }

    const type = tokenTypeForTag(openTagStack[openTagStack.length - 1]);
    const previousToken = tokens[tokens.length - 1];
    if (previousToken?.type === type) {
      previousToken.text += text;
      return;
    }

    tokens.push({ type, text });
  };

  while ((match = tagRegex.exec(source)) !== null) {
    appendText(source.slice(cursor, match.index));
    cursor = tagRegex.lastIndex;

    const isClosingTag = match[1] === "/";
    const tagName = resolveMnemonicTagName(match[2]);
    if (!tagName) {
      continue;
    }

    if (isClosingTag) {
      const matchingIndex = openTagStack.lastIndexOf(tagName);
      if (matchingIndex >= 0) {
        openTagStack.splice(matchingIndex);
      }
      continue;
    }

    const attributes = match[3] ?? "";
    const isSelfClosing = /\/\s*$/.test(attributes);
    if (!isSelfClosing) {
      openTagStack.push(tagName);
    }
  }

  appendText(source.slice(cursor));
  return tokens;
}

export function stripWaniKaniMnemonicMarkup(mnemonic: string): string {
  return tokenizeWaniKaniMnemonic(mnemonic)
    .map((token) => token.text)
    .join("");
}
