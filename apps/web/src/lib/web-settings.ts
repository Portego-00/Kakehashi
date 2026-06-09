"use client";

import { useEffect, useState } from "react";

const WEB_SETTINGS_STORAGE_KEY = "kakehashi_web_settings_v1";

export type WebSettings = {
  reviewBatchSize: number;
  reviewsDisplaySrsIndicator: boolean;
  reviewsPresentationOrder: "shuffled" | "lower_levels_first" | "higher_levels_first";
  lessonsBatchSize: number;
  lessonsPresentationOrder: "ascending_level_then_subject" | "shuffled";
  newsDefaultView: "reader" | "article";
  newsShowFurigana: boolean;
  songPlaybackProvider: "youtube";
  lyricsPreferSynced: boolean;
  crosswordSize: "small" | "medium" | "large";
  crosswordMaxWords: number;
  crosswordHiraganaOnly: boolean;
  theme: "dark" | "system";
  browserNotifications: boolean;
};

export const defaultWebSettings: WebSettings = {
  reviewBatchSize: 10,
  reviewsDisplaySrsIndicator: true,
  reviewsPresentationOrder: "shuffled",
  lessonsBatchSize: 5,
  lessonsPresentationOrder: "ascending_level_then_subject",
  newsDefaultView: "reader",
  newsShowFurigana: true,
  songPlaybackProvider: "youtube",
  lyricsPreferSynced: true,
  crosswordSize: "medium",
  crosswordMaxWords: 10,
  crosswordHiraganaOnly: false,
  theme: "dark",
  browserNotifications: false,
};

export function useWebSettings() {
  const [settings, setSettingsState] = useState<WebSettings>(defaultWebSettings);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setSettingsState(loadWebSettings());
    setIsHydrated(true);
  }, []);

  function setSetting<K extends keyof WebSettings>(key: K, value: WebSettings[K]) {
    setSettingsState((current) => {
      const next = { ...current, [key]: value };
      saveWebSettings(next);
      return next;
    });
  }

  function resetSettings() {
    saveWebSettings(defaultWebSettings);
    setSettingsState(defaultWebSettings);
  }

  return {
    isHydrated,
    resetSettings,
    settings,
    setSetting,
  };
}

export function loadWebSettings(): WebSettings {
  if (typeof window === "undefined") return defaultWebSettings;

  const rawValue = window.localStorage.getItem(WEB_SETTINGS_STORAGE_KEY);
  if (!rawValue) return defaultWebSettings;

  try {
    return sanitizeWebSettings(JSON.parse(rawValue));
  } catch {
    return defaultWebSettings;
  }
}

export function saveWebSettings(settings: WebSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WEB_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function sanitizeWebSettings(value: unknown): WebSettings {
  if (!value || typeof value !== "object") return defaultWebSettings;
  const input = value as Partial<WebSettings>;

  return {
    reviewBatchSize: clampNumber(input.reviewBatchSize, 1, 100, defaultWebSettings.reviewBatchSize),
    reviewsDisplaySrsIndicator: pickBoolean(
      input.reviewsDisplaySrsIndicator,
      defaultWebSettings.reviewsDisplaySrsIndicator
    ),
    reviewsPresentationOrder:
      input.reviewsPresentationOrder === "lower_levels_first" ||
      input.reviewsPresentationOrder === "higher_levels_first"
        ? input.reviewsPresentationOrder
        : defaultWebSettings.reviewsPresentationOrder,
    lessonsBatchSize: clampNumber(input.lessonsBatchSize, 1, 100, defaultWebSettings.lessonsBatchSize),
    lessonsPresentationOrder:
      input.lessonsPresentationOrder === "shuffled"
        ? input.lessonsPresentationOrder
        : defaultWebSettings.lessonsPresentationOrder,
    newsDefaultView: input.newsDefaultView === "article" ? "article" : "reader",
    newsShowFurigana: pickBoolean(input.newsShowFurigana, defaultWebSettings.newsShowFurigana),
    songPlaybackProvider: "youtube",
    lyricsPreferSynced: pickBoolean(input.lyricsPreferSynced, defaultWebSettings.lyricsPreferSynced),
    crosswordSize:
      input.crosswordSize === "small" || input.crosswordSize === "large"
        ? input.crosswordSize
        : "medium",
    crosswordMaxWords: clampNumber(input.crosswordMaxWords, 4, 24, defaultWebSettings.crosswordMaxWords),
    crosswordHiraganaOnly: pickBoolean(
      input.crosswordHiraganaOnly,
      defaultWebSettings.crosswordHiraganaOnly
    ),
    theme: input.theme === "system" ? "system" : "dark",
    browserNotifications: pickBoolean(
      input.browserNotifications,
      defaultWebSettings.browserNotifications
    ),
  };
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}
