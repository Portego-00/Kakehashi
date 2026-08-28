export interface RadicalCharacterImage {
  url: string;
  content_type?: string;
  metadata?: {
    inline_styles?: boolean;
    color?: string;
    dimensions?: string;
    style_name?: string;
  };
}

export type PreferredRadicalImage = {
  type: 'svg' | 'png';
  url: string;
};

function imageDimension(image: RadicalCharacterImage) {
  return (
    Number(image.metadata?.dimensions?.split('x')[0]) ||
    Number(image.metadata?.style_name?.replace('px', '')) ||
    0
  );
}

// Match the mobile fallback order: SVG, the PNG nearest 256 px, then any image URL.
export function pickBestImage(images?: RadicalCharacterImage[] | null): PreferredRadicalImage | null {
  if (!images?.length) return null;

  const svg = images.find((image) => image.content_type === 'image/svg+xml' && image.url);
  if (svg) return { type: 'svg', url: svg.url };

  const pngs = images
    .filter((image) => image.content_type?.includes('png') && image.url)
    .map((image) => ({ image, dimension: imageDimension(image) }))
    .sort((a, b) => Math.abs(256 - a.dimension) - Math.abs(256 - b.dimension));
  if (pngs.length) return { type: 'png', url: pngs[0].image.url };

  const fallback = images.find((image) => image.url);
  return fallback ? { type: 'png', url: fallback.url } : null;
}

export function pickBestPng(images?: RadicalCharacterImage[] | null): PreferredRadicalImage | null {
  if (!images?.length) return null;

  const pngs = images
    .filter((image) => image.content_type?.includes('png') && image.url)
    .map((image) => ({ image, dimension: imageDimension(image) }))
    .sort((a, b) => Math.abs(256 - a.dimension) - Math.abs(256 - b.dimension));
  const fallback = pngs[0]?.image ?? images.find((image) => image.content_type?.includes('png') && image.url);
  return fallback ? { type: 'png', url: fallback.url } : null;
}
