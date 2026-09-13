import { useIsFocused } from "@react-navigation/native";
import React, { createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useState } from "react";

type TabBarVisibility = {
  hidden: boolean;
  requestHidden: (owner: string, hidden: boolean) => void;
};

const TabBarVisibilityContext = createContext<TabBarVisibility | null>(null);

/** Visibility requests belong to this tab navigator and never persist to storage. */
export function TabBarVisibilityProvider({ children }: React.PropsWithChildren) {
  const [requests, setRequests] = useState<ReadonlySet<string>>(() => new Set());
  const requestHidden = useCallback((owner: string, hidden: boolean) => {
    setRequests((current) => {
      if (current.has(owner) === hidden) return current;
      const next = new Set(current);
      if (hidden) next.add(owner);
      else next.delete(owner);
      return next;
    });
  }, []);
  const value = useMemo(() => ({ hidden: requests.size > 0, requestHidden }), [requests, requestHidden]);
  return <TabBarVisibilityContext.Provider value={value}>{children}</TabBarVisibilityContext.Provider>;
}

export function useTabBarHidden() {
  return useContext(TabBarVisibilityContext)?.hidden ?? false;
}

/** Release the request on blur, list navigation, or unmount; standalone screens are unaffected. */
export function useHideTabBar(hidden: boolean) {
  const visibility = useContext(TabBarVisibilityContext);
  const requestHidden = visibility?.requestHidden;
  const owner = useId();
  const focused = useIsFocused();
  useLayoutEffect(() => {
    if (!requestHidden || !hidden || !focused) return;
    requestHidden(owner, true);
    return () => requestHidden(owner, false);
  }, [focused, hidden, owner, requestHidden]);
}
