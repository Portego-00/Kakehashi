"use client";

import { type KeyboardEvent, useEffect, useState, useSyncExternalStore } from "react";
import { ArrowDown, ArrowUp, Check, FileUp, KeyRound, Keyboard, LayoutDashboard, Moon, Palette, RotateCcw, SlidersHorizontal, Trash2, Type } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSession } from "@/lib/session";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { BUILT_IN_JITAI_FONTS, deleteCustomJitaiFont, installCustomJitaiFonts, readFontFile, saveCustomJitaiFont } from "../jitai";
import { applyWebSettings, DEFAULT_WEB_SETTINGS, loadWebSettings, OPTIONAL_NAV_ITEMS, saveWebSettings, SUBJECT_COLOR_PRESETS, type AnswerStopBehavior, type AnkiMode, type QuestionOrder, type TextScale, type WebSettings } from "../settings";
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
const WORKSPACE_LABELS: Record<string, string> = { analytics: "Analytics", items: "Items", search: "Search", lists: "Subject lists", news: "News", reader: "Text reader", epubs: "Books", music: "Lyrics", video: "Video", manga: "Manga", translator: "Translator", community: "Community", "daily-study": "Daily study", srs: "SRS breakdown", level: "Level progress", forecast: "Review forecast", "extra-study": "Extra study", "study-pulse": "Study pulse", "keep-moving": "Reading tools" };

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
  const { user } = useSession();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const username = user?.data.username ?? "anonymous";
  const [settings, setSettings] = useState<WebSettings>(DEFAULT_WEB_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [fontError, setFontError] = useState("");
  const voiceSupported = useSyncExternalStore(noopSubscribe, () => {
    const browser = window as typeof window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    return Boolean(browser.SpeechRecognition || browser.webkitSpeechRecognition);
  }, () => false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const loaded = loadWebSettings(storage, username);
      setSettings(loaded);
      applyWebSettings(loaded);
    }, 0);
    return () => window.clearTimeout(timer);
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
  const toggleNav = (id: string) => update({ ...settings, workspace: { ...settings.workspace, visibleNav: settings.workspace.visibleNav.includes(id) ? settings.workspace.visibleNav.filter((item) => item !== id) : [...settings.workspace.visibleNav, id] } });
  const toggleDashboard = (id: string) => update({ ...settings, workspace: { ...settings.workspace, hiddenDashboard: settings.workspace.hiddenDashboard.includes(id) ? settings.workspace.hiddenDashboard.filter((item) => item !== id) : [...settings.workspace.hiddenDashboard, id] } });
  const moveDashboard = (id: string, offset: number) => { const order = [...settings.workspace.dashboardOrder]; const from = order.indexOf(id); const to = Math.max(0, Math.min(order.length - 1, from + offset)); if (from === to) return; const [item] = order.splice(from, 1); order.splice(to, 0, item); update({ ...settings, workspace: { ...settings.workspace, dashboardOrder: order } }); };
  const reset = () => {
    settings.study.jitaiCustomFonts.forEach((font) => { void deleteCustomJitaiFont(font.id).catch(() => undefined); });
    update(DEFAULT_WEB_SETTINGS);
    setTheme("system");
    setConfirmReset(false);
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

  return <main className={`page ${styles.page}`}>
    <header className="page-header"><div><h1>Settings</h1><p>Appearance and study behavior are saved locally for {username} on this browser.</p></div><div className={styles.headerActions}><span className={styles.savedStatus} role="status" aria-live="polite">{saved ? <Badge tone="success"><Check size={13} /> Saved</Badge> : null}</span>{confirmReset ? <><Button tone="danger" onClick={reset}>Confirm Reset</Button><Button tone="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button></> : <Button tone="ghost" onClick={() => setConfirmReset(true)}><RotateCcw size={16} /> Reset</Button>}</div></header>

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

    <section className={styles.settingsSection} aria-labelledby="study-heading">
      <div className={styles.sectionIntro}><SlidersHorizontal size={19} /><div><h2 id="study-heading">Study preferences</h2><p>Defaults used when you start lessons, reviews, and extra study modes.</p></div></div>
      <Card padding="none" className={styles.preferenceCard}>
        <ToggleRow label="Autoplay pronunciation audio" description="Play vocabulary audio after a correct answer." checked={settings.study.autoplayAudio} onChange={(value) => updateStudy("autoplayAudio", value)} />
        <ToggleRow label="Show SRS indicator" description="Keep the subject’s current stage visible during study." checked={settings.study.showSrsIndicator} onChange={(value) => updateStudy("showSrsIndicator", value)} />
        <ToggleRow label="Keyboard shortcuts" description="Use number keys, Enter, and Space in study sessions." checked={settings.study.keyboardShortcuts} onChange={(value) => updateStudy("keyboardShortcuts", value)} icon={<Keyboard size={17} />} />
        <ToggleRow label="Shuffle subjects" description="Randomize selected subjects before a session starts." checked={settings.study.shuffleSubjects} onChange={(value) => updateStudy("shuffleSubjects", value)} />
        <label className={styles.selectRow}><span><strong>Lesson batch size</strong><small>Subjects shown together in one lesson batch.</small></span><select value={settings.study.lessonsBatchSize} onChange={(event) => updateStudy("lessonsBatchSize", Number(event.target.value))}>{[3, 5, 10, 15, 20].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className={styles.selectRow}><span><strong>Lesson question order</strong><small>Order meaning and reading prompts in lesson quizzes.</small></span><select value={settings.study.lessonQuestionOrder} onChange={(event) => updateStudy("lessonQuestionOrder", event.target.value as QuestionOrder)}><option value="mixed">Per subject</option><option value="meaning-first">All meanings first</option><option value="reading-first">All readings first</option></select></label>
        <label className={styles.selectRow}><span><strong>Review question order</strong><small>Order meaning and reading prompts in reviews.</small></span><select value={settings.study.reviewQuestionOrder} onChange={(event) => updateStudy("reviewQuestionOrder", event.target.value as QuestionOrder)}><option value="mixed">Per subject</option><option value="meaning-first">All meanings first</option><option value="reading-first">All readings first</option></select></label>
        <label className={styles.selectRow}><span><strong>Pause after answers</strong><small>Choose when answer feedback waits for you before continuing.</small></span><select value={settings.study.answerStopBehavior} onChange={(event) => updateStudy("answerStopBehavior", event.target.value as AnswerStopBehavior)}><option value="always">Every answer</option><option value="incorrect">Incorrect answers only</option><option value="never">Never (brief feedback)</option></select></label>
        <ToggleRow label="Show details at answer stops" description="Expand meaning, reading, and context while feedback is paused." checked={settings.study.showAnswerStopSubjectDetails} onChange={(value) => updateStudy("showAnswerStopSubjectDetails", value)} />
        <label className={styles.selectRow}><span><strong>Self-assessment cards</strong><small>Reveal the answer and grade yourself instead of typing.</small></span><select value={settings.study.ankiMode} onChange={(event) => updateStudy("ankiMode", event.target.value as AnkiMode)}><option value="off">Off</option><option value="both">Meanings and readings</option><option value="meaning">Meanings only</option><option value="reading">Readings only</option></select></label>
        <ToggleRow label="Voice answers" description={voiceSupported ? "Dictate into the focused answer field using browser speech recognition." : "Unavailable in this browser; typed answers remain available."} checked={voiceSupported && settings.study.voiceAnswers} disabled={!voiceSupported} onChange={(value) => updateStudy("voiceAnswers", value)} />
        <label className={styles.selectRow}><span><strong>Daily lesson limit</strong><small>Cap lessons started in this browser each day.</small></span><select value={settings.study.dailyLessonLimit} onChange={(event) => updateStudy("dailyLessonLimit", Number(event.target.value))}><option value={0}>No limit</option>{[5, 10, 15, 20, 30].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className={styles.selectRow}><span><strong>Lesson order</strong><small>Choose how available lessons enter a batch.</small></span><select value={settings.study.lessonOrder} onChange={(event) => updateStudy("lessonOrder", event.target.value as WebSettings["study"]["lessonOrder"])}><option value="available">Available first</option><option value="subject-type">Radicals, kanji, vocabulary</option><option value="level">Lowest level first</option></select></label>
        <label className={styles.selectRow}><span><strong>Review order</strong><small>Choose how ready reviews enter the session.</small></span><select value={settings.study.reviewOrder} onChange={(event) => updateStudy("reviewOrder", event.target.value as WebSettings["study"]["reviewOrder"])}><option value="random">Random</option><option value="available">Oldest available first</option><option value="srs">Lowest SRS stage first</option><option value="subject-type">Radicals, kanji, vocabulary</option></select></label>
        <label className={styles.selectRow}><span><strong>Review batch size</strong><small>Maximum review subjects loaded into one session.</small></span><select value={settings.study.reviewBatchSize} onChange={(event) => updateStudy("reviewBatchSize", Number(event.target.value))}>{[10, 25, 50].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className={styles.selectRow}><span><strong>Wrap-up size</strong><small>Subjects kept when you choose Wrap Up.</small></span><select value={settings.study.reviewWrapUpSize} onChange={(event) => updateStudy("reviewWrapUpSize", Number(event.target.value))}>{[5, 10, 15].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className={styles.selectRow}><span><strong>Anime listening sources</strong><small>Comma-separated ImmersionKit slugs used as listening defaults.</small></span><input className={styles.textInput} value={settings.study.immersionKitAnimeSources.join(", ")} onChange={(event) => updateStudy("immersionKitAnimeSources", event.target.value.split(",").map((value) => value.trim()).filter(Boolean).slice(0, 20))} placeholder="death_note, your_name" /></label>
        <label className={styles.selectRow}><span><strong>EPUB daily goal</strong><small>Active reading time counted locally while a book is open.</small></span><select value={settings.study.epubDailyGoalMinutes} onChange={(event) => updateStudy("epubDailyGoalMinutes", Number(event.target.value))}>{[5, 10, 15, 20, 30, 45, 60].map((value) => <option key={value} value={value}>{value} minutes</option>)}</select></label>
        <div className={styles.jitaiRow}><div><strong>Jitai font randomization</strong><small>Randomize the Japanese prompt font per question from your selected pool.</small></div><ToggleRow label="Enable Jitai" description="" checked={settings.study.jitaiEnabled} onChange={(value) => updateStudy("jitaiEnabled", value)} /><div className={styles.fontGrid}>{BUILT_IN_JITAI_FONTS.map((font) => <label key={font.id} style={{ fontFamily: font.family }}><input type="checkbox" checked={settings.study.jitaiSelectedFontIds.includes(font.id)} onChange={() => toggleJitaiFont(font.id)} />{font.name} 日本語</label>)}{settings.study.jitaiCustomFonts.map((font) => <div key={font.id}><label style={{ fontFamily: `KakehashiJitai_${font.id.replace(/[^a-z0-9_]/gi, "_")}` }}><input type="checkbox" checked={settings.study.jitaiSelectedFontIds.includes(font.id)} onChange={() => toggleJitaiFont(font.id)} />{font.name} 日本語</label><button type="button" onClick={() => removeFont(font.id)} aria-label={`Remove ${font.name}`}><Trash2 size={15} aria-hidden /></button></div>)}</div><label className={styles.fontUpload}><FileUp size={16} aria-hidden />Upload font<input type="file" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" onChange={(event) => { void importFont(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>{fontError ? <p className={styles.inlineError} role="alert">{fontError}</p> : null}</div>
      </Card>
    </section>

    <section className={styles.settingsSection} aria-labelledby="reader-integrations-heading">
      <div className={styles.sectionIntro}><KeyRound size={19} /><div><h2 id="reader-integrations-heading">Reader integrations</h2><p>Use the same parse-first vocabulary detection as the native news and text readers.</p></div></div>
      <Card padding="none" className={styles.preferenceCard}>
        <label className={styles.selectRow}><span><strong>JPDB API key</strong><small>Saved only in this browser and sent through Kakehashi when you open an article. Copy your free key from JPDB account settings.</small></span><input className={styles.textInput} type="password" autoComplete="off" spellCheck={false} value={settings.integrations.jpdbApiKey} onChange={(event) => update({ ...settings, integrations: { ...settings.integrations, jpdbApiKey: event.target.value } })} placeholder="Paste JPDB key" /></label>
      </Card>
    </section>

    <section className={styles.settingsSection} aria-labelledby="web-adaptations-heading">
      <div className={styles.sectionIntro}><SlidersHorizontal size={19} /><div><h2 id="web-adaptations-heading">Web adaptations</h2><p>Mobile-only controls are replaced by browser-native behavior where it is meaningful.</p></div></div>
        <Card className={styles.adaptationCard}><p><strong>Camera OCR is intentionally unavailable.</strong> Use the text reader, translator, manga importer, or your operating system’s copy-text tools instead.</p><p>Haptic feedback, automatic mobile keyboard switching, notification badges, and background offline audio downloads are not exposed on the web because browsers do not provide equivalent dependable behavior. Songs use Spotify for catalog discovery and embedded YouTube for playback; direct Spotify and Apple Music account playback remain omitted.</p></Card>
    </section>

    <section className={styles.settingsSection} aria-labelledby="workspace-heading">
      <div className={styles.sectionIntro}><LayoutDashboard size={19} /><div><h2 id="workspace-heading">Workspace layout</h2><p>Keep optional destinations visible and put dashboard sections in the order you use them.</p></div></div>
      <div className={styles.workspaceOptions}>
        <Card padding="none" className={styles.preferenceCard}><div className={styles.subsectionHead}><h3>Navigation</h3><p>Core study destinations always remain available.</p></div>{OPTIONAL_NAV_ITEMS.map((id) => <ToggleRow key={id} label={WORKSPACE_LABELS[id]} description={`Show ${WORKSPACE_LABELS[id].toLocaleLowerCase()} in the desktop navigation.`} checked={settings.workspace.visibleNav.includes(id)} onChange={() => toggleNav(id)} />)}</Card>
        <Card padding="none" className={styles.preferenceCard}><div className={styles.subsectionHead}><h3>Dashboard sections</h3><p>Hide or reorder the sections below.</p></div><ol className={styles.reorderList}>{settings.workspace.dashboardOrder.map((id, index) => <li key={id}><label><input type="checkbox" checked={!settings.workspace.hiddenDashboard.includes(id)} onChange={() => toggleDashboard(id)} /><span>{WORKSPACE_LABELS[id]}</span></label><div><button type="button" disabled={index === 0} onClick={() => moveDashboard(id, -1)} aria-label={`Move ${WORKSPACE_LABELS[id]} up`}><ArrowUp size={16} /></button><button type="button" disabled={index === settings.workspace.dashboardOrder.length - 1} onClick={() => moveDashboard(id, 1)} aria-label={`Move ${WORKSPACE_LABELS[id]} down`}><ArrowDown size={16} /></button></div></li>)}</ol></Card>
      </div>
    </section>
  </main>;
}

function ToggleRow({ label, description, checked, onChange, icon, disabled = false }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void; icon?: React.ReactNode; disabled?: boolean }) {
  return <label className={styles.toggleRow} aria-disabled={disabled}><span>{icon}<span><strong>{label}</strong>{description ? <small>{description}</small> : null}</span></span><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden /></label>;
}
