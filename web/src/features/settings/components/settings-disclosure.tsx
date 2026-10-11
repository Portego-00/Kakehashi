import type { ReactNode } from "react";
import { SettingsIcon } from "./settings-artwork";
import styles from "../settings.module.css";
export function SettingsDisclosure({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <details className={styles.settingsDisclosure}>
      <summary>
        <SettingsIcon name={icon} size={30} />
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <SettingsIcon
          name="chevron"
          size={18}
          className={styles.disclosureChevron}
        />
      </summary>
      <div className={styles.disclosureContent}>{children}</div>
    </details>
  );
}
