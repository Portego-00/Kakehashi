import type { SearchBarCommands } from "react-native-screens";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type NativeSearch = {
  hasAppeared: boolean;
  markAppeared: () => void;
};

const NativeSearchContext = createContext<NativeSearch | null>(null);

/** Each native tab navigator owns its first search appearance, including after a JS reload. */
export function NativeSearchProvider({ children }: React.PropsWithChildren) {
  const [hasAppeared, setHasAppeared] = useState(false);
  const markAppeared = useCallback(() => setHasAppeared(true), []);
  const value = useMemo(() => ({ hasAppeared, markAppeared }), [hasAppeared, markAppeared]);
  return <NativeSearchContext.Provider value={value}>{children}</NativeSearchContext.Provider>;
}

export function useNativeSearch() {
  const context = useContext(NativeSearchContext);
  if (!context) throw new Error("Native search requires NativeSearchProvider.");
  return context;
}

export function useNativeSearchBar(enabled: boolean, ref: React.RefObject<SearchBarCommands | null>) {
  const { hasAppeared } = useNativeSearch();
  const canAttach = enabled && hasAppeared;

  useEffect(() => {
    if (!canAttach) return;
    // UIKit cannot animate a toolbar search preview while its tab is attaching
    // to the window. Native onDidAppear provides the boundary; this frame lets
    // Fabric mount the newly enabled search field before sending its command.
    const frame = requestAnimationFrame(() => ref.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [canAttach, ref]);

  return canAttach;
}
