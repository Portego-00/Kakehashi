"use client";

import { useId } from "react";
import { SettingsDescription } from "./SettingsDescription";
import { SettingsRowIcon } from "./settings-row-icon";
import styles from "./ReviewPromptColorSetting.module.css";

export function ReviewPromptColorSetting({ provider, value, onChange }: {
  provider: "wanikani" | "bunpro";
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const bunpro = provider === "bunpro";
  const label = `${bunpro ? "Bunpro" : "WaniKani"} prompt text color`;
  return <div className={styles.row} data-settings-search={label} data-search-keywords="review font colour characters kanji vocabulary extra study appearance">
    <label className={styles.label} htmlFor={id}>
      <SettingsRowIcon setting="character-size" />
      <span><strong>{label}</strong><SettingsDescription label={label}>{bunpro ? "Color of the Japanese review sentence." : "Color of the reviewed item in WaniKani reviews and extra study."}</SettingsDescription></span>
    </label>
    <div className={styles.controls}>
      <select id={id} aria-label={`${label} mode`} value={value ? "custom" : "default"} onChange={(event) => onChange(event.target.value === "custom" ? bunpro ? "#202124" : "#ffffff" : "")}>
        <option value="default">Default</option>
        <option value="custom">Custom</option>
      </select>
      {value ? <input type="color" aria-label={label} title={value.toUpperCase()} value={value} onChange={(event) => onChange(event.target.value)} /> : null}
    </div>
  </div>;
}
