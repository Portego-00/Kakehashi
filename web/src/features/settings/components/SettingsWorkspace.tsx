"use client";

import { type DragEvent, type KeyboardEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, BookOpenText, Check, Download, ExternalLink, EyeOff, FileUp, GripVertical, HeartHandshake, KeyRound, Keyboard, LayoutDashboard, LogOut, Moon, Palette, Plus, RotateCcw, SlidersHorizontal, Trash2, Type, UserRound, Volume2 } from "lucide-react";
import { GitHubMark, PatreonIcon } from "@/components/icons/BrandIcons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AnimePicker } from "@/features/anime/AnimePicker";
import type { AnimeListProvider } from "@/features/anime/types";
import { DashboardWidgetPreview } from "@/features/dashboard/DashboardWidgetPreview";
import { JAPANESE_VOICE_DOWNLOAD_LABEL, JAPANESE_VOICE_NAME } from "@/features/speech/japanese-voice-assets";
import { useJapaneseVoice } from "@/features/speech/use-japanese-voice";
import { useSession } from "@/lib/session";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { normalizeGravatarEmail } from "@/lib/gravatar";
import { GITHUB_REPOSITORY_URL, PATREON_URL } from "@/lib/project-links";
import { BUILT_IN_JITAI_FONTS, deleteCustomJitaiFont, installCustomJitaiFonts, readFontFile, saveCustomJitaiFont } from "../jitai";
import { applyWebSettings, DASHBOARD_SECTION_DEFINITIONS, DEFAULT_DASHBOARD_SECTION_ORDER, DEFAULT_DASHBOARD_SECTION_WIDTHS, DEFAULT_HIDDEN_DASHBOARD_SECTIONS, DEFAULT_WEB_SETTINGS, loadWebSettings, NAVBAR_TAB_IDS, OPTIONAL_NAV_ITEMS, REQUIRED_NAVBAR_TAB_IDS, REVIEW_BATCH_SIZE_VALUES, saveWebSettings, settingsStorageKey, SUBJECT_COLOR_PRESETS, type AnkiMode, type DashboardSectionId, type DashboardSectionWidth, type NavbarTabId, type QuestionOrder, type TextScale, type WebSettings } from "../settings";
import styles from "../settings.module.css";

const storage = {
  getItem: (key: string) => typeof window === "undefined" ? null : window.localStorage.getItem(key),
  setItem: (key: string, value: string) => { if (typeof window !== "undefined") window.localStorage.setItem(key, value); },
};
const noopSubscribe = () => () => {};
const THEMES: Array<{ id: ThemeMode; label: string; description: string }> = [
  { id: "system", label: "System", description: "Follow this device" },
  { id: "light", label: "Light", description: "Bright neutral paper" },
  { id: "dark", label: "Dark", description: "Low-light workspace" },
  { id: "midnight", label: "Midnight", description: "Highest dark contrast" },
  { id: "sepia", label: "Sepia", description: "Warm reading paper" },
];
const TEXT_SCALES: Array<{ value: TextScale; label: string; description: string }> = [
  { value: 0.9, label: "Compact", description: "Fit more on screen" },
  { value: 1, label: "Standard", description: "Default balance" },
  { value: 1.1, label: "Large", description: "More comfortable text" },
  { value: 1.2, label: "Extra large", description: "Maximum readability" },
];
const REVIEW_ORDER_OPTIONS = [
  { value: "random", label: "Random" },
  { value: "ascendingSrsStage", label: "Lower SRS first" },
  { value: "descendingSrsStage", label: "Higher SRS first" },
  { value: "currentLevelFirst", label: "Current level first" },
  { value: "lowestLevelFirst", label: "Lowest level first" },
  { value: "newestAvailableFirst", label: "Newest available first" },
  { value: "oldestAvailableFirst", label: "Oldest available first" },
  { value: "longestRelativeWait", label: "Most overdue first" },
] as const satisfies ReadonlyArray<{ value: WebSettings["study"]["reviewOrder"]; label: string }>;
const REVIEW_TYPE_LABELS = {
  radical: "Radicals",
  kanji: "Kanji",
  vocabulary: "Vocabulary",
} as const;
const REVIEW_TYPE_POSITIONS = ["First", "Second", "Third"] as const;
const WORKSPACE_LABELS: Record<string, string> = { analytics: "Analytics", items: "Items", search: "Search", lists: "Subject lists", news: "News", reader: "Text reader", epubs: "Books", music: "Songs", video: "Video", manga: "Manga", translator: "Translator", community: "Community" };
const NAVBAR_TAB_OPTIONS: Array<{ id: NavbarTabId; label: string; description: string }> = [
  { id: "home", label: "Home", description: "Dashboard with lessons, reviews, and progress." },
  { id: "level", label: "Level", description: "Current level progress and SRS stages." },
  { id: "items", label: "Items", description: "Browse radicals, kanji, and vocabulary." },
  { id: "analytics", label: "Analytics", description: "Detailed statistics and review history." },
  { id: "news", label: "News", description: "NHK Easier articles and reading practice." },
  { id: "epubs", label: "Books", description: "Your EPUB library and reader." },
  { id: "video", label: "Video", description: "Local video with Japanese subtitles." },
  { id: "manga", label: "Manga", description: "Manga reading with on-device OCR." },
  { id: "music", label: "Songs", description: "Japanese music, synced lyrics, and translation." },
];
const REQUIRED_NAVBAR_TABS = new Set<NavbarTabId>(REQUIRED_NAVBAR_TAB_IDS);
const DASHBOARD_DEFINITION_BY_ID = new Map(DASHBOARD_SECTION_DEFINITIONS.map((definition) => [definition.id, definition]));
const DASHBOARD_WIDTH_LABELS: Record<DashboardSectionWidth, string> = { 4: "⅓", 6: "½", 8: "⅔", 12: "Full" };
const DASHBOARD_WIDTH_NAMES: Record<DashboardSectionWidth, string> = { 4: "one third", 6: "one half", 8: "two thirds", 12: "full width" };

type DashboardCanvasItemBounds = { id: DashboardSectionId; left: number; top: number; right: number; bottom: number };
type DashboardCanvasDropTarget = {
  beforeId: DashboardSectionId | null;
  kind: "item" | "slot" | "row";
  indicator: { left: number; top: number; width: number; height: number };
};

function dashboardCanvasDropTarget(items: DashboardCanvasItemBounds[], point: { x: number; y: number }, innerBounds: { left: number; top: number; right: number; bottom: number }): DashboardCanvasDropTarget | null {
  if (!items.length) return { beforeId: null, kind: "row", indicator: { left: innerBounds.left, top: innerBounds.top, width: innerBounds.right - innerBounds.left, height: 4 } };

  const rows: Array<{ items: DashboardCanvasItemBounds[]; top: number; bottom: number }> = [];
  items.forEach((item) => {
    const current = rows.at(-1);
    if (current && item.top < current.bottom && item.bottom > current.top) {
      current.items.push(item);
      current.top = Math.min(current.top, item.top);
      current.bottom = Math.max(current.bottom, item.bottom);
    } else {
      rows.push({ items: [item], top: item.top, bottom: item.bottom });
    }
  });

  const indicatorLine = (beforeId: DashboardSectionId | null, top: number, left = innerBounds.left, width = innerBounds.right - innerBounds.left): DashboardCanvasDropTarget => ({ beforeId, kind: "row", indicator: { left, top: top - 2, width, height: 4 } });
  const rowAtPoint = rows.find((row) => point.y >= row.top && point.y <= row.bottom);
  if (rowAtPoint) {
    const rowItems = [...rowAtPoint.items].sort((a, b) => a.left - b.left);
    const hovered = rowItems.find((item) => point.x >= item.left && point.x <= item.right);
    if (hovered) {
      const index = items.indexOf(hovered);
      const placeAfter = point.y > (hovered.top + hovered.bottom) / 2;
      const beforeId = placeAfter ? items[index + 1]?.id ?? null : hovered.id;
      return { beforeId, kind: "item", indicator: { left: hovered.left, top: (placeAfter ? hovered.bottom : hovered.top) - 2, width: hovered.right - hovered.left, height: 4 } };
    }

    const itemToRight = rowItems.find((item) => point.x < item.left);
    if (itemToRight) return { beforeId: itemToRight.id, kind: "item", indicator: { left: itemToRight.left, top: itemToRight.top - 2, width: itemToRight.right - itemToRight.left, height: 4 } };

    const rowLastItem = rowItems.at(-1)!;
    const rowLastIndex = items.indexOf(rowLastItem);
    const slotLeft = Math.min(innerBounds.right, rowLastItem.right + 8);
    return {
      beforeId: items[rowLastIndex + 1]?.id ?? null,
      kind: "slot",
      indicator: { left: slotLeft, top: rowAtPoint.top, width: Math.max(0, innerBounds.right - slotLeft), height: rowAtPoint.bottom - rowAtPoint.top },
    };
  }

  const nextRowIndex = rows.findIndex((row) => point.y < row.top);
  if (nextRowIndex === 0) return indicatorLine(rows[0].items[0].id, rows[0].top);
  if (nextRowIndex > 0) {
    const previous = rows[nextRowIndex - 1];
    const next = rows[nextRowIndex];
    return indicatorLine(next.items[0].id, previous.bottom + (next.top - previous.bottom) / 2);
  }
  const lastRow = rows.at(-1)!;
  return indicatorLine(null, Math.min(innerBounds.bottom, lastRow.bottom + 12));
}

