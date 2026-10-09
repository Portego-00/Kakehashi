import { useEffect, useState } from "react";

import { getStoredBunproApiToken } from "../utils/bunproApi";
import { useOptionalScreenIsFocused } from "../utils/navigation-focus";

export function useBunproApiKeyAdded(enabled = true): boolean {
  const focused = useOptionalScreenIsFocused();
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    if (!enabled || !focused) {
      setHasApiKey(false);
      return;
    }

    let active = true;
    void getStoredBunproApiToken().then((token) => {
      if (active) setHasApiKey(Boolean(token));
    });

    return () => {
      active = false;
    };
  }, [enabled, focused]);

  return enabled && focused && hasApiKey;
}
