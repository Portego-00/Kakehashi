type MnemonicAsset =
  | { kind: "svg"; svgXml: string }
  | { kind: "raster" };

const documentMnemonicImageCache: Record<string, string | null> = {};
const mnemonicAssetCache: Record<string, MnemonicAsset> = {};

const mnemonicWebComponentRegex =
  /<wk-mnemonic-image[^>]*\ssrc=(?:"([^"]+)"|'([^']+)')[^>]*>/i;
const mnemonicImgFallbackRegex =
  /<img[^>]*class=(?:"[^"]*subject-mnemonic-image__image[^"]*"|'[^']*subject-mnemonic-image__image[^']*')[^>]*\ssrc=(?:"([^"]+)"|'([^']+)')[^>]*>/i;

function looksLikeSvgContent(content: string): boolean {
  return (
    /^\s*<svg[\s>]/i.test(content) ||
    (/^\s*<\?xml/i.test(content) && content.includes("<svg"))
  );
}

export function extractMnemonicImageUrl(html: string): string | null {
  const mnemonicComponentMatch = html.match(mnemonicWebComponentRegex);
  const componentUrl =
    mnemonicComponentMatch?.[1] || mnemonicComponentMatch?.[2];
  if (componentUrl) return componentUrl;

  const fallbackImageMatch = html.match(mnemonicImgFallbackRegex);
  return fallbackImageMatch?.[1] || fallbackImageMatch?.[2] || null;
}

export async function getMnemonicImageUrlFromDocument(
  documentUrl: string
): Promise<string | null> {
  if (!documentUrl) return null;
  if (documentUrl in documentMnemonicImageCache) {
    return documentMnemonicImageCache[documentUrl];
  }

  try {
    const response = await fetch(documentUrl);
    const html = await response.text();
    const imageUrl = extractMnemonicImageUrl(html)?.replace(/^@/, "") || null;
    documentMnemonicImageCache[documentUrl] = imageUrl;
    return imageUrl;
  } catch {
    documentMnemonicImageCache[documentUrl] = null;
    return null;
  }
}

export async function getMnemonicImageAsset(
  imageUrl: string
): Promise<MnemonicAsset> {
  if (imageUrl in mnemonicAssetCache) {
    return mnemonicAssetCache[imageUrl];
  }

  const response = await fetch(imageUrl);
  const contentType = response.headers.get("content-type") || "";

  if (/svg/i.test(contentType)) {
    const text = await response.text();
    const svgAsset: MnemonicAsset = { kind: "svg", svgXml: text };
    mnemonicAssetCache[imageUrl] = svgAsset;
    return svgAsset;
  }

  if (/^image\//i.test(contentType)) {
    const rasterAsset: MnemonicAsset = { kind: "raster" };
    mnemonicAssetCache[imageUrl] = rasterAsset;
    return rasterAsset;
  }

  const text = await response.text();
  if (looksLikeSvgContent(text)) {
    const svgAsset: MnemonicAsset = { kind: "svg", svgXml: text };
    mnemonicAssetCache[imageUrl] = svgAsset;
    return svgAsset;
  }

  const rasterAsset: MnemonicAsset = { kind: "raster" };
  mnemonicAssetCache[imageUrl] = rasterAsset;
  return rasterAsset;
}

function parseSvgColorToRgb(value: string): { r: number; g: number; b: number } | null {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "black") return { r: 0, g: 0, b: 0 };
  if (trimmed === "white") return { r: 255, g: 255, b: 255 };

  const hexMatch = trimmed.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3 || hex.length === 4) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    if (hex.length >= 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
  }

  const rgbMatch = trimmed.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*[0-9.]+\s*)?\)$/i
  );
  if (rgbMatch) {
    return {
      r: Math.max(0, Math.min(255, Number(rgbMatch[1]))),
      g: Math.max(0, Math.min(255, Number(rgbMatch[2]))),
      b: Math.max(0, Math.min(255, Number(rgbMatch[3]))),
    };
  }

  return null;
}

function isLowLuminanceColor(value: string): boolean {
  const rgb = parseSvgColorToRgb(value);
  if (!rgb) return false;
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance < 0.2;
}

