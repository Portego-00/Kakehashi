import { NavigationContext } from "@react-navigation/native";
import {
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react";

/**
 * Mirrors the active navigation state while remaining safe in isolated
 * component tests and previews that have no navigation provider.
 */
export function useOptionalScreenIsFocused(): boolean {
  const navigation = useContext(NavigationContext);
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!navigation) return () => {};

      const removeFocusListener = navigation.addListener(
        "focus",
        onStoreChange,
      );
      const removeBlurListener = navigation.addListener(
        "blur",
        onStoreChange,
      );

      return () => {
        removeFocusListener();
        removeBlurListener();
      };
    },
    [navigation],
  );
  const getSnapshot = useCallback(
    () => navigation?.isFocused() ?? true,
    [navigation],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
