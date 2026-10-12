"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SettingsIcon } from "./settings-artwork";
import { SettingsDescription } from "./SettingsDescription";
import styles from "../settings.module.css";

export function SettingsDisclosure({ title, description, icon, children }: {
  title: string; description: string; icon: string; children: ReactNode;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const targetOpen = useRef(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => () => animationRef.current?.cancel(), []);
  function toggle() {
    const details = detailsRef.current;
    const content = contentRef.current;
    if (!details || !content) return;
    const opening = animationRef.current ? !targetOpen.current : !details.open;
    const startHeight = details.open ? content.getBoundingClientRect().height : 0;
    if (animationRef.current) { animationRef.current.onfinish = null; animationRef.current.cancel(); }
    targetOpen.current = opening;
    setExpanded(opening);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || !content.animate) {
      animationRef.current = null;
      details.open = opening;
      return;
    }
    details.open = true;
    const animation = content.animate([
      { height: `${startHeight}px`, opacity: startHeight ? 1 : 0 },
      { height: `${opening ? content.scrollHeight + 1 : 0}px`, opacity: opening ? 1 : 0 },
    ], { duration: opening ? 240 : 190, easing: opening ? "cubic-bezier(.2,.7,.3,1)" : "cubic-bezier(.4,0,1,1)", fill: "both" });
    animationRef.current = animation;
    animation.onfinish = () => {
      details.open = opening;
      animationRef.current = null;
      animation.cancel();
    };
  }
  return <details ref={detailsRef} className={styles.settingsDisclosure} data-expanded={expanded}
    onToggle={() => { if (!animationRef.current && detailsRef.current) { targetOpen.current = detailsRef.current.open; setExpanded(detailsRef.current.open); } }}>
    <summary onClick={(event) => { event.preventDefault(); toggle(); }}>
      <SettingsIcon name={icon} size={24} />
      <span><strong>{title}</strong><SettingsDescription label={title}>{description}</SettingsDescription></span>
      <SettingsIcon name="chevron" size={18} className={styles.disclosureChevron} />
    </summary>
    <div ref={contentRef} className={styles.disclosureContent}>{children}</div>
  </details>;
}
