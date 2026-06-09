import React from 'react';

// Cache for downloaded SVG XML strings
const svgCache: Record<string, string> = {};

/**
 * WaniKani radicals often rely on CSS in <style> blocks, which react-native-svg doesn't support.
 * This function removes styles, inlines common class-based attributes, and applies sensible
 * defaults so the glyph renders correctly in RN. It also normalizes colors to the provided color.
 */
function sanitizeSvg(raw: string, color: string = '#3c9bff'): string {
  let out = raw;

  // Collect and strip <style> blocks while keeping their content for inlining
  const styleBlocks: string[] = [];
  out = out.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_m, css) => {
    styleBlocks.push(String(css || ''));
    return '';
  });

  // Build a simple className -> style map from style blocks
  const classStyleMap: Record<string, Record<string, string>> = {};
  const classBlockRegex = /\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g;
  for (const css of styleBlocks) {
    let m: RegExpExecArray | null;
    // Normalize CSS var colors inside css values too
    const normalizedCss = css.replace(/var\(--color-text,[^)]+\)/gi, color);
    while ((m = classBlockRegex.exec(normalizedCss)) !== null) {
      const className = m[1];
      const declarations = m[2];
      const styleObj: Record<string, string> = {};
      declarations.split(';').forEach(pair => {
        const [key, val] = pair.split(':').map(s => s && s.trim());
        if (key && val) {
          let value = val;
          if (/^#000000?$/i.test(value)) value = color; // black → color
          if (/var\(/i.test(value)) value = color; // var(...) → color
          styleObj[key.toLowerCase()] = value;
        }
      });
      if (Object.keys(styleObj).length) {
        classStyleMap[className] = {
          ...(classStyleMap[className] || {}),
          ...styleObj,
        };
      }
    }
  }

  // Convert any inline style attributes clip-path:url(#id) → clip-path="url(#id)"
  out = out.replace(
    /style="[^"]*clip-path:url\((#[^)]+)\)[^"]*"/gi,
    (_match, id) => `clip-path="url(${id})"`,
  );

  // Inline known class styles into element attributes
  out = out.replace(/<([a-zA-Z]+)([^>]*?)class="([^"]+)"([^>]*?)>/g, (full, tag, before, classAttr, after) => {
    const existing = `${before}${after}`;
    const classNames = classAttr.split(/\s+/).filter(Boolean);
    const merged: Record<string, string> = {};
    for (const cn of classNames) {
      if (classStyleMap[cn]) {
        Object.assign(merged, classStyleMap[cn]);
      }
    }

    const attrs: string[] = [];
    const ensure = (attr: string, value: string, presenceRegex: RegExp) => {
      if (!presenceRegex.test(existing)) attrs.push(` ${attr}="${value}"`);
    };

    if (merged['stroke']) ensure('stroke', merged['stroke'].includes('var(') ? color : merged['stroke'], /\sstroke=/i);
    if (merged['stroke-width']) ensure('stroke-width', merged['stroke-width'].replace(/px$/i, ''), /stroke-width=/i);
    if (merged['stroke-linecap']) ensure('stroke-linecap', merged['stroke-linecap'], /stroke-linecap=/i);
    if (merged['stroke-miterlimit']) ensure('stroke-miterlimit', merged['stroke-miterlimit'], /stroke-miterlimit=/i);
    if (merged['fill']) ensure('fill', merged['fill'].includes('var(') ? 'none' : merged['fill'], /\sfill=/i);
    if (merged['clip-path']) {
      const cp = merged['clip-path'].replace(/^url\((#[^)]+)\).*$/, 'url($1)');
      ensure('clip-path', cp, /clip-path=/i);
    }

    // If class names look like common WaniKani radicals (a/b), add sensible defaults
    if (
      (classNames.includes('b') ||
        classNames.some((n: string) => /cls|st/i.test(n))) &&
      !/\sstroke=/i.test(existing)
    ) {
      attrs.push(` stroke="${color}"`);
      if (!/stroke-width=/i.test(existing)) attrs.push(' stroke-width="68"');
      if (!/stroke-linecap=/i.test(existing)) attrs.push(' stroke-linecap="square"');
      if (!/stroke-miterlimit=/i.test(existing)) attrs.push(' stroke-miterlimit="2"');
      if (!/\sfill=/i.test(existing)) attrs.push(' fill="none"');
    }

    if (!attrs.length) return full; // nothing to change
    return `<${tag}${before}${attrs.join('')} class="${classAttr}"${after}>`;
  });

  // Final fallbacks:
  // - Replace any direct black stroke with the provided color
  out = out.replace(/stroke="#000"/gi, `stroke="${color}"`);
  out = out.replace(/stroke="#000000"/gi, `stroke="${color}"`);
  // - Normalize any non-none stroke to the provided color
  out = out.replace(/stroke="(?!none)[^"]+"/gi, `stroke="${color}"`);
  // - Ensure fills do not hide the glyph on white background
  out = out.replace(/fill="(?!none)[^"]+"/gi, 'fill="none"');

  // - For elements without stroke/fill, add default stroke so they are visible
  const visibleDefault = ` stroke="${color}" stroke-linecap="square" stroke-miterlimit="2" stroke-width="68" fill="none"`;
  out = out.replace(/<(path|line|polyline|polygon|rect)(\s[^>]*)?>/gi, (full, _tag, attrs = '') => {
    if (/\sstroke=|\sfill=/i.test(attrs)) return full;
    return full.replace(/<(path|line|polyline|polygon|rect)/i, `<$1${visibleDefault}`);
  });

  // Ensure the root <svg> has xmlns and a reasonable viewBox
  const hasXmlns = /<svg[^>]*\sxmlns=/.test(out);
  if (!hasXmlns) {
    out = out.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  const hasViewBox = /<svg[^>]*\sviewBox=/.test(out);
  if (!hasViewBox) {
    // Try to infer from width/height
    const widthMatch = out.match(/<svg[^>]*\swidth="(\d+)"/i);
    const heightMatch = out.match(/<svg[^>]*\sheight="(\d+)"/i);
    const w = widthMatch ? Number(widthMatch[1]) : 1024;
    const h = heightMatch ? Number(heightMatch[1]) : 1024;
    out = out.replace(/<svg([^>]*)>/i, (_m, attrs) => `<svg${attrs} viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">`);
  }

  return out;
}

// Hook to download an SVG once and cache it in memory
export function useRemoteSvg(url?: string | null, color: string = '#3c9bff') {
  const [xml, setXml] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    if (!url) return;

    // Create cache key with color
    const cacheKey = `${url}_${color}`;

    // Memory cache first
    if (cacheKey in svgCache) {
      setXml(svgCache[cacheKey]);
      return;
    }

    fetch(url)
      .then(r => r.text())
      .then(txt => {
        if (!cancelled) {
          const cleaned = sanitizeSvg(txt, color);
          svgCache[cacheKey] = cleaned;
          setXml(cleaned);
        }
      })
      .catch(() => {
        // Silent failure for SVG fetching
      });

    return () => {
      cancelled = true;
    };
  }, [url, color]);

  return xml;
}

