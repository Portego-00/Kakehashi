import React, { createContext, useContext } from "react";

import type { SettingsController } from "./useSettingsController";

const SettingsControllerContext = createContext<SettingsController | null>(
  null,
);

export function SettingsControllerProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: SettingsController;
}) {
  return (
    <SettingsControllerContext.Provider value={value}>
      {children}
    </SettingsControllerContext.Provider>
  );
}

export function useSettingsControllerContext() {
  const controller = useContext(SettingsControllerContext);
  if (!controller) {
    throw new Error(
      "useSettingsControllerContext must be used inside SettingsControllerProvider",
    );
  }
  return controller;
}
