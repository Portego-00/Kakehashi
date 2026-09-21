"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CUSTOM_VOCABULARY_PACKS } from "./catalog";
import { useCustomSrs } from "./use-custom-srs";
import { customSrsSettingsError, DEFAULT_CUSTOM_SRS_SETTINGS, settingsForPolicy, settingsRevision, stepMinutes } from "./srs-settings";
import type { CustomSrsPolicyMetadata, CustomSrsSettings } from "./types";
import sectionStyles from "@/features/settings/settings.module.css";
import styles from "./srs-settings.module.css";

const STAGES = ["Apprentice I", "Apprentice II", "Apprentice III", "Apprentice IV", "Guru I", "Guru II", "Master", "Enlightened"];
function duration(minutes: number) {
  return minutes % 1440 === 0 ? `${minutes / 1440}d` : minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}m`;
}
function draftFrom(settings: CustomSrsSettings) {
  return { mode: settings.mode, stageIntervals: settings.stageIntervals.map(duration), learningSteps: settings.learningSteps.join(", "), relearningSteps: settings.relearningSteps.join(", "), requestRetention: String(Math.round(settings.requestRetention * 100)), maximumInterval: String(settings.maximumInterval), roundToHour: settings.roundToHour };
}
type Draft = ReturnType<typeof draftFrom>;
function parseDraft(draft: Draft): CustomSrsSettings {
  return { ...draft, stageIntervals: draft.stageIntervals.map((value) => stepMinutes(value.trim())), learningSteps: draft.learningSteps.split(/[\s,]+/).filter(Boolean), relearningSteps: draft.relearningSteps.split(/[\s,]+/).filter(Boolean), requestRetention: Number(draft.requestRetention) / 100, maximumInterval: Number(draft.maximumInterval) };
}

export function CustomSrsSettingsForm({ policy, blocked, onSave, onReload, browserOnly = false }: {
  policy: CustomSrsPolicyMetadata;
  blocked: boolean;
  browserOnly?: boolean;
  onSave: (settings: CustomSrsSettings, revision: number, eventId: string) => Promise<unknown>;
  onReload: () => Promise<unknown>;
}) {
  const [editing, setEditing] = useState<{ draft: Draft; revision: number; eventId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const draft = editing?.draft ?? draftFrom(settingsForPolicy(policy));
  const parsed = parseDraft(draft);
  const validation = customSrsSettingsError(parsed);
  const stale = editing !== null && editing.revision !== settingsRevision(policy);
  const change = (patch: Partial<Draft>) => {
    setEditing({ draft: { ...draft, ...patch }, revision: editing?.revision ?? settingsRevision(policy), eventId: crypto.randomUUID() });
    setMessage(""); setError("");
  };
  const reload = async () => {
    setSaving(true); setError("");
    try { await onReload(); setEditing(null); setMessage("Loaded your saved schedule."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not reload your schedule."); }
    finally { setSaving(false); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || validation || blocked || stale || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      await onSave(parsed, editing.revision, editing.eventId);
      setEditing(null);
      setMessage(browserOnly ? "Schedule saved in this demo browser." : "Schedule saved to your account. Existing due dates are unchanged.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your schedule could not be saved. Your edits are still here."); }
    finally { setSaving(false); }
  };
  return <form className={styles.form} onSubmit={save}>
    <p className={styles.scope}>{browserOnly ? "Try scheduling options in this demo. Changes stay in this browser." : "One schedule for your custom vocabulary across all packs and devices. Your WaniKani reviews use WaniKani’s own schedule."}</p>
    {policy.version === 1 ? <p>Your existing vocabulary uses our original adaptive schedule. Choose WaniKani-style below, or keep adaptive timing and adjust it.</p> : null}
    <fieldset disabled={saving} className={styles.fields}>
      <label className={styles.field} htmlFor="custom-srs-mode"><strong>Scheduling mode</strong>
        <select id="custom-srs-mode" value={draft.mode} onChange={(event) => change({ mode: event.target.value as Draft["mode"] })} aria-describedby="custom-srs-mode-help">
          <option value="wanikani">WaniKani-style · fixed stage intervals</option>
          <option value="fsrs">Adaptive · FSRS</option>
        </select>
      </label>
      <p id="custom-srs-mode-help">{draft.mode === "wanikani" ? "Every word waits for the interval of its current stage. A correct review advances one stage; mistakes move it back using WaniKani’s penalties." : "Intervals adapt to each word’s review history. Correct answers use Good; a review with mistakes uses Again. The familiar stages and burning rules still apply."}</p>
      {draft.mode === "wanikani" ? <div>
        <h3>Stage intervals</h3>
        <p id="custom-srs-duration-help">Use m for minutes, h for hours, or d for days. The first interval is the wait after a lesson. Each later interval starts when the word reaches that stage.</p>
        <div className={styles.intervals}>
          {STAGES.map((stage, index) => <label className={styles.interval} key={stage} htmlFor={`custom-srs-stage-${index}`}>
            <span>{stage}<span className={styles.next}>Next: {STAGES[index + 1] ?? "Burned"}</span></span>
            <input id={`custom-srs-stage-${index}`} aria-label={`${stage} interval`} type="text" value={draft.stageIntervals[index]} maxLength={12} aria-describedby="custom-srs-duration-help" spellCheck={false} autoComplete="off" onChange={(event) => change({ stageIntervals: draft.stageIntervals.map((value, i) => i === index ? event.target.value : value) })} />
          </label>)}
        </div>
        <p>The standard preset uses 4h, 8h, 23h, 47h, 167h, 335h, 719h, and 2879h. Longer waits include WaniKani’s one-hour reduction.</p>
        {!validation ? <p className={styles.preview}>With every review correct and on time: about <strong>{Math.round(parsed.stageIntervals.reduce((sum, value) => sum + value, 0) / 1440)} days</strong> from lesson to Burned, before hourly rounding.</p> : null}
      </div> : <div>
        <h3>Adaptive timing</h3>
        <div className={styles.adaptive}>
          <label className={styles.field} htmlFor="custom-srs-learning"><strong>Learning steps</strong><input aria-label="Learning steps" id="custom-srs-learning" value={draft.learningSteps} onChange={(event) => change({ learningSteps: event.target.value })} aria-describedby="custom-srs-learning-help" /><span id="custom-srs-learning-help">For example: 4h, 8h. The first step sets the wait after a lesson. Use 1–8 increasing steps, each from 1m to 1d.</span></label>
          <label className={styles.field} htmlFor="custom-srs-relearning"><strong>Relearning steps</strong><input aria-label="Relearning steps" id="custom-srs-relearning" value={draft.relearningSteps} onChange={(event) => change({ relearningSteps: event.target.value })} aria-describedby="custom-srs-relearning-help" /><span id="custom-srs-relearning-help">Short steps after forgetting a word in long-term review. For example: 4h.</span></label>
          <label className={styles.field} htmlFor="custom-srs-retention"><strong>Target retention (%)</strong><input aria-label="Target retention (%)" id="custom-srs-retention" type="number" min="70" max="99" step="1" value={draft.requestRetention} onChange={(event) => change({ requestRetention: event.target.value })} aria-describedby="custom-srs-retention-help" /><span id="custom-srs-retention-help">70–99%. Higher values aim for stronger recall and usually mean more reviews. Default: 90%.</span></label>
          <label className={styles.field} htmlFor="custom-srs-maximum"><strong>Maximum interval (days)</strong><input aria-label="Maximum interval (days)" id="custom-srs-maximum" type="number" min="1" max="36500" step="1" value={draft.maximumInterval} onChange={(event) => change({ maximumInterval: event.target.value })} aria-describedby="custom-srs-maximum-help" /><span id="custom-srs-maximum-help">Caps long-term FSRS intervals. It does not change short learning steps or revive burned words.</span></label>
        </div>
      </div>}
      <label className={styles.toggle}><input type="checkbox" checked={draft.roundToHour} onChange={(event) => change({ roundToHour: event.target.checked })} /><span><strong>Group reviews at the start of the hour</strong><span>Round due times down, as WaniKani does. Short steps keep their exact time if rounding would make them immediately due.</span></span></label>
      <details className={styles.details}><summary>What happens to my progress?</summary><p>Saving changes how future lessons and reviews are scheduled. Already-scheduled reviews keep their due dates, and your history and stages stay intact.</p><p>Correct answers advance one stage. Every two mistakes (rounded up) drop one stage in Apprentice or two stages from Guru onward, with Apprentice I as the minimum. Reaching stage 9 burns a word and ends its reviews in either mode.</p><p>You can switch modes without resetting words. Adaptive memory estimates continue to be recorded in both modes. Changing learning steps while a word is learning uses the new step list at its next review.</p></details>
    </fieldset>
    {editing && validation ? <p role="alert" className={styles.error}>{validation}</p> : null}
    {stale ? <p role="alert" className={styles.error}>Your saved schedule changed on another device. Reload it before making further changes.</p> : null}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    {blocked ? <p>Wait for your progress to finish loading or syncing before saving scheduling changes.</p> : null}
    <div className={styles.actions}>
      <Button type="submit" tone="primary" state={saving ? "loading" : "idle"} disabled={!editing || Boolean(validation) || stale || blocked}>Save schedule</Button>
      <Button type="button" disabled={saving} onClick={() => change(draftFrom(DEFAULT_CUSTOM_SRS_SETTINGS))}>Use WaniKani defaults</Button>
      {editing || error ? <Button type="button" disabled={saving} onClick={() => void reload()}>Reload saved settings</Button> : null}
    </div>
    {editing ? <p className={styles.pending}>Changes are not saved until you choose Save schedule.</p> : null}
    <p role="status" aria-live="polite">{message}</p>
  </form>;
}

export function CustomSrsSettingsSection({ accountId }: { accountId: string }) {
  const srs = useCustomSrs(accountId, CUSTOM_VOCABULARY_PACKS);
  useEffect(() => {
    if (!srs.isLoading && window.location.hash === "#custom-srs-settings") document.getElementById("custom-srs-settings")?.scrollIntoView({ block: "start" });
  }, [srs.isLoading]);
  return <section id="custom-srs-settings" data-settings-search="" data-search-keywords="custom vocabulary srs timing schedule intervals retention fsrs wanikani learning relearning" className={`${sectionStyles.settingsSection} ${styles.section}`} aria-labelledby="custom-srs-heading">
    <div className={sectionStyles.sectionIntro}><Clock3 size={19} aria-hidden /><div><h2 id="custom-srs-heading">Custom vocabulary schedule</h2><p>Choose when your own vocabulary comes back for review.</p></div></div>
    {srs.isLoading ? <p role="status">Loading your saved schedule…</p> : srs.isUnavailable ? <div><p role="alert">{srs.error}</p><Button onClick={() => void srs.refresh()}>Retry loading schedule</Button></div> : <div>
      {srs.error ? <p role="alert" className={styles.error}>{srs.error} <button type="button" onClick={() => { void srs.retrySync(); void srs.refresh(); }}>Retry sync</button></p> : null}
      <CustomSrsSettingsForm key={accountId} policy={srs.state.policy} blocked={srs.pendingCount > 0 || Boolean(srs.error)} browserOnly={srs.storageMode === "browser"} onSave={srs.saveSettings} onReload={async () => { const result = await srs.refresh(); if (result.error) throw result.error; }} />
    </div>}
  </section>;
}
