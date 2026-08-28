export type MangaReadingDirection = "ltr" | "rtl";
export type MangaPagePlacement = "center" | "left" | "right" | null;
export type MangaPageSide = Exclude<MangaPagePlacement, null>;

export const DEFAULT_MANGA_READING_DIRECTION: MangaReadingDirection = "rtl";

export interface MangaSpread {
  key: string;
  pages: readonly number[];
  resumePage: number;
  twoPage: boolean;
}

interface MangaSpreadOptions {
  twoPage: boolean;
  placements?: readonly MangaPagePlacement[];
  direction?: MangaReadingDirection;
}

interface PendingSpread {
  pages: number[];
  lastSide: Exclude<MangaPageSide, "center"> | null;
}

function normalizedPageCount(totalPages: number) {
  return Number.isFinite(totalPages) ? Math.max(0, Math.floor(totalPages)) : 0;
}

function placementAt(placements: readonly MangaPagePlacement[] | undefined, pageNumber: number): MangaPagePlacement {
  const placement = placements?.[pageNumber - 1];
  return placement === "center" || placement === "left" || placement === "right" ? placement : null;
}

function spreadFromPages(pages: number[], twoPage: boolean): MangaSpread {
  const values = [...pages];
  return {
    key: values.join("-"),
    pages: values,
    resumePage: values.at(-1) ?? 1,
    twoPage,
  };
}

/**
 * Builds logical reading spreads. The first page is always isolated so a cover
 * is never paired with the first interior page. Explicit EPUB placement hints
 * can introduce additional single pages or blank spread slots.
 */
export function buildMangaSpreads(totalPages: number, options: MangaSpreadOptions): MangaSpread[] {
  const pageCount = normalizedPageCount(totalPages);
  if (!pageCount) return [];
  if (!options.twoPage) {
    return Array.from({ length: pageCount }, (_, index) => spreadFromPages([index + 1], false));
  }

  const direction = options.direction ?? DEFAULT_MANGA_READING_DIRECTION;
  const sideOrder = direction === "rtl" ? (["right", "left"] as const) : (["left", "right"] as const);
  const spreads: MangaSpread[] = [spreadFromPages([1], true)];
  let pending: PendingSpread | null = null;

  function flushPending() {
    if (!pending) return;
    spreads.push(spreadFromPages(pending.pages, true));
    pending = null;
  }

  for (let pageNumber = 2; pageNumber <= pageCount; pageNumber += 1) {
    const placement = placementAt(options.placements, pageNumber);
    if (placement === "center") {
      flushPending();
      spreads.push(spreadFromPages([pageNumber], true));
      continue;
    }

    const requestedSide = placement ?? sideOrder[0];
    if (!pending) {
      pending = { pages: [pageNumber], lastSide: requestedSide };
      continue;
    }

    const nextSide = placement === null ? sideOrder[1] : requestedSide;
    if (pending.lastSide === sideOrder[0] && nextSide === sideOrder[1]) {
      pending.pages.push(pageNumber);
      flushPending();
      continue;
    }

    flushPending();
    pending = { pages: [pageNumber], lastSide: requestedSide };
  }

  flushPending();
  return spreads;
}

/** Returns the visual slot for one logical page in a planned spread. */
export function mangaPageSide(
  spread: MangaSpread,
  pageNumber: number,
  direction: MangaReadingDirection,
  placement: MangaPagePlacement = null,
): MangaPageSide {
  if (!spread.twoPage) return "center";
  if (placement !== null) return placement;
  if (spread.pages.length < 2) return "center";
  const pageIndex = spread.pages.indexOf(pageNumber);
  if (pageIndex < 0) return "center";
  if (direction === "rtl") return pageIndex === 0 ? "right" : "left";
  return pageIndex === 0 ? "left" : "right";
}

export function mangaSpreadIndexForPage(spreads: readonly MangaSpread[], pageNumber: number) {
  if (!spreads.length) return -1;
  const normalizedPage = Number.isFinite(pageNumber) ? Math.max(1, Math.floor(pageNumber)) : 1;
  const exactIndex = spreads.findIndex((spread) => spread.pages.includes(normalizedPage));
  if (exactIndex >= 0) return exactIndex;
  return normalizedPage < spreads[0].pages[0] ? 0 : spreads.length - 1;
}
