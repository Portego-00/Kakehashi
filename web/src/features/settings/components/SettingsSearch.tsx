"use client";
import {
  Children,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SettingsIcon } from "./settings-artwork";
import { settingsSearchScore } from "../settings-search";
import styles from "../settings.module.css";
type Setting = {
  element: HTMLElement;
  label: string;
  description: string;
  section: string;
  keywords: string;
  category?: string;
};
const CATEGORIES = [
  {
    id: "reviews",
    label: "Reviews",
    icon: "reviews",
    description: "Answer modes & feedback",
    group: "Study",
  },
  {
    id: "lessons",
    label: "Lessons",
    icon: "lessons",
    description: "Pace & lesson flow",
    group: "Study",
  },
  {
    id: "custom",
    label: "Custom vocabulary",
    icon: "chart",
    description: "Your review schedule",
    group: "Study",
  },
  {
    id: "bunpro",
    label: "Bunpro",
    icon: "bunpro",
    description: "Grammar connection",
    group: "Study",
  },
  {
    id: "context",
    label: "Vocabulary & kanji",
    icon: "kanji",
    description: "Examples & item details",
    group: "Reading & listening",
  },
  {
    id: "reading",
    label: "Reading tools",
    icon: "reader",
    description: "Recognition & translation",
    group: "Reading & listening",
  },
  {
    id: "practice",
    label: "Books & practice",
    icon: "notes",
    description: "Reading goals & extra study",
    group: "Reading & listening",
  },
  {
    id: "voice",
    label: "Japanese voice",
    icon: "audio",
    description: "Offline speech",
    group: "Reading & listening",
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: "appearance",
    description: "Theme, type & colours",
    group: "Personalize",
  },
  {
    id: "workspace",
    label: "Navigation & home",
    icon: "widget",
    description: "Tabs & dashboard layout",
    group: "Personalize",
  },
  {
    id: "profile",
    label: "Profile",
    icon: "profile",
    description: "Your avatar",
    group: "Account & app",
  },
  {
    id: "support",
    label: "Support Kakehashi",
    icon: "support",
    description: "Open source & Patreon",
    group: "Account & app",
  },
  {
    id: "account",
    label: "Account",
    icon: "account",
    description: "Your WaniKani session",
    group: "Account & app",
  },
];
export function SettingsSearch({
  children,
  actions,
  organized = false,
}: {
  children: ReactNode;
  actions?: ReactNode;
  organized?: boolean;
}) {
  const contentRef = useRef<HTMLDivElement>(null),
    inputRef = useRef<HTMLInputElement>(null),
    navigationRef = useRef<HTMLElement>(null),
    mainRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(""),
    [settings, setSettings] = useState<Setting[]>([]),
    [category, setCategory] = useState("reviews"),
    [available, setAvailable] = useState<string[]>([]);
  const searching = query.trim().length > 0;
  const results = searching
    ? settings
        .map((setting) => ({
          ...setting,
          score: settingsSearchScore(
            query,
            setting.label,
            setting.description,
            setting.section,
            setting.keywords,
          ),
        }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
    : [];
  useEffect(() => {
    if (!organized) return;
    const root = contentRef.current;
    if (!root) return;
    function index() {
      const ids = [
        ...new Set(
          Array.from(
            root!.querySelectorAll<HTMLElement>("[data-settings-category]"),
          )
            .filter((n) => n.querySelector("h2"))
            .map((n) => n.dataset.settingsCategory!),
        ),
      ];
      setAvailable((previous) =>
        previous.join("|") === ids.join("|") ? previous : ids,
      );
    }
    index();
    const observer = new MutationObserver(index);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [organized]);
  useEffect(() => {
    if (!organized) return;
    function deepLink() {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("category");
      if (requested && CATEGORIES.some((c) => c.id === requested))
        setCategory(requested);
      const id = window.location.hash.slice(1);
      if (id) {
        const element = document.getElementById(id);
        const owner = element?.closest<HTMLElement>("[data-settings-category]")
          ?.dataset.settingsCategory;
        if (owner) setCategory(owner);
        if (element)
          requestAnimationFrame(() =>
            element.scrollIntoView?.({ block: "center" }),
          );
      }
    }
    deepLink();
    window.addEventListener("hashchange", deepLink);
    window.addEventListener("popstate", deepLink);
    return () => {
      window.removeEventListener("hashchange", deepLink);
      window.removeEventListener("popstate", deepLink);
    };
  }, [organized]);
  useLayoutEffect(() => {
    if (!organized) return;
    window.scrollTo({ top: 0, behavior: "instant" });
    mainRef.current?.scrollTo?.({ top: 0, behavior: "instant" });
  }, [organized, category]);
  useEffect(() => {
    if (!organized) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const navigation = navigationRef.current;
        if (navigation) navigation.style.setProperty("--settings-sidebar-height", `${Math.max(120, window.innerHeight - navigation.getBoundingClientRect().top - 16)}px`);
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", update); window.removeEventListener("scroll", update); };
  }, [organized]);
  function choose(id: string) {
    window.scrollTo({ top: 0, behavior: "instant" });
    setCategory(id);
    setQuery("");
    const url = new URL(window.location.href);
    url.searchParams.set("category", id);
    url.hash = "";
    window.history.replaceState(window.history.state, "", url);
  }
  function search(value: string) {
    const entries = Array.from(
      contentRef.current?.querySelectorAll<HTMLElement>(
        "[data-settings-search]",
      ) ?? [],
    ).filter((element) => !element.querySelector("[data-settings-search]"));
    setSettings(
      entries
        .map((element) => ({
          element,
          label:
            element.dataset.settingsSearch ||
            element.querySelector("strong,h3,h2")?.textContent?.trim() ||
            "",
          description:
            element.querySelector("[data-settings-description],small,p")?.textContent?.trim() ?? "",
          section:
            element
              .closest("section")
              ?.querySelector("h2")
              ?.textContent?.trim() ?? "",
          keywords: [
            element.dataset.searchKeywords ?? "",
            ...Array.from(
              element.querySelectorAll("option"),
              (o) => o.textContent ?? "",
            ),
          ].join(" "),
          category: element.closest<HTMLElement>("[data-settings-category]")
            ?.dataset.settingsCategory,
        }))
        .filter((s) => s.label),
    );
    setQuery(value);
  }
  function openSetting(setting: Setting) {
    if (setting.category) setCategory(setting.category);
    setQuery("");
    requestAnimationFrame(() => {
      let parent: HTMLElement | null = setting.element;
      while (parent) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
        parent = parent.parentElement;
      }
      setting.element.scrollIntoView?.({
        block: "center",
        behavior: "instant",
      });
      const control = setting.element.querySelector<HTMLElement>(
        "input:not([disabled]),select:not([disabled]),button:not([disabled]):not([data-settings-info]),a[href]",
      );
      if (control) control.focus({ preventScroll: true });
      else {
        setting.element.tabIndex = -1;
        setting.element.focus({ preventScroll: true });
      }
    });
  }
  return (
    <>
      <header className={styles.settingsHeader}>
        <div>
          <h1>Settings</h1>
          {organized ? (
            <p className={styles.settingsLead}>
              Make room for the way you study.
            </p>
          ) : null}
        </div>
        <div
          className={styles.settingsSearch}
          role="search"
          aria-label="Settings"
        >
          <div className={styles.searchInputRow}>
            <SettingsIcon name="search" size={22} />
            <input
              ref={inputRef}
              id="settings-search"
              aria-label="Search settings"
              type="search"
              placeholder="Find a setting…"
              autoComplete="off"
              value={query}
              maxLength={120}
              onChange={(e) => search(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === "Escape") {
                  e.preventDefault();
                  setQuery("");
                }
                if (e.key === "Enter" && results[0]) {
                  e.preventDefault();
                  openSetting(results[0]);
                }
              }}
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear settings search"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
              >
                <SettingsIcon name="minus" size={18} />
              </button>
            ) : null}
          </div>
        </div>
        {actions}
      </header>
      <p className={styles.searchStatus} role="status">
        {searching
          ? results.length
            ? `${results.length} ${results.length === 1 ? "setting" : "settings"} found`
            : "No settings found. Try another word."
          : ""}
      </p>
      <div className={organized ? styles.organizedSettings : undefined}>
        {organized ? (
          <aside
            ref={navigationRef}
            className={styles.categoryNavigation}
            aria-label="Settings categories"
          >
            <label className={styles.categoryPicker}>
              Settings category
              <select
                aria-label="Settings category"
                value={category}
                onChange={(e) => choose(e.target.value)}
              >
                {CATEGORIES.filter((c) => available.includes(c.id)).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            {[
              "Study",
              "Reading & listening",
              "Personalize",
              "Account & app",
            ].map((group) => (
              <div key={group} className={styles.categoryGroup}>
                <p>{group}</p>
                {CATEGORIES.filter(
                  (c) => c.group === group && available.includes(c.id),
                ).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={styles.categoryLink}
                    aria-current={category === c.id ? "page" : undefined}
                    onClick={() => choose(c.id)}
                  >
                    <SettingsIcon name={c.icon} size={16} />
                    <span>
                      <strong>{c.label}</strong>
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </aside>
        ) : null}
        <div ref={mainRef} className={styles.categoryMain}>
          {searching && results.length ? (
            <ul
              className={styles.searchResults}
              aria-label="Settings search results"
            >
              {results.map((setting, i) => (
                <li key={`${setting.section}:${setting.label}:${i}`}>
                  <button type="button" onClick={() => openSetting(setting)}>
                    <span className={styles.searchResultSection}>
                      {setting.section}
                    </span>
                    <strong>{setting.label}</strong>
                    {setting.description ? (
                      <span>{setting.description}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div
            ref={contentRef}
            className={styles.searchContent}
            hidden={searching}
          >
            {organized
              ? Children.map(children, (child) => {
                  if (
                    !isValidElement<{ "data-settings-category"?: string }>(
                      child,
                    )
                  )
                    return child;
                  const id = child.props["data-settings-category"];
                  return id ? (
                    <div data-category-panel={id} hidden={category !== id}>
                      {child}
                    </div>
                  ) : (
                    child
                  );
                })
              : children}
          </div>
        </div>
      </div>
    </>
  );
}
