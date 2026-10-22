"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { downloadReviewVoiceModel, hasReviewVoiceModel, removeReviewVoiceModel } from "@/features/speech/review-voice-assets";
import { LOCAL_ASR_CHANGED, supportsLocalAsr } from "@/features/speech/asr-model-assets";
import { SettingsDisclosure } from "./settings-disclosure";
import { SettingsToggleRow } from "./SettingsToggleRow";
import asrStyles from "@/features/speech/review-asr.module.css";

const noopSubscribe = () => () => {};
const models = [
  { label: "Japanese and English", size: 241, has: hasReviewVoiceModel, download: downloadReviewVoiceModel, remove: removeReviewVoiceModel, source: "https://huggingface.co/FunAudioLLM/SenseVoiceSmall" },
];
export function ReviewAsrSetting({ enabled, onChange }: { enabled: boolean; onChange: (value: boolean) => void }) {
  const supported = useSyncExternalStore(noopSubscribe, supportsLocalAsr, () => false);
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let active = true;
    const check = () => { void Promise.all(models.map(model => model.has())).then(saved => { if (active) setAvailable(saved.some(Boolean)); }).catch(() => { if (active) setAvailable(false); }); };
    check(); window.addEventListener(LOCAL_ASR_CHANGED, check);
    return () => { active = false; window.removeEventListener(LOCAL_ASR_CHANGED, check); };
  }, []);
  return <div id="review-asr">
    <SettingsDisclosure title="Speech recognition" description="Hands-free Japanese readings and English meanings" icon="mic">
      <SettingsToggleRow setting="voice-input" label="On-device voice answers" keywords="ASR microphone Japanese English speech recognition offline hiragana kana reading meaning" description="Start once during study. Answers submit when you finish speaking or an accepted answer is detected. Pause to type instead." checked={available && enabled} disabled={!supported || !available} onChange={onChange} />
      {models.map(model => <ModelDownload key={model.label} model={model} supported={supported} onEnable={() => onChange(true)} />)}
      <p className={asrStyles.description}><a href="/speech/THIRD-PARTY-NOTICES.txt" target="_blank" rel="noreferrer">Model and runtime licenses</a></p>
      <p className={asrStyles.description}>{!supported ? "Use a browser with microphone access and local model storage over HTTPS." : "Audio stays on this device. One model recognizes both languages; a speech detector ignores silence and background noise. Voice answers pause during feedback and resume with the next question."}</p>
    </SettingsDisclosure>
  </div>;
}
function ModelDownload({ model, supported, onEnable }: { model: typeof models[number]; supported: boolean; onEnable: () => void }) {
  const [saved, setSaved] = useState(false);
  const [checked, setChecked] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const check = () => { void model.has().then(saved => { if (mounted.current) { setSaved(saved); setChecked(true); } }).catch(() => { if (mounted.current) { setChecked(true); setError("Browser storage could not be checked. Try reloading this page."); } }); };
    check(); window.addEventListener(LOCAL_ASR_CHANGED, check);
    return () => { mounted.current = false; controller.current?.abort(); window.removeEventListener(LOCAL_ASR_CHANGED, check); };
  }, [model]);
  async function download() {
    const current = new AbortController(); controller.current = current;
    setProgress(0); setError("");
    try {
      await model.download(percent => { if (mounted.current) setProgress(percent); }, current.signal);
      if (mounted.current && !current.signal.aborted) { setSaved(true); onEnable(); }
    } catch (cause) {
      if (mounted.current && !current.signal.aborted) setError(cause instanceof Error ? cause.message : "The download failed. Free some browser storage and try again.");
    } finally { if (controller.current === current) controller.current = null; if (mounted.current) setProgress(null); }
  }
  async function remove() {
    setError("");
    try { await model.remove(); if (mounted.current) setSaved(false); }
    catch { if (mounted.current) setError("The model could not be removed from browser storage. Try again."); }
  }
  return <div role="group" aria-label={model.label}>
    <p className={asrStyles.description}><strong>{model.label}</strong>{" · "}<a href={model.source} target="_blank" rel="noreferrer">SenseVoiceSmall · local recognition</a></p>
    <div className={asrStyles.actions}>
      {!saved ? <Button type="button" tone="ghost" size="small" disabled={!supported || !checked || progress !== null} onClick={() => void download()}><Download size={16} aria-hidden />Download and enable · {model.size} MB</Button> : <><span>Saved in this browser</span><Button type="button" tone="ghost" size="small" disabled={progress !== null} onClick={() => void remove()}><Trash2 size={16} aria-hidden />Remove model</Button></>}
      {progress !== null ? <><progress className={asrStyles.progress} max={100} value={progress} aria-label={`${model.label} download`} /><span role="status">Downloading… {progress}%</span><Button type="button" tone="ghost" size="small" onClick={() => controller.current?.abort()}>Cancel download</Button></> : null}
    </div>
    {error ? <p className={asrStyles.description} role="alert">{error}</p> : null}
  </div>;
}
