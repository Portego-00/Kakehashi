import React from "react";
import { SettingsIcon } from "./settings-icon";
import { settingRowIcons, type SettingRowId } from "./row-icons";

export function SettingsRowIcon({
  setting,
  color,
}: {
  setting: SettingRowId;
  color: string;
}) {
  return (
    <SettingsIcon
      name={settingRowIcons[setting]}
      size={20}
      color={color}
      style={{ marginRight: 12 }}
    />
  );
}
