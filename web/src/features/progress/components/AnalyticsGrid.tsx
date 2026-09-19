"use client";

import { useLayoutEffect, useRef, type HTMLAttributes } from "react";
import { analyticsGridColumns, analyticsGridOrphanIndices } from "../analytics-grid";
import styles from "../analytics-grid.module.css";

export function AnalyticsGrid({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const gridRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid || typeof ResizeObserver === "undefined") return;
    let frame: number | null = null;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      const measuredGap = Number.parseFloat(getComputedStyle(grid).columnGap);
      const gap = Number.isFinite(measuredGap) ? Math.max(0, measuredGap) : 16;
      const columns = analyticsGridColumns(grid.getBoundingClientRect().width, gap);
      if (grid.dataset.columns !== String(columns)) grid.dataset.columns = String(columns);
      const items = [...grid.children].filter((item): item is HTMLElement => item instanceof HTMLElement);
      const orphans = new Set(analyticsGridOrphanIndices(items.map((item) => item.dataset.size === "wide" ? "wide" : "compact"), columns));
      for (const [index, item] of items.entries()) {
        if (orphans.has(index)) {
          if (item.dataset.gridOrphan !== "true") item.dataset.gridOrphan = "true";
        } else if (item.dataset.gridOrphan) delete item.dataset.gridOrphan;
      }
      grid.dataset.measured = "true";
    };
    const schedule = () => { if (frame === null && !disposed) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    const syncChildren = () => {
      mutations.disconnect();
      mutations.observe(grid, { childList: true });
      for (const item of grid.children) mutations.observe(item, { attributes: true, attributeFilter: ["data-size"] });
    };
    const mutations = new MutationObserver(() => { syncChildren(); measure(); });
    observer.observe(grid);
    syncChildren();
    measure();
    return () => {
      disposed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      mutations.disconnect();
    };
  }, []);

  return <div {...props} ref={gridRef} data-analytics-grid data-layout="rows" className={`${styles.grid}${className ? ` ${className}` : ""}`}>{children}</div>;
}
