import { StyleSheet } from "react-native";

export const DEFAULT_APP_TEXT_SIZE_SCALE = 1;
export const APP_TEXT_SIZE_SCALE_MIN = 1;
export const APP_TEXT_SIZE_SCALE_MAX = 1.5;

export const APP_TEXT_SIZE_OPTIONS = [
  {
    label: "Default",
    description: "Standard app text size.",
    scale: 1,
  },
  {
    label: "Large",
    description: "A comfortable increase for larger screens.",
    scale: 1.15,
  },
  {
    label: "Extra Large",
    description: "Bigger text for extended reading.",
    scale: 1.3,
  },
  {
    label: "Largest",
    description: "Maximum app text size.",
    scale: 1.5,
  },
] as const;

export type AppTextSizeScale = (typeof APP_TEXT_SIZE_OPTIONS)[number]["scale"];

let currentAppTextSizeScale: AppTextSizeScale = DEFAULT_APP_TEXT_SIZE_SCALE;
let didInstallAppTextSizePreprocessors = false;

type StyleSheetWithPreprocessors = typeof StyleSheet & {
  setStyleAttributePreprocessor?: (
    property: string,
    process: (propValue: unknown) => unknown
  ) => void;
};

export function normalizeAppTextSizeScale(value: unknown): AppTextSizeScale {
  const numericValue =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : DEFAULT_APP_TEXT_SIZE_SCALE;

  return APP_TEXT_SIZE_OPTIONS.reduce<AppTextSizeScale>((closest, option) => {
    const closestDistance = Math.abs(closest - numericValue);
    const optionDistance = Math.abs(option.scale - numericValue);

    return optionDistance < closestDistance ? option.scale : closest;
  }, DEFAULT_APP_TEXT_SIZE_SCALE);
}

export function formatAppTextSizeScale(scale: number): string {
  return `${Math.round(normalizeAppTextSizeScale(scale) * 100)}%`;
}

export function applyAppTextSizeScale(scale: unknown): void {
  currentAppTextSizeScale = normalizeAppTextSizeScale(scale);
}

function scaleTextStyleValue(value: unknown): unknown {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return value;
  }

  return Number((value * currentAppTextSizeScale).toFixed(2));
}

export function installAppTextSizePreprocessors(): void {
  if (didInstallAppTextSizePreprocessors) {
    return;
  }

  const setStyleAttributePreprocessor = (
    StyleSheet as StyleSheetWithPreprocessors
  ).setStyleAttributePreprocessor;
  if (typeof setStyleAttributePreprocessor !== "function") {
    return;
  }

  didInstallAppTextSizePreprocessors = true;
  setStyleAttributePreprocessor("fontSize", scaleTextStyleValue);
  setStyleAttributePreprocessor("lineHeight", scaleTextStyleValue);
}