// Pick the best image from WaniKani's character_images array
// 1. Prefer SVG
// 2. Else prefer a PNG of roughly 256 px (good balance of clarity & size)
export function pickBestImage(images?: Array<{
  url: string;
  content_type?: string;
  metadata?: {
    inline_styles?: boolean;
    color?: string;
    dimensions?: string;
    style_name?: string;
  };
}>) {
  if (!images?.length) return null;
  
  // Find SVG with proper null checking
  const svg = images.find(img => img.content_type === 'image/svg+xml');
  if (svg) return { type: 'svg' as const, url: svg.url };

  // Filter PNGs that carry dimension metadata like "256x256"
  const pngs = images
    .filter(img => img.content_type && img.content_type.includes('png'))
    .map(img => ({
      ...img,
      dimension:
        Number(img.metadata?.dimensions?.split('x')[0]) ||
        Number(img.metadata?.style_name?.replace('px', '')) ||
        0,
    }))
    .sort((a, b) => Math.abs(256 - a.dimension) - Math.abs(256 - b.dimension));

  if (pngs.length) return { type: 'png' as const, url: pngs[0].url };
  
  // Final fallback - find any image with a URL
  const fallbackImage = images.find(img => img.url);
  if (fallbackImage) return { type: 'png' as const, url: fallbackImage.url };
  
  return null; // No usable images found
}

// Pick the best PNG specifically (ignoring SVG), useful as a fallback while SVG downloads
export function pickBestPng(images?: Array<{
  url: string;
  content_type?: string;
  metadata?: {
    inline_styles?: boolean;
    color?: string;
    dimensions?: string;
    style_name?: string;
  };
}>) {
  if (!images?.length) return null;
  const pngs = images
    .filter(img => img.content_type && img.content_type.includes('png'))
    .map(img => ({
      ...img,
      dimension:
        Number(img.metadata?.dimensions?.split('x')[0]) ||
        Number(img.metadata?.style_name?.replace('px', '')) ||
        0,
    }))
    .sort((a, b) => Math.abs(256 - a.dimension) - Math.abs(256 - b.dimension));

  if (pngs.length) return { type: 'png' as const, url: pngs[0].url };
  const fallback = images.find(img => img.content_type?.includes('png'));
  return fallback ? { type: 'png' as const, url: fallback.url } : null;
}
