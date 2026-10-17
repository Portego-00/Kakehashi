"use client";
import { useId, type ReactNode } from "react";
import { SettingsRowIcon, type SettingRowId } from "./settings-row-icon";
import { SettingsDescription } from "./SettingsDescription";
import styles from "../settings.module.css";

export function SettingsToggleRow({ label, description, checked, onChange, icon, setting, disabled = false, keywords = "" }: {
  label: string; description: string; checked: boolean; onChange: (value: boolean) => void;
  icon?: ReactNode; setting?: SettingRowId; disabled?: boolean; keywords?: string;
}) {
  const id = useId();
  return <label htmlFor={id} data-settings-search={label} data-search-keywords={keywords} className={styles.toggleRow} aria-disabled={disabled}>
    <span>{icon ?? (setting ? <SettingsRowIcon setting={setting} /> : null)}<span><strong>{label}</strong>{description ? <SettingsDescription label={label}>{description}</SettingsDescription> : null}</span></span>
    <input id={id} aria-label={label} type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden />
  </label>;
}