function moveRadio(event: KeyboardEvent<HTMLButtonElement>, index: number, total: number, select: (index: number) => void) {
  const keyOffset = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
  const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? total - 1 : keyOffset ? (index + keyOffset + total) % total : -1;
  if (nextIndex < 0) return;
  event.preventDefault();
  select(nextIndex);
  const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
  buttons?.[nextIndex]?.focus();
}

export function SettingsWorkspace() {
  const router = useRouter();
  const { user, signOut } = useSession();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const username = user?.data.username ?? "anonymous";
  const [settings, setSettings] = useState<WebSettings>(DEFAULT_WEB_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [fontError, setFontError] = useState("");
  const [gravatarEmailInput, setGravatarEmailInput] = useState("");
  const [gravatarEmailError, setGravatarEmailError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const voiceSupported = useSyncExternalStore(noopSubscribe, () => {
    const browser = window as typeof window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    return Boolean(browser.SpeechRecognition || browser.webkitSpeechRecognition);
  }, () => false);

  useEffect(() => {
    const load = () => {
      const loaded = loadWebSettings(storage, username);
      setSettings(loaded);
      setGravatarEmailInput(loaded.profile.gravatarEmail);
      applyWebSettings(loaded);
    };
    const timer = window.setTimeout(load, 0);
    const onStorage = (event: StorageEvent) => { if (event.key === settingsStorageKey(username)) load(); };
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", onStorage);
    };
  }, [username]);

  useEffect(() => { void installCustomJitaiFonts(settings.study.jitaiCustomFonts).catch(() => setFontError("A saved custom font could not be loaded by this browser.")); }, [settings.study.jitaiCustomFonts]);

  const update = (next: WebSettings) => {
    setSettings(next);
    saveWebSettings(storage, username, next);
    applyWebSettings(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };
  const updateStudy = <Key extends keyof WebSettings["study"],>(key: Key, value: WebSettings["study"][Key]) => update({ ...settings, study: { ...settings.study, [key]: value } });
  const updateReviewTypePosition = (position: number, value: WebSettings["study"]["reviewTypeOrder"][number]) => {
    const reviewTypeOrder = [...settings.study.reviewTypeOrder];
    const previousPosition = reviewTypeOrder.indexOf(value);
    if (previousPosition < 0 || previousPosition === position) return;
    [reviewTypeOrder[position], reviewTypeOrder[previousPosition]] = [reviewTypeOrder[previousPosition], reviewTypeOrder[position]];
    updateStudy("reviewTypeOrder", reviewTypeOrder);
  };
  const updateReader = <Key extends keyof WebSettings["reader"],>(key: Key, value: WebSettings["reader"][Key]) => update({ ...settings, reader: { ...settings.reader, [key]: value } });
  const updateAnimeUsername = (provider: AnimeListProvider, value: string) => update({ ...settings, integrations: { ...settings.integrations, [provider === "myanimelist" ? "myAnimeListUsername" : "aniListUsername"]: value } });
  const updateSubjectDetails = <Key extends keyof WebSettings["subjectDetails"],>(key: Key, value: WebSettings["subjectDetails"][Key]) => update({ ...settings, subjectDetails: { ...settings.subjectDetails, [key]: value } });
  const saveGravatarEmail = () => {
    const trimmedEmail = gravatarEmailInput.trim();
    const gravatarEmail = normalizeGravatarEmail(trimmedEmail);
    if (trimmedEmail && !gravatarEmail) {
      setGravatarEmailError("Enter a valid email address.");
      return;
    }
    setGravatarEmailError("");
    setGravatarEmailInput(gravatarEmail);
    update({ ...settings, profile: { ...settings.profile, gravatarEmail } });
  };
  const toggleNav = (id: string) => update({ ...settings, workspace: { ...settings.workspace, visibleNav: settings.workspace.visibleNav.includes(id) ? settings.workspace.visibleNav.filter((item) => item !== id) : [...settings.workspace.visibleNav, id] } });
  const toggleNavbarTab = (id: NavbarTabId) => {
    if (REQUIRED_NAVBAR_TABS.has(id)) return;
    const selected = new Set(settings.workspace.navbarTabs);
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    update({ ...settings, workspace: { ...settings.workspace, navbarTabs: NAVBAR_TAB_IDS.filter((tabId) => selected.has(tabId)) } });
  };
  const reset = () => {
    settings.study.jitaiCustomFonts.forEach((font) => { void deleteCustomJitaiFont(font.id).catch(() => undefined); });
    setGravatarEmailInput(DEFAULT_WEB_SETTINGS.profile.gravatarEmail);
    setGravatarEmailError("");
    update(DEFAULT_WEB_SETTINGS);
    setTheme("system");
    setConfirmReset(false);
  };
  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutError("");
    try {
      await signOut();
      router.replace("/login");
    } catch (cause) {
      setSignOutError(cause instanceof Error ? cause.message : "Kakehashi could not sign out. Check your connection and try again.");
    } finally {
      setSigningOut(false);
    }
  };
  const toggleJitaiFont = (id: string) => {
    const selected = settings.study.jitaiSelectedFontIds;
    if (selected.includes(id) && selected.length === 1) return;
    updateStudy("jitaiSelectedFontIds", selected.includes(id) ? selected.filter((fontId) => fontId !== id) : [...selected, id]);
  };
  const importFont = async (file?: File) => {
    if (!file) return;
    setFontError("");
    try {
      if (settings.study.jitaiCustomFonts.length >= 3) throw new Error("Remove a custom font before adding another (maximum 3). ");
      const font = await readFontFile(file);
      await saveCustomJitaiFont(font);
      await installCustomJitaiFonts([font]);
      update({ ...settings, study: { ...settings.study, jitaiEnabled: true, jitaiCustomFonts: [...settings.study.jitaiCustomFonts, font], jitaiSelectedFontIds: [...settings.study.jitaiSelectedFontIds, font.id] } });
    } catch (cause) { setFontError(cause instanceof Error ? cause.message : "That font could not be imported."); }
  };
  const removeFont = (id: string) => {
    update({ ...settings, study: { ...settings.study, jitaiCustomFonts: settings.study.jitaiCustomFonts.filter((font) => font.id !== id), jitaiSelectedFontIds: settings.study.jitaiSelectedFontIds.filter((fontId) => fontId !== id) } });
    void deleteCustomJitaiFont(id).catch(() => setFontError("The font was removed from settings, but its browser asset could not be deleted."));
  };
  const groupedAnkiQuestions = settings.study.ankiMode === "both" && settings.study.ankiGroupQuestions;

  return <main className={`page ${styles.page}`}>
    <header className="page-header"><div><h1>Settings</h1><p>Appearance and study behavior are saved locally for {username} on this browser.</p></div><div className={styles.headerActions}><span className={styles.savedStatus} role="status" aria-live="polite">{saved ? <Badge tone="success"><Check size={13} /> Saved</Badge> : null}</span>{confirmReset ? <><Button tone="danger" onClick={reset}>Confirm Reset</Button><Button tone="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button></> : <Button tone="ghost" onClick={() => setConfirmReset(true)}><RotateCcw size={16} /> Reset</Button>}</div></header>

    <section className={styles.settingsSection} aria-labelledby="profile-heading">
      <div className={styles.sectionIntro}><UserRound size={19} aria-hidden /><div><h2 id="profile-heading">Profile</h2><p>Use your Gravatar picture in the app header.</p></div></div>
      <Card padding="none" className={styles.preferenceCard}>
        <form className={styles.profileRow} noValidate onSubmit={(event) => { event.preventDefault(); saveGravatarEmail(); }}>
          <div className={styles.profileLabel}><label htmlFor="gravatar-email"><strong>Gravatar email</strong></label><small id="gravatar-email-help">Saved in this browser and attached to your community posts for cross-app avatars. Public web responses expose only its Gravatar hash.</small></div>
          <div className={styles.profileControls}>
            <input id="gravatar-email" className={styles.textInput} type="email" autoComplete="email" spellCheck={false} value={gravatarEmailInput} aria-invalid={gravatarEmailError ? true : undefined} aria-describedby={`gravatar-email-help${gravatarEmailError ? " gravatar-email-error" : ""}`} onChange={(event) => { setGravatarEmailInput(event.target.value); setGravatarEmailError(""); }} placeholder="you@example.com" />
            <Button type="submit" size="small">Save email</Button>
          </div>
          {gravatarEmailError ? <small className={styles.inlineError} id="gravatar-email-error" role="alert">{gravatarEmailError}</small> : null}
        </form>
      </Card>
    </section>

    <section className={styles.settingsSection} aria-labelledby="support-heading">
      <div className={styles.sectionIntro}><HeartHandshake size={19} aria-hidden /><div><h2 id="support-heading">Support Kakehashi</h2><p>Star the project for free, or fund ongoing development with a paid Patreon membership.</p></div></div>
      <Card padding="none" className={styles.preferenceCard}>
        <nav className={styles.supportLinks} aria-label="Support Kakehashi">
          <a className={styles.supportLink} href={GITHUB_REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
            <GitHubMark className={styles.supportBrandIcon} />
            <span className={styles.supportLinkCopy}><strong>Star Kakehashi on GitHub</strong><small>Follow development and help other learners find the project.</small></span>
            <span className={styles.supportLinkMeta}><span className={styles.supportCost} data-cost="free">Free</span><ExternalLink className={styles.supportExternalIcon} size={16} aria-hidden /></span>
          </a>
          <a className={styles.supportLink} href={PATREON_URL} target="_blank" rel="noopener noreferrer">
            <PatreonIcon className={styles.supportBrandIcon} />
            <span className={styles.supportLinkCopy}><strong>Support Kakehashi on Patreon</strong><small>Choose a paid membership to fund development and join the supporter community.</small></span>
            <span className={styles.supportLinkMeta}><span className={styles.supportCost}>Paid</span><ExternalLink className={styles.supportExternalIcon} size={16} aria-hidden /></span>
          </a>
        </nav>
      </Card>
    </section>

    <JapaneseVoiceDownloadSetting />

    <section className={styles.settingsSection} aria-labelledby="appearance-heading">
      <div className={styles.sectionIntro}><Moon size={19} /><div><h2 id="appearance-heading">Appearance</h2><p>Choose a base theme. System mode tracks the browser setting.</p></div></div>
      <Card padding="none" className={styles.optionCard}><div className={styles.themeOptions} role="radiogroup" aria-label="Theme">{THEMES.map((option, index) => <button type="button" role="radio" aria-checked={theme === option.id} tabIndex={theme === option.id ? 0 : -1} key={option.id} onClick={() => setTheme(option.id)} onKeyDown={(event) => moveRadio(event, index, THEMES.length, (next) => setTheme(THEMES[next].id))}><span className={styles.themeSwatch} data-theme-swatch={option.id === "system" ? resolvedTheme : option.id} /><span><strong>{option.label}</strong><small>{option.description}</small></span>{theme === option.id ? <Check size={17} aria-hidden /> : null}</button>)}</div></Card>
    </section>

    <section className={styles.settingsSection} aria-labelledby="text-heading">
      <div className={styles.sectionIntro}><Type size={19} /><div><h2 id="text-heading">Text size</h2><p>Scale the entire interface without changing browser zoom.</p></div></div>
      <Card padding="none" className={styles.optionCard}><div className={styles.rowOptions} role="radiogroup" aria-label="Text size">{TEXT_SCALES.map((option, index) => <button type="button" role="radio" aria-checked={settings.textScale === option.value} tabIndex={settings.textScale === option.value ? 0 : -1} key={option.value} onClick={() => update({ ...settings, textScale: option.value })} onKeyDown={(event) => moveRadio(event, index, TEXT_SCALES.length, (next) => update({ ...settings, textScale: TEXT_SCALES[next].value }))}><span><strong>{option.label}</strong><small>{option.description}</small></span><span>{Math.round(option.value * 100)}%</span>{settings.textScale === option.value ? <Check size={17} aria-hidden /> : null}</button>)}</div><div className={styles.textPreview}><strong lang="ja">日本語を学ぶ</strong><p>Kanji, vocabulary, and review details remain comfortable on a larger display.</p></div></Card>
    </section>

    <section className={styles.settingsSection} aria-labelledby="colors-heading">
      <div className={styles.sectionIntro}><Palette size={19} /><div><h2 id="colors-heading">Subject colors</h2><p>Customize the three visual anchors used across search, lists, and progress.</p></div></div>
      <Card className={styles.colorCard}>
        <div className={styles.presetButtons}>{Object.entries(SUBJECT_COLOR_PRESETS).map(([name, colors]) => <button type="button" key={name} onClick={() => update({ ...settings, colors: { ...colors } })}><span>{Object.values(colors).map((color) => <i key={color} style={{ background: color }} />)}</span><strong>{name[0].toUpperCase() + name.slice(1)}</strong></button>)}</div>
        <div className={styles.colorInputs}>{(["radical", "kanji", "vocabulary"] as const).map((key) => <label key={key}><span><i style={{ background: settings.colors[key] }} /><strong>{key[0].toUpperCase() + key.slice(1)}</strong></span><span><input type="color" value={settings.colors[key]} onChange={(event) => update({ ...settings, colors: { ...settings.colors, [key]: event.target.value } })} aria-label={`${key} color picker`} /><input type="text" value={settings.colors[key].toLocaleUpperCase()} readOnly aria-label={`${key} hexadecimal color`} /></span></label>)}</div>
      </Card>
    </section>

    <section className={styles.settingsSection} aria-labelledby="lessons-heading">
      <div className={styles.sectionIntro}><BookOpenText size={19} aria-hidden /><div><h2 id="lessons-heading">Lessons</h2><p>Choose how lessons are selected, grouped, and quizzed.</p></div></div>
      <Card padding="none" className={styles.preferenceCard}>
        <label className={styles.selectRow}><span><strong>Lesson batch size</strong><small>Subjects shown together in one lesson batch.</small></span><select aria-label="Lesson batch size" value={settings.study.lessonsBatchSize} onChange={(event) => updateStudy("lessonsBatchSize", Number(event.target.value))}>{[3, 5, 10, 15, 20].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className={styles.selectRow}><span><strong>Daily lesson limit</strong><small>Cap lessons started in this browser each day.</small></span><select aria-label="Daily lesson limit" value={settings.study.dailyLessonLimit} onChange={(event) => updateStudy("dailyLessonLimit", Number(event.target.value))}><option value={0}>No limit</option>{[5, 10, 15, 20, 30].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className={styles.selectRow}><span><strong>Lesson order</strong><small>Choose how available lessons enter a batch.</small></span><select aria-label="Lesson order" value={settings.study.lessonOrder} onChange={(event) => updateStudy("lessonOrder", event.target.value as WebSettings["study"]["lessonOrder"])}><option value="available">Available first</option><option value="subject-type">Radicals, kanji, vocabulary</option><option value="level">Lowest level first</option></select></label>
        <label className={styles.selectRow}><span><strong>Lesson question order</strong><small>Order meaning and reading prompts in lesson quizzes.</small></span><select aria-label="Lesson question order" value={settings.study.lessonQuestionOrder} onChange={(event) => updateStudy("lessonQuestionOrder", event.target.value as QuestionOrder)}><option value="mixed">Per subject</option><option value="meaning-first">All meanings first</option><option value="reading-first">All readings first</option></select></label>
      </Card>
    </section>

    <section className={styles.settingsSection} aria-labelledby="reviews-heading">
      <div className={styles.sectionIntro}><SlidersHorizontal size={19} aria-hidden /><div><h2 id="reviews-heading">Reviews</h2><p>Match the mobile app’s review order, prompt, answer, and Anki behavior.</p></div></div>
      <Card padding="none" className={styles.preferenceCard}>
        <div className={styles.subsectionHead}><h3>Review order</h3><p>Control which subjects appear first and how their questions are paired.</p></div>
        <label className={styles.selectRow}><span><strong>Review subject order</strong><small>Used by regular WaniKani review sessions.</small></span><select aria-label="Review subject order" value={settings.study.reviewOrder} onChange={(event) => updateStudy("reviewOrder", event.target.value as WebSettings["study"]["reviewOrder"])}>{REVIEW_ORDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className={styles.selectRow}><span><strong>Custom review subject order</strong><small>Used by custom reviews.</small></span><select aria-label="Custom review subject order" value={settings.study.customReviewOrder} onChange={(event) => updateStudy("customReviewOrder", event.target.value as WebSettings["study"]["customReviewOrder"])}>{REVIEW_ORDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <ToggleRow label="Group by item type" description="Keep radicals, kanji, and vocabulary grouped in your chosen order." checked={settings.study.reviewTypeOrderEnabled} onChange={(value) => updateStudy("reviewTypeOrderEnabled", value)} />
        {settings.study.reviewTypeOrderEnabled ? REVIEW_TYPE_POSITIONS.map((positionLabel, position) => {
          const reviewType = settings.study.reviewTypeOrder[position];
          if (!reviewType) return null;
          return <label className={styles.selectRow} key={positionLabel}><span><strong>{positionLabel} item type</strong><small>{positionLabel} group shown when item type grouping is enabled.</small></span><select aria-label={`${positionLabel} item type`} value={reviewType} onChange={(event) => updateReviewTypePosition(position, event.target.value as WebSettings["study"]["reviewTypeOrder"][number])}>{Object.entries(REVIEW_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>;
        }) : null}
        <ToggleRow label="Force meaning/reading order" description="Always ask your preferred question type first when both are available." checked={settings.study.reviewQuestionOrderEnabled} onChange={(value) => updateStudy("reviewQuestionOrderEnabled", value)} />
        {settings.study.reviewQuestionOrderEnabled
          ? <label className={styles.selectRow}><span><strong>Review question order</strong><small>Choose whether meaning or reading comes first.</small></span><select aria-label="Review question order" value={settings.study.reviewQuestionOrder === "reading-first" ? "reading-first" : "meaning-first"} onChange={(event) => updateStudy("reviewQuestionOrder", event.target.value as QuestionOrder)}><option value="meaning-first">Meaning first</option><option value="reading-first">Reading first</option></select></label>
          : <p className={styles.conditionalHint}>Turn this on to always show your preferred question type first.</p>}
        <ToggleRow label="Prioritize critical items" description="Show current-level Apprentice radicals and kanji first." checked={settings.study.prioritizeCriticalItems} onChange={(value) => updateStudy("prioritizeCriticalItems", value)} />

        <div className={styles.subsectionHead}><h3>Prompt</h3><p>Choose the information and aids visible while a review is active.</p></div>
        <ToggleRow label="Show item level & SRS stage" description="Display the subject level and current SRS stage together during reviews." checked={settings.study.showReviewItemLevelAndSrsStage} onChange={(value) => updateStudy("showReviewItemLevelAndSrsStage", value)} />
        <ToggleRow label="Show vocabulary frequency" description="Look up and display the word’s Jiten frequency rank on vocabulary prompts, subject details, and reader word details." checked={settings.study.showVocabularyFrequency} onChange={(value) => updateStudy("showVocabularyFrequency", value)} />
        <ToggleRow label="Vocabulary context sentence hints" description="Offer Japanese context during vocabulary reviews; translations remain hidden until revealed." checked={settings.study.showVocabContextSentencesInReviews} onChange={(value) => updateStudy("showVocabContextSentencesInReviews", value)} />
        <ToggleRow label="Review search button" description="Open this subject in Search without closing the review tab." checked={settings.study.reviewSearchButtonEnabled} onChange={(value) => updateStudy("reviewSearchButtonEnabled", value)} />
        <label className={styles.selectRow}><span><strong>Review character size</strong><small>Scale the large Japanese prompt independently of the rest of the app.</small></span><select aria-label="Review character size" value={settings.study.reviewCharacterFontScale} onChange={(event) => updateStudy("reviewCharacterFontScale", Number(event.target.value))}>{[0.7, 0.8, 0.9, 1, 1.1, 1.2].map((value) => <option key={value} value={value}>{Math.round(value * 100)}%</option>)}</select></label>
        <label className={styles.selectRow}><span><strong>Review answer size</strong><small>Scale text entered in the review answer field.</small></span><select aria-label="Review answer size" value={settings.study.reviewInputFontScale} onChange={(event) => updateStudy("reviewInputFontScale", Number(event.target.value))}>{[0.7, 0.8, 0.9, 1, 1.1, 1.2].map((value) => <option key={value} value={value}>{Math.round(value * 100)}%</option>)}</select></label>
        <div className={styles.jitaiRow}><div><strong>Jitai font randomization</strong><small>Randomize the Japanese prompt font per question from your selected pool.</small></div><ToggleRow label="Enable Jitai" description="" checked={settings.study.jitaiEnabled} onChange={(value) => updateStudy("jitaiEnabled", value)} /><div className={styles.fontGrid}>{BUILT_IN_JITAI_FONTS.map((font) => <label key={font.id} style={{ fontFamily: font.family }}><input type="checkbox" checked={settings.study.jitaiSelectedFontIds.includes(font.id)} onChange={() => toggleJitaiFont(font.id)} />{font.name} 日本語</label>)}{settings.study.jitaiCustomFonts.map((font) => <div key={font.id}><label style={{ fontFamily: `KakehashiJitai_${font.id.replace(/[^a-z0-9_]/gi, "_")}` }}><input type="checkbox" checked={settings.study.jitaiSelectedFontIds.includes(font.id)} onChange={() => toggleJitaiFont(font.id)} />{font.name} 日本語</label><button type="button" onClick={() => removeFont(font.id)} aria-label={`Remove ${font.name}`}><Trash2 size={15} aria-hidden /></button></div>)}</div><label className={styles.fontUpload}><FileUp size={16} aria-hidden />Upload font<input type="file" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" onChange={(event) => { void importFont(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>{fontError ? <p className={styles.inlineError} role="alert">{fontError}</p> : null}</div>

        <div className={styles.subsectionHead}><h3>Answer behavior</h3><p>Control pauses, accepted answers, navigation, and queue limits.</p></div>
        <ToggleRow label="Keyboard shortcuts" description="Use number keys, Enter, and Space in review sessions." checked={settings.study.keyboardShortcuts} onChange={(value) => updateStudy("keyboardShortcuts", value)} icon={<Keyboard size={17} />} />
        <ToggleRow label="Pause on wrong answer" description="Wait so you can inspect the correct answer before continuing." checked={settings.study.pauseOnWrong} onChange={(value) => updateStudy("pauseOnWrong", value)} />
        <ToggleRow label="Pause on close answer" description="Wait after a fuzzy meaning match so you can inspect what was accepted." checked={settings.study.pauseOnClose} onChange={(value) => updateStudy("pauseOnClose", value)} />
        <ToggleRow label="Pause on correct answer" description="Wait after precise answers instead of progressing automatically." checked={settings.study.pauseOnCorrect} onChange={(value) => updateStudy("pauseOnCorrect", value)} />
        <ToggleRow label="Answer feedback sounds" description="Play a short cue after correct and incorrect review answers." checked={settings.study.answerFeedbackSoundEnabled} onChange={(value) => updateStudy("answerFeedbackSoundEnabled", value)} />
        <label className={styles.selectRow}><span><strong>SRS progression</strong><small>Show the new SRS stage after a review subject is submitted.</small></span><select aria-label="SRS progression" value={settings.study.srsProgressionCardDisplayMode} onChange={(event) => updateStudy("srsProgressionCardDisplayMode", event.target.value as WebSettings["study"]["srsProgressionCardDisplayMode"])}><option value="normal">Normal</option><option value="compact">Compact</option><option value="hidden">Hidden</option></select></label>
        <ToggleRow label="Show details on answer pause" description="Open the full subject details when the selected answer outcome pauses." checked={settings.study.showAnswerStopSubjectDetails} onChange={(value) => updateStudy("showAnswerStopSubjectDetails", value)} />
        <ToggleRow label="Allow skipping reviews" description="Move the current question to the end without recording an incorrect answer." checked={settings.study.allowSkippingReviews} onChange={(value) => updateStudy("allowSkippingReviews", value)} />
        <ToggleRow label="Accept user synonyms" description="Treat your WaniKani meaning synonyms as correct review answers." checked={settings.study.acceptUserSynonymsAsAnswers} onChange={(value) => updateStudy("acceptUserSynonymsAsAnswers", value)} />
        <ToggleRow label="Show + Synonym button" description="Show the synonym action when a meaning answer is paused as wrong." checked={settings.study.showAddSynonymButton} onChange={(value) => updateStudy("showAddSynonymButton", value)} />
        <ToggleRow label="Accept any kanji on’yomi reading" description="Treat every accepted on’yomi as correct on kanji reading questions." checked={settings.study.acceptAnyKanjiOnyomiReading} onChange={(value) => updateStudy("acceptAnyKanjiOnyomiReading", value)} />
        <ToggleRow label="Voice answers" description={voiceSupported ? "Dictate into the focused answer field using browser speech recognition." : "Unavailable in this browser; typed answers remain available."} checked={voiceSupported && settings.study.voiceAnswers} disabled={!voiceSupported} onChange={(value) => updateStudy("voiceAnswers", value)} />
        <ToggleRow label="Back-to-back questions" description="Show meaning and reading questions consecutively for each item." checked={settings.study.backToBackQuestions} disabled={groupedAnkiQuestions} onChange={(value) => updateStudy("backToBackQuestions", value)} />
        {settings.study.backToBackQuestions && !groupedAnkiQuestions ? <ToggleRow label="Immediate retry on wrong" description="Re-ask failed questions right away in back-to-back mode." checked={settings.study.backToBackImmediateRetryIncorrect} onChange={(value) => updateStudy("backToBackImmediateRetryIncorrect", value)} /> : null}
        <ToggleRow label="Animate previous question" description="Move the previous answer card from the center to the top-left." checked={settings.study.reviewAnimatePreviousQuestion} onChange={(value) => updateStudy("reviewAnimatePreviousQuestion", value)} />
        <label className={styles.selectRow}><span><strong>Wrap-up size</strong><small>Subjects left after choosing Wrap Up.</small></span><select aria-label="Wrap-up size" value={settings.study.reviewWrapUpSize} onChange={(event) => updateStudy("reviewWrapUpSize", Number(event.target.value))}>{[5, 10, 15, 20].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <ToggleRow label="Limit review batch size" description="Cap the number of reviews loaded into the queue." checked={settings.study.reviewBatchSizeEnabled} onChange={(value) => updateStudy("reviewBatchSizeEnabled", value)} />
        {settings.study.reviewBatchSizeEnabled ? <label className={styles.selectRow}><span><strong>Review batch size</strong><small>Number of subjects loaded per review session.</small></span><select aria-label="Review batch size" value={settings.study.reviewBatchSize} onChange={(event) => updateStudy("reviewBatchSize", Number(event.target.value))}>{REVIEW_BATCH_SIZE_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label> : null}

        <div className={styles.subsectionHead}><h3>Anki mode</h3><p>Reveal answers and grade yourself using the familiar Anki flow.</p></div>
        <label className={styles.selectRow}><span><strong>Anki mode</strong><small>Choose which question types use reveal-and-grade cards.</small></span><select aria-label="Anki mode" value={settings.study.ankiMode} onChange={(event) => { const ankiMode = event.target.value as AnkiMode; update({ ...settings, study: { ...settings.study, ankiMode, ankiGroupQuestions: ankiMode === "both" ? settings.study.ankiGroupQuestions : false } }); }}><option value="off">Off</option><option value="both">Meanings and readings</option><option value="meaning">Meanings only</option><option value="reading">Readings only</option></select></label>
        {settings.study.ankiMode !== "off" ? <>
          <ToggleRow label="Group meaning and reading" description={settings.study.ankiMode === "both" ? "Reveal and grade both sides of a subject on one card." : "Only available when “Meanings and readings” is selected."} checked={settings.study.ankiGroupQuestions} disabled={settings.study.ankiMode !== "both"} onChange={(value) => updateStudy("ankiGroupQuestions", value)} />
          <ToggleRow label="Hide answer completely" description="Hide the answer until reveal instead of showing a blurred length hint." checked={settings.study.ankiHideAnswerCompletely} onChange={(value) => updateStudy("ankiHideAnswerCompletely", value)} />
          <ToggleRow label="Buttonless Anki mode" description="After reveal, tap or swipe the card to grade, show details, or skip." checked={settings.study.ankiButtonlessMode} onChange={(value) => updateStudy("ankiButtonlessMode", value)} />
          <ToggleRow label="Show other accepted answers" description="Include alternate accepted answers and your user synonyms after reveal." checked={settings.study.ankiShowOtherAcceptedAnswersAndUserSynonyms} onChange={(value) => updateStudy("ankiShowOtherAcceptedAnswersAndUserSynonyms", value)} />
          <ToggleRow label="Show parts of speech" description="Include WaniKani vocabulary grammar tags after reveal." checked={settings.study.ankiShowWaniKaniGrammarTags} onChange={(value) => updateStudy("ankiShowWaniKaniGrammarTags", value)} />
          <ToggleRow label="Show pitch accent numbers" description="Add compact pitch numbers to vocabulary reading cards." checked={settings.study.ankiShowPitchAccentNumbers} onChange={(value) => updateStudy("ankiShowPitchAccentNumbers", value)} />
          <ToggleRow label="Show pitch accent graph" description="Add the mobile-style pitch contour after revealing a reading." checked={settings.study.ankiShowPitchAccentGraph} onChange={(value) => updateStudy("ankiShowPitchAccentGraph", value)} />
          <ToggleRow label="Show replay audio button" description="Add a pronunciation replay action beside the revealed answer." checked={settings.study.ankiShowReplayAudioButton} onChange={(value) => updateStudy("ankiShowReplayAudioButton", value)} />
        </> : null}

        <div className={styles.subsectionHead}><h3>Vocabulary audio</h3><p>Choose automatic pronunciation and the preferred voice.</p></div>
        <ToggleRow label="Autoplay vocabulary audio" description="Play pronunciation after a correct reading or when an Anki reading is revealed." checked={settings.study.autoplayAudio} onChange={(value) => updateStudy("autoplayAudio", value)} />
        {settings.study.autoplayAudio ? <label className={styles.selectRow}><span><strong>Voice actor</strong><small>Prefer Kyoko, Kenichi, a random voice, or play both.</small></span><select aria-label="Voice actor" value={settings.study.vocabularyAudioVoice} onChange={(event) => updateStudy("vocabularyAudioVoice", event.target.value as WebSettings["study"]["vocabularyAudioVoice"])}><option value="female">Female · Kyoko</option><option value="male">Male · Kenichi</option><option value="random">Random</option><option value="both">Both</option></select></label> : null}
      </Card>
    </section>

    <section className={styles.settingsSection} aria-labelledby="extra-study-reading-heading">
      <div className={styles.sectionIntro}><Check size={19} aria-hidden /><div><h2 id="extra-study-reading-heading">Extra study &amp; reading</h2><p>Set defaults for custom quizzes, listening practice, and books.</p></div></div>
      <Card padding="none" className={styles.preferenceCard}>
        <ToggleRow label="Shuffle subjects" description="Randomize selected subjects before an extra study session starts." checked={settings.study.shuffleSubjects} onChange={(value) => updateStudy("shuffleSubjects", value)} />
        <ToggleRow label="Show listening translation control" description="Add a reveal button to anime listening prompts. Translations stay hidden until you choose to show them." checked={settings.study.showListeningTranslation} onChange={(value) => updateStudy("showListeningTranslation", value)} />
        <div className={styles.animePickerRow}><span><strong>Anime listening sources</strong><small>Choose visually or sync the shows you watch on MyAnimeList or AniList.</small></span><AnimePicker selectedSources={settings.study.immersionKitAnimeSources} onChange={(sources) => updateStudy("immersionKitAnimeSources", sources)} label="Anime listening sources" syncUsernames={{ myanimelist: settings.integrations.myAnimeListUsername, anilist: settings.integrations.aniListUsername }} onSyncUsernameChange={updateAnimeUsername} /></div>
        <label className={styles.selectRow}><span><strong>EPUB daily goal</strong><small>Active reading time counted locally while a book is open.</small></span><select aria-label="EPUB daily goal" value={settings.study.epubDailyGoalMinutes} onChange={(event) => updateStudy("epubDailyGoalMinutes", Number(event.target.value))}>{[5, 10, 15, 20, 30, 45, 60].map((value) => <option key={value} value={value}>{value} minutes</option>)}</select></label>
      </Card>
    </section>

    <section className={styles.settingsSection} aria-labelledby="subject-details-heading">
      <div className={styles.sectionIntro}><BookOpenText size={19} aria-hidden /><div><h2 id="subject-details-heading">Subject details</h2><p>Choose the extra learning aids shown on radical, kanji, and vocabulary pages.</p></div></div>
      <Card padding="none" className={styles.preferenceCard}>
        <ToggleRow label="Show pitch accent" description="Add pitch patterns to kanji and vocabulary readings." checked={settings.subjectDetails.showPitchAccent} onChange={(value) => updateSubjectDetails("showPitchAccent", value)} />
        <ToggleRow label="Examples by kanji reading" description="Group vocabulary examples under the kanji reading they use." checked={settings.subjectDetails.showKanjiReadingExamples} onChange={(value) => updateSubjectDetails("showKanjiReadingExamples", value)} />
        <ToggleRow label="Show kanji stroke order" description="Add an animated Stroke tab to kanji details." checked={settings.subjectDetails.showStrokeOrder} onChange={(value) => updateSubjectDetails("showStrokeOrder", value)} />
        <ToggleRow label="Show vocabulary patterns of use" description="Add selectable collocation patterns and examples to vocabulary context." checked={settings.subjectDetails.showPatternsOfUse} onChange={(value) => updateSubjectDetails("showPatternsOfUse", value)} />
        <ToggleRow label="Show WaniKani context sentences" description="Include the official example sentences supplied with vocabulary subjects." checked={settings.subjectDetails.showContextSentences} onChange={(value) => updateSubjectDetails("showContextSentences", value)} />
        <ToggleRow label="Show anime context examples" description="Look up an ImmersionKit scene using your saved anime source preferences." checked={settings.subjectDetails.showImmersionExamples} onChange={(value) => updateSubjectDetails("showImmersionExamples", value)} />
      </Card>
    </section>

    <section className={styles.settingsSection} aria-labelledby="reader-integrations-heading">
      <div className={styles.sectionIntro}><KeyRound size={19} /><div><h2 id="reader-integrations-heading">Reader interactions</h2><p>Use the same word selection and recognition behavior across manga, news, lyrics, video, and books.</p></div></div>
      <Card padding="none" className={styles.preferenceCard}>
        <label className={styles.selectRow}><span><strong>Word details</strong><small>Click keeps hover as a visual highlight only. Hover opens details as soon as the pointer enters a word.</small></span><select value={settings.reader.detailsInteraction} onChange={(event) => updateReader("detailsInteraction", event.target.value as WebSettings["reader"]["detailsInteraction"])}><option value="click">Click</option><option value="hover">Hover</option></select></label>
        <label className={styles.selectRow}><span><strong>Text recognition</strong><small>Choose exact WaniKani matching or add JPDB parsing for grammar, verbs, and vocabulary.</small></span><select value={settings.reader.recognitionMode} onChange={(event) => updateReader("recognitionMode", event.target.value as WebSettings["reader"]["recognitionMode"])}><option value="wk">WaniKani only</option><option value="wk-jpdb">WaniKani + JPDB</option></select></label>
        <label id="jpdb-api-key" className={`${styles.selectRow} ${styles.settingsAnchor}`}><span><strong>JPDB API key</strong><small>Saved only in this browser and sent through Kakehashi when you analyze Japanese, translate a manga selection, song lyrics, or a video transcript. Copy your free key from JPDB account settings.</small></span><input className={styles.textInput} type="password" autoComplete="off" spellCheck={false} value={settings.integrations.jpdbApiKey} onChange={(event) => update({ ...settings, integrations: { ...settings.integrations, jpdbApiKey: event.target.value } })} placeholder="Paste JPDB key" /></label>
        <ToggleRow label="English lyric translations" description={settings.integrations.jpdbApiKey.trim() ? "Show JPDB machine translations beneath each Japanese lyric line." : "Save a JPDB API key to enable line-by-line song translations."} checked={settings.study.songsLyricsLineTranslationsEnabled} disabled={!settings.integrations.jpdbApiKey.trim()} onChange={(value) => updateStudy("songsLyricsLineTranslationsEnabled", value)} />
      </Card>
    </section>

    <section className={styles.settingsSection} aria-labelledby="workspace-heading">
      <div className={styles.sectionIntro}><LayoutDashboard size={19} /><div><h2 id="workspace-heading">Workspace layout</h2><p>Choose your desktop navbar tabs, trim optional destinations, and arrange dashboard sections.</p></div></div>
      <div className={styles.workspaceOptions}>
        <Card padding="none" className={styles.preferenceCard}>
          <div className={styles.subsectionHead}><h3>Desktop navbar tabs</h3><p>{settings.workspace.navbarTabs.length} shown. Home and Level are fixed; other tabs stay in More unless hidden below.</p></div>
          {NAVBAR_TAB_OPTIONS.map((option) => {
            const checked = settings.workspace.navbarTabs.includes(option.id);
            const required = REQUIRED_NAVBAR_TABS.has(option.id);
            const description = required ? `${option.description} Always shown.` : option.description;
            return <ToggleRow key={option.id} label={option.label} description={description} checked={checked} disabled={required} onChange={() => toggleNavbarTab(option.id)} />;
          })}
          <div className={styles.subsectionHead}><h3>More menu</h3><p>Choose which optional destinations appear in More and in standalone header shortcuts.</p></div>
          {OPTIONAL_NAV_ITEMS.map((id) => <ToggleRow key={id} label={WORKSPACE_LABELS[id]} description={`Show ${WORKSPACE_LABELS[id].toLocaleLowerCase()} in More and related shortcuts.`} checked={settings.workspace.visibleNav.includes(id)} onChange={() => toggleNav(id)} />)}
        </Card>
        <DashboardLayoutEditor settings={settings} onChange={update} />
      </div>
    </section>

    <section className={styles.settingsSection} aria-labelledby="account-heading">
      <div className={styles.sectionIntro}><LogOut size={19} aria-hidden /><div><h2 id="account-heading">Account</h2><p>Manage the active WaniKani session on this browser.</p></div></div>
      <Card padding="none" className={styles.preferenceCard}>
        <div className={styles.accountRow}>
          <span>
            <strong>Sign out</strong>
            <small>Your settings and locally stored reading data will stay on this device.</small>
            {signOutError ? <small className={styles.inlineError} role="alert">{signOutError}</small> : null}
          </span>
          <Button type="button" tone="danger" state={signingOut ? "loading" : signOutError ? "error" : "idle"} onClick={() => void handleSignOut()}>
            {!signingOut && !signOutError ? <LogOut size={16} aria-hidden /> : null}
            {signingOut ? "Signing out…" : signOutError ? "Try again" : "Sign out"}
          </Button>
        </div>
      </Card>
    </section>
  </main>;
}

function DashboardLayoutEditor({ settings, onChange }: { settings: WebSettings; onChange: (settings: WebSettings) => void }) {
  const [draggedId, setDraggedId] = useState<DashboardSectionId | null>(null);
  const draggedIdRef = useRef<DashboardSectionId | null>(null);
  const [dropTargetId, setDropTargetId] = useState<DashboardSectionId | "available" | "end" | null>(null);
  const [canvasDropTarget, setCanvasDropTarget] = useState<DashboardCanvasDropTarget | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const hidden = new Set(settings.workspace.hiddenDashboard);
  const activeIds = settings.workspace.dashboardOrder.filter((id): id is DashboardSectionId => DASHBOARD_DEFINITION_BY_ID.has(id as DashboardSectionId) && !hidden.has(id));
  const availableIds = settings.workspace.dashboardOrder.filter((id): id is DashboardSectionId => DASHBOARD_DEFINITION_BY_ID.has(id as DashboardSectionId) && hidden.has(id));
  const rowStarts = settings.workspace.dashboardRowStarts ?? [];

  const saveLayout = (nextActive: DashboardSectionId[], nextAvailable: DashboardSectionId[], message: string, nextRowStarts = rowStarts) => {
    onChange({
      ...settings,
      workspace: {
        ...settings.workspace,
        dashboardOrder: [...nextActive, ...nextAvailable],
        hiddenDashboard: nextAvailable,
        dashboardRowStarts: [...new Set(nextRowStarts.filter((id) => nextActive.includes(id) && id !== nextActive[0]))],
      },
    });
    setAnnouncement(message);
  };
  const addSection = (id: DashboardSectionId, beforeId?: DashboardSectionId) => {
    const nextActive = [...activeIds];
    const targetIndex = beforeId ? nextActive.indexOf(beforeId) : -1;
    if (targetIndex >= 0) nextActive.splice(targetIndex, 0, id);
    else nextActive.push(id);
    saveLayout(nextActive, availableIds.filter((item) => item !== id), `${DASHBOARD_DEFINITION_BY_ID.get(id)?.label} added to the dashboard.`);
  };
  const hideSection = (id: DashboardSectionId) => saveLayout(activeIds.filter((item) => item !== id), [...availableIds, id], `${DASHBOARD_DEFINITION_BY_ID.get(id)?.label} hidden.`);
  const moveSection = (id: DashboardSectionId, offset: -1 | 1) => {
    const index = activeIds.indexOf(id);
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= activeIds.length) return;
    const next = [...activeIds];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    saveLayout(next, availableIds, `${DASHBOARD_DEFINITION_BY_ID.get(id)?.label} moved ${offset < 0 ? "up" : "down"}.`);
  };
  const resizeSection = (id: DashboardSectionId, width: DashboardSectionWidth) => {
    onChange({ ...settings, workspace: { ...settings.workspace, dashboardWidths: { ...settings.workspace.dashboardWidths, [id]: width } } });
    setAnnouncement(`${DASHBOARD_DEFINITION_BY_ID.get(id)?.label} set to ${DASHBOARD_WIDTH_NAMES[width]}.`);
  };
  const restoreDashboard = () => {
    onChange({ ...settings, workspace: { ...settings.workspace, dashboardOrder: [...DEFAULT_DASHBOARD_SECTION_ORDER], hiddenDashboard: [...DEFAULT_HIDDEN_DASHBOARD_SECTIONS], dashboardWidths: { ...DEFAULT_DASHBOARD_SECTION_WIDTHS }, dashboardRowStarts: [] } });
    setAnnouncement("Dashboard layout restored to its default sections and sizes.");
  };
  const startDrag = (event: DragEvent<HTMLElement>, id: DashboardSectionId) => {
    draggedIdRef.current = id;
    setDraggedId(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  };
  const sourceFromDrop = (event: DragEvent<HTMLElement>) => {
    const transferredId = event.dataTransfer.getData("text/plain");
    return (DASHBOARD_DEFINITION_BY_ID.has(transferredId as DashboardSectionId) ? transferredId : draggedIdRef.current) as DashboardSectionId | null;
  };
  const finishDrag = () => { draggedIdRef.current = null; setDraggedId(null); setDropTargetId(null); setCanvasDropTarget(null); };
  const canvasTargetFromEvent = (event: DragEvent<HTMLOListElement>) => {
    const list = event.currentTarget;
    const listBounds = list.getBoundingClientRect();
    const computed = window.getComputedStyle(list);
    const paddingLeft = Number.parseFloat(computed.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(computed.paddingRight) || 0;
    const paddingTop = Number.parseFloat(computed.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(computed.paddingBottom) || 0;
    const items = [...list.querySelectorAll<HTMLElement>(":scope > li[data-editor-section]")].map((item) => {
      const bounds = item.getBoundingClientRect();
      return { id: item.dataset.editorSection as DashboardSectionId, left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom };
    });
    const target = dashboardCanvasDropTarget(items, { x: event.clientX, y: event.clientY }, { left: listBounds.left + paddingLeft, top: listBounds.top + paddingTop, right: listBounds.right - paddingRight, bottom: listBounds.bottom - paddingBottom });
    if (!target) return null;
    return { ...target, indicator: { ...target.indicator, left: target.indicator.left - listBounds.left, top: target.indicator.top - listBounds.top } };
  };
  const dragOverCanvas = (event: DragEvent<HTMLOListElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetId(null);
    setCanvasDropTarget(canvasTargetFromEvent(event));
  };
  const dropOnCanvas = (event: DragEvent<HTMLOListElement>) => {
    event.preventDefault();
    const source = sourceFromDrop(event);
    const target = canvasTargetFromEvent(event) ?? canvasDropTarget;
    if (!source || !target || (source === target.beforeId && target.kind === "item")) return finishDrag();
    const nextActive = activeIds.filter((id) => id !== source);
    const targetIndex = target.beforeId === source ? Math.min(activeIds.indexOf(source), nextActive.length) : target.beforeId ? nextActive.indexOf(target.beforeId) : -1;
    nextActive.splice(targetIndex >= 0 ? targetIndex : nextActive.length, 0, source);
    const nextRowStarts = rowStarts.filter((id) => id !== source);
    if (target.kind === "row") nextRowStarts.push(source);
    saveLayout(nextActive, availableIds.filter((id) => id !== source), `${DASHBOARD_DEFINITION_BY_ID.get(source)?.label} ${target.kind === "row" ? "moved to a new row" : "moved"}.`, nextRowStarts);
    finishDrag();
  };
  const dropAtEnd = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const source = sourceFromDrop(event);
    if (!source) return finishDrag();
    if (availableIds.includes(source)) addSection(source);
    else saveLayout([...activeIds.filter((item) => item !== source), source], availableIds, `${DASHBOARD_DEFINITION_BY_ID.get(source)?.label} moved to the end.`, rowStarts.filter((id) => id !== source));
    finishDrag();
  };
  const dropToAvailable = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const source = sourceFromDrop(event);
    if (source && activeIds.includes(source)) hideSection(source);
    finishDrag();
  };

  return <Card padding="none" className={`${styles.preferenceCard} ${styles.dashboardEditor}`}>
    <div className={`${styles.subsectionHead} ${styles.dashboardEditorHead}`}><div><h3>Dashboard canvas</h3><p>Drag widgets inline, then choose the width that fits each one. Preview values are placeholders; the structure matches the live dashboard.</p></div><button type="button" className={styles.restoreDashboardButton} onClick={restoreDashboard}><RotateCcw size={15} aria-hidden /> Restore dashboard</button></div>
    <div className={styles.editorCanvas}>
      <div className={styles.layoutCanvas}>
        <div className={styles.editorColumnHead}><h4>On your dashboard</h4><span>{activeIds.length} shown</span></div>
        <ol className={styles.dashboardSectionList} aria-label="Visible dashboard sections" data-drag-active={Boolean(draggedId) || undefined} onDragOver={dragOverCanvas} onDrop={dropOnCanvas}>
          {activeIds.map((id, index) => {
            const definition = DASHBOARD_DEFINITION_BY_ID.get(id)!;
            const width = settings.workspace.dashboardWidths[id] ?? definition.defaultWidth;
            return <li key={id} draggable onDragStart={(event) => startDrag(event, id)} onDragEnd={finishDrag} data-dragging={draggedId === id || undefined} data-editor-section={id} data-editor-width={width} data-editor-row-start={rowStarts.includes(id) || undefined} style={{ "--editor-section-span": width } as React.CSSProperties}>
              <div className={styles.widgetToolbar}>
                <span className={styles.dragHandle} aria-hidden title={`Drag ${definition.label}`}><GripVertical size={17} /></span>
                <span className={styles.widgetToolbarTitle}><strong>{definition.label}</strong><small>{definition.source} · layout preview</small></span>
                <span className={styles.widthOptions} role="group" aria-label={`Width for ${definition.label}`}>{definition.allowedWidths.map((option) => <button type="button" key={option} aria-pressed={width === option} aria-label={`Set ${definition.label} to ${DASHBOARD_WIDTH_NAMES[option]}`} title={DASHBOARD_WIDTH_NAMES[option]} onClick={() => resizeSection(id, option)}>{DASHBOARD_WIDTH_LABELS[option]}</button>)}</span>
                <span className={styles.sectionCardActions}>
                  <button type="button" disabled={index === 0} onClick={() => moveSection(id, -1)} aria-label={`Move ${definition.label} up`}><ArrowUp size={15} aria-hidden /></button>
                  <button type="button" disabled={index === activeIds.length - 1} onClick={() => moveSection(id, 1)} aria-label={`Move ${definition.label} down`}><ArrowDown size={15} aria-hidden /></button>
                  <button type="button" onClick={() => hideSection(id)} aria-label={`Hide ${definition.label}`}><EyeOff size={15} aria-hidden /></button>
                </span>
              </div>
              <DashboardWidgetPreview id={id} />
            </li>;
          })}
          {draggedId && canvasDropTarget ? <li className={styles.dashboardDropIndicator} data-drop-kind={canvasDropTarget.kind} aria-hidden style={{ left: canvasDropTarget.indicator.left, top: canvasDropTarget.indicator.top, width: canvasDropTarget.indicator.width, height: canvasDropTarget.indicator.height }} /> : null}
        </ol>
        <div className={styles.endDropZone} data-drop-target={dropTargetId === "end" || undefined} onDragOver={(event) => { event.preventDefault(); setCanvasDropTarget(null); setDropTargetId("end"); }} onDrop={dropAtEnd}>Drop here to place a widget last</div>
      </div>
      <div className={styles.availableTray} data-available-drop={dropTargetId === "available" || undefined} onDragOver={(event) => { event.preventDefault(); setCanvasDropTarget(null); if (draggedId && activeIds.includes(draggedId)) setDropTargetId("available"); }} onDrop={dropToAvailable}>
        <div className={styles.editorColumnHead}><div><h4>Available widgets</h4><p>Drag one into the canvas or add it at the end.</p></div><span>{availableIds.length} hidden</span></div>
        {availableIds.length ? <ul className={styles.availableSectionList}>{availableIds.map((id) => {
          const definition = DASHBOARD_DEFINITION_BY_ID.get(id)!;
          return <li key={id} draggable onDragStart={(event) => startDrag(event, id)} onDragEnd={finishDrag} data-available-section={id} data-dragging={draggedId === id || undefined}>
            <div className={styles.widgetToolbar}><span className={styles.dragHandle} aria-hidden title={`Drag ${definition.label}`}><GripVertical size={17} /></span><span className={styles.widgetToolbarTitle}><strong>{definition.label}</strong><small>{definition.source}</small></span><button type="button" className={styles.addSectionButton} onClick={() => addSection(id)} aria-label={`Add ${definition.label}`}><Plus size={15} aria-hidden /> Add</button></div>
            <DashboardWidgetPreview id={id} density="catalog" />
            <p className={styles.availableDescription}>{definition.description}</p>
          </li>;
        })}</ul> : <p className={styles.allSectionsShown}>Every available widget is on your dashboard. Drag a visible widget here to hide it.</p>}
      </div>
    </div>
    <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
  </Card>;
}

export function JapaneseVoiceDownloadSetting() {
  const voice = useJapaneseVoice();
  if (voice.downloaded) return null;

  const checking = !voice.checked;
  const downloading = voice.activity === "downloading";
  const unavailable = voice.checked && !voice.supported;
  const buttonLabel = checking
    ? "Checking…"
    : unavailable
      ? "Unavailable"
      : downloading
        ? "Cancel download"
        : voice.error
          ? "Retry download"
          : `Download voice · ${JAPANESE_VOICE_DOWNLOAD_LABEL}`;

  return <section id="japanese-voice" className={`${styles.settingsSection} ${styles.settingsAnchor}`} aria-labelledby="japanese-voice-heading">
    <div className={styles.sectionIntro}><Volume2 size={19} aria-hidden /><div><h2 id="japanese-voice-heading">Japanese voice</h2><p>Optional local speech for context sentences and JLPT listening practice.</p></div></div>
    <Card padding="none" className={styles.preferenceCard}>
      <div className={styles.downloadRow}>
        <span>
          <strong>Japanese context voice</strong>
          {voice.error
            ? <small className={styles.inlineError} role="alert">{voice.error}</small>
            : <small>{checking
              ? "Checking whether this browser can save and run the voice…"
              : unavailable
                ? "This browser cannot save or run the optional voice. Context sentences remain readable."
                : downloading && voice.message
                  ? voice.message
                  : `Download ${JAPANESE_VOICE_NAME} once and keep it in this browser (${JAPANESE_VOICE_DOWNLOAD_LABEL}).`}</small>}
        </span>
        <Button type="button" size="small" disabled={checking || unavailable} interactiveWhileLoading={downloading} state={downloading ? "loading" : voice.error ? "error" : "idle"} onClick={() => downloading ? voice.cancelDownload() : void voice.download()}>
          {!checking && !unavailable && !downloading && !voice.error ? <Download size={15} aria-hidden /> : null}
          {buttonLabel}
        </Button>
      </div>
    </Card>
  </section>;
}

function ToggleRow({ label, description, checked, onChange, icon, disabled = false }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void; icon?: React.ReactNode; disabled?: boolean }) {
  return <label className={styles.toggleRow} aria-disabled={disabled}><span>{icon}<span><strong>{label}</strong>{description ? <small>{description}</small> : null}</span></span><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden /></label>;
}
