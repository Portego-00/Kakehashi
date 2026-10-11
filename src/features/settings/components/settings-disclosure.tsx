import React from "react";
import { useSettingsControllerContext } from "../SettingsControllerContext";
import { AdvancedSettingsContext } from "./AdvancedSettings";
import { SettingsFoldout } from "../../../ui/settings/settings-foldout";
export function SettingsDisclosure(
  props: Omit<React.ComponentProps<typeof SettingsFoldout>, "theme">,
) {
  const { theme } = useSettingsControllerContext();
  return (
    <SettingsFoldout {...props} theme={theme}>
      <AdvancedSettingsContext.Provider value>
        {props.children}
      </AdvancedSettingsContext.Provider>
    </SettingsFoldout>
  );
}