function normalizeSvgCssValue(
  property: string,
  value: string,
  textColor: string,
  isDark: boolean,
  contrastColor: string
): string {
  let normalized = value.trim();

  if (
    /^none$/i.test(normalized) ||
    /^transparent$/i.test(normalized) ||
    /^url\(/i.test(normalized)
  ) {
    return normalized;
  }

  normalized = normalized.replace(/var\(--color-text[^)]*\)/gi, textColor);
  normalized = normalized.replace(/var\(--text-color[^)]*\)/gi, textColor);
  if (/^currentcolor$/i.test(normalized)) {
    normalized = textColor;
  }

  if (
    isDark &&
    (property === "fill" || property === "stroke") &&
    isLowLuminanceColor(normalized)
  ) {
    return contrastColor;
  }

  return normalized;
}

export function inlineSvgClassStyles(
  rawSvg: string,
  textColor: string,
  isDark: boolean,
  contrastColor: string
): string {
  if (!rawSvg) return rawSvg;
  let svg = rawSvg;
  const styleBlocks: string[] = [];

  svg = svg.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_m, css) => {
    styleBlocks.push(String(css || ""));
    return "";
  });

  const classStyleMap: Record<string, Record<string, string>> = {};
  for (const css of styleBlocks) {
    const classBlockRegex = /\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g;
    let classMatch: RegExpExecArray | null;
    while ((classMatch = classBlockRegex.exec(css)) !== null) {
      const className = classMatch[1];
      const declarationBlock = classMatch[2];
      const styleObj: Record<string, string> = {};

      declarationBlock.split(";").forEach((declaration) => {
        const separatorIndex = declaration.indexOf(":");
        if (separatorIndex === -1) return;
        const rawKey = declaration.slice(0, separatorIndex).trim().toLowerCase();
        const rawValue = declaration.slice(separatorIndex + 1).trim();
        if (!rawKey || !rawValue) return;
        styleObj[rawKey] = normalizeSvgCssValue(
          rawKey,
          rawValue,
          textColor,
          isDark,
          contrastColor
        );
      });

      if (Object.keys(styleObj).length > 0) {
        classStyleMap[className] = {
          ...(classStyleMap[className] || {}),
          ...styleObj,
        };
      }
    }
  }

  const propertiesToInline = [
    "fill",
    "fill-opacity",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-miterlimit",
    "stroke-opacity",
    "opacity",
  ];

  svg = svg.replace(
    /<([a-zA-Z][\w:-]*)([^>]*?)\sclass=(?:"([^"]+)"|'([^']+)')([^>]*)>/g,
    (full, tag, before, classInDoubleQuotes, classInSingleQuotes, after) => {
      const classValue = (classInDoubleQuotes || classInSingleQuotes || "").trim();
      if (!classValue) return full;
      const classNames = classValue.split(/\s+/).filter(Boolean);
      if (!classNames.length) return full;

      const mergedStyles: Record<string, string> = {};
      classNames.forEach((className: string) => {
        if (classStyleMap[className]) {
          Object.assign(mergedStyles, classStyleMap[className]);
        }
      });

      if (!Object.keys(mergedStyles).length) return full;

      const existingAttributes = `${before}${after}`;
      const attributesToInject: string[] = [];
      propertiesToInline.forEach((property) => {
        const attrRegex = new RegExp(
          `\\s${property.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}=`,
          "i"
        );
        if (!attrRegex.test(existingAttributes) && mergedStyles[property]) {
          attributesToInject.push(` ${property}="${mergedStyles[property]}"`);
        }
      });

      if (!attributesToInject.length) return full;
      return `<${tag}${before}${attributesToInject.join("")} class="${classValue}"${after}>`;
    }
  );

  if (isDark) {
    svg = svg.replace(/\s(fill|stroke)="([^"]+)"/gi, (_match, property, rawValue) => {
      const normalizedValue = normalizeSvgCssValue(
        String(property).toLowerCase(),
        String(rawValue),
        textColor,
        isDark,
        contrastColor
      );
      return ` ${property}="${normalizedValue}"`;
    });

    svg = svg.replace(
      /<(path|circle|ellipse|rect|polygon|polyline|line)([^>]*?)(\/?)>/gi,
      (full, tag, attrs = "", selfClosing = "") => {
        if (/\sfill=/i.test(attrs) || /\sstroke=/i.test(attrs)) return full;
        const isLineLike = /^(line|polyline)$/i.test(String(tag));
        const injected = isLineLike
          ? ` stroke="${contrastColor}" fill="none"`
          : ` fill="${contrastColor}"`;
        return `<${tag}${attrs}${injected}${selfClosing}>`;
      }
    );
  }

  if (!/<svg[^>]*\sxmlns=/.test(svg)) {
    svg = svg.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  return svg;
}
