import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
export const useLearningContentStore = create<{
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}>()(
  persist(
    (set) => ({ enabled: false, setEnabled: (enabled) => set({ enabled }) }),
    {
      name: "kakehashi-translation-settings-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ enabled }) => ({ enabled }),
      merge: (saved, current) => ({
        ...current,
        enabled: (saved as { enabled?: boolean } | null)?.enabled === true,
      }),
    },
  ),
);
