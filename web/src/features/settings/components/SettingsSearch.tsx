"use client";

import { useRef, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { settingsSearchScore } from "../settings-search";
import styles from "../settings.module.css";

type Setting = { element: HTMLElement; label: string; description: string; section: string; keywords: string };

export function SettingsSearch({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [settings, setSettings] = useState<Setting[]>([]);
  const searching = query.trim().length > 0;
  const results = searching ? settings.map((setting) => ({ ...setting, score: settingsSearchScore(query, setting.label, setting.description, setting.section, setting.keywords) })).filter((setting) => setting.score > 0).sort((a, b) => b.score - a.score) : [];

  function search(value: string) {
    // Index labels, never input values (API keys, emails, and other private data).
    const entries = Array.from(contentRef.current?.querySelectorAll<HTMLElement>("[data-settings-search]") ?? []).filter((element) => !element.querySelector("[data-settings-search]"));
    setSettings(entries.map((element) => ({
      element,
      label: element.dataset.settingsSearch || element.querySelector("strong, h3, h2")?.textContent?.trim() || "",
      description: element.querySelector("small, p")?.textContent?.trim() ?? "",
      section: element.closest("section")?.querySelector("h2")?.textContent?.trim() ?? "",
      keywords: [element.dataset.searchKeywords ?? "", ...Array.from(element.querySelectorAll("option"), (option) => option.textContent ?? "")].join(" "),
    })).filter((setting) => setting.label));
    setQuery(value);
  }

  function openSetting(setting: Setting) {
    setQuery("");
    requestAnimationFrame(() => {
      setting.element.scrollIntoView({ block: "center", behavior: "instant" });
      const control = setting.element.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), button:not([disabled]), a[href]");
      if (control) control.focus({ preventScroll: true });
      else { setting.element.tabIndex = -1; setting.element.focus({ preventScroll: true }); }
    });
  }

  return <>
    <header className={styles.settingsHeader}>
      <h1>Settings</h1>
      <div className={styles.settingsSearch} role="search" aria-label="Settings">
      <div className={styles.searchInputRow}>
        <Search size={18} aria-hidden />
        <input ref={inputRef} id="settings-search" aria-label="Search settings" type="search" placeholder="Search settings…" autoComplete="off" value={query} maxLength={120} onChange={(event) => search(event.target.value)} onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") { event.preventDefault(); setQuery(""); }
          if (event.key === "Enter" && results[0]) { event.preventDefault(); openSetting(results[0]); }
        }} />
        {query ? <button type="button" aria-label="Clear settings search" onClick={() => { setQuery(""); inputRef.current?.focus(); }}><X size={18} aria-hidden /></button> : null}
      </div>
      </div>
      {actions}
    </header>
    <p className={styles.searchStatus} role="status">{searching ? results.length ? `${results.length} ${results.length === 1 ? "setting" : "settings"} found` : "No settings found. Try another word." : ""}</p>
    {searching && results.length ? <ul className={styles.searchResults} aria-label="Settings search results">{results.map((setting, index) => <li key={`${setting.section}:${setting.label}:${index}`}><button type="button" onClick={() => openSetting(setting)}><span className={styles.searchResultSection}>{setting.section}</span><strong>{setting.label}</strong>{setting.description ? <span>{setting.description}</span> : null}</button></li>)}</ul> : null}
    <div ref={contentRef} className={styles.searchContent} hidden={searching}>{children}</div>
  </>;
}
