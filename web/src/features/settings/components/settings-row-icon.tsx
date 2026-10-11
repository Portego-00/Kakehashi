import {
  settingRowIcons,
  type SettingRowId,
} from "../../../../../src/ui/settings/row-icons";
import { SettingsIcon } from "./settings-artwork";
import styles from "../settings.module.css";

export type { SettingRowId };

export function SettingsRowIcon({ setting }: { setting: SettingRowId }) {
  return (
    <SettingsIcon
      name={settingRowIcons[setting]}
      size={20}
      className={styles.rowIcon}
    />
  );
}
