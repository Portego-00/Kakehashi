import { useEffect, useMemo, useState } from "react";
import * as Font from "expo-font";
import { getCachedDownloadedJitaiFonts, getJitaiFontFamiliesForSelection, loadDownloadedJitaiFonts } from "../utils/jitaiFonts";
import { useSettingsStore } from "../utils/store";

export function useBunproJitaiFont(questionKey: string) {
  const enabled = useSettingsStore(state => state.jitaiEnabled);
  const selection = useSettingsStore(state => state.jitaiSelectedFontIds) ?? [];
  const [downloaded, setDownloaded] = useState(() => getCachedDownloadedJitaiFonts() ?? []);
  useEffect(() => { if (!enabled) return; let cancelled = false; void loadDownloadedJitaiFonts().then(fonts => { if (!cancelled) setDownloaded(fonts); }).catch(() => undefined); return () => { cancelled = true; }; }, [enabled]);
  const fontsKey = getJitaiFontFamiliesForSelection(selection, downloaded).filter(family => Font.isLoaded(family)).join("|");
  return useMemo(() => {
    if (!enabled) return undefined;
    const fonts = fontsKey.split("|").filter(Boolean);
    const hash = [...questionKey].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
    return fonts[hash % Math.max(1, fonts.length)];
  }, [enabled, questionKey, fontsKey]);
}
