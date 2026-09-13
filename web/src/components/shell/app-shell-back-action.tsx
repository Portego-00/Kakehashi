"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";

export type AppShellBackAction = {
  label: string;
  onBack: () => void;
};

export type RegisterAppShellBackAction = (action: AppShellBackAction) => () => void;

const AppShellBackActionContext = createContext<RegisterAppShellBackAction>(() => () => undefined);

export function AppShellBackActionProvider({ children, register }: { children: ReactNode; register: RegisterAppShellBackAction }) {
  return <AppShellBackActionContext.Provider value={register}>{children}</AppShellBackActionContext.Provider>;
}

export function useAppShellBackAction(action: AppShellBackAction | null) {
  const register = useContext(AppShellBackActionContext);

  useEffect(() => {
    if (!action) return;
    return register(action);
  }, [action, register]);
}
