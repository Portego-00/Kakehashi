"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import styles from "./bunpro.module.css";

/** Keep the compact identity immediately above the tabs once the hero scrolls away. */
export function BunproDetailNavigation({ heroRef, title, meaning, children }: {
  heroRef: RefObject<HTMLElement | null>;
  title: string;
  meaning: string;
  children: ReactNode;
}) {
  const navigationRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    let frame = 0;
    const appHeader = document.querySelector<HTMLElement>("[data-app-header]");
    const update = () => {
      frame = 0;
      const navigation = navigationRef.current;
      const hero = heroRef.current;
      if (!navigation || !hero) return;
      const top = Math.max(0, appHeader?.getBoundingClientRect().bottom ?? 0);
      navigation.style.setProperty("--bunpro-sticky-top", `${top}px`);
      const stickyTop = Number.parseFloat(getComputedStyle(navigation).top) || 0;
      setStuck(hero.getBoundingClientRect().bottom <= stickyTop + 1);
    };
    const requestUpdate = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(requestUpdate);
    if (appHeader) observer?.observe(appHeader);
    if (heroRef.current) observer?.observe(heroRef.current);
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [heroRef]);

  return <div ref={navigationRef} className={styles.detailNavigation} data-stuck={stuck}>
    <div className={styles.detailIdentity} aria-hidden={!stuck}>
      <button type="button" tabIndex={stuck ? 0 : -1} aria-label={`Back to ${title}`} onClick={() => {
        const hero = heroRef.current;
        if (!hero) return;
        const top = Number.parseFloat(navigationRef.current?.style.getPropertyValue("--bunpro-sticky-top") ?? "0") || 0;
        window.scrollTo({ top: window.scrollY + hero.getBoundingClientRect().top - top, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      }}>
        <strong lang="ja">{title}</strong><span>{meaning}</span>
      </button>
    </div>
    {children}
  </div>;
}
