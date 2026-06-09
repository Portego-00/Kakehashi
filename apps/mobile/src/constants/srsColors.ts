// SRS Stage colors for light and dark modes
export const SRS_COLORS = {
  apprentice: {
    light: "#dd0093", // Vibrant Pink
    dark: "#ff33aa", // Lighter Neon Pink for Dark Mode
    hex: "#dd0093",
  },
  guru: {
    light: "#882d9e", // Rich Purple
    dark: "#c744e8", // Bright Purple
    hex: "#882d9e",
  },
  master: {
    light: "#294dd1", // Strong Blue
    dark: "#4c73ff", // Bright Blue
    hex: "#294dd1",
  },
  enlightened: {
    light: "#0093dd", // Cerulean
    dark: "#2ebeff", // Sky Blue
    hex: "#0093dd",
  },
  burned: {
    light: "#434343", // Dark Slate
    dark: "#ffffff", // White/Light Grey for Dark Mode (high contrast against dark bg)
    hex: "#434343",
  },
} as const;

// Helper function to get SRS color based on stage number
export function getSRSColorByStage(
  stage: number,
  isDark: boolean = false
): string {
  if (stage >= 9)
    return isDark ? SRS_COLORS.burned.dark : SRS_COLORS.burned.light;
  if (stage >= 8)
    return isDark ? SRS_COLORS.enlightened.dark : SRS_COLORS.enlightened.light;
  if (stage >= 7)
    return isDark ? SRS_COLORS.master.dark : SRS_COLORS.master.light;
  if (stage >= 5) return isDark ? SRS_COLORS.guru.dark : SRS_COLORS.guru.light;
  return isDark ? SRS_COLORS.apprentice.dark : SRS_COLORS.apprentice.light;
}

// Helper function to get SRS color by name
export function getSRSColorByName(
  name: string,
  isDark: boolean = false
): string {
  const lowerName = name.toLowerCase();
  switch (lowerName) {
    case "apprentice":
      return isDark ? SRS_COLORS.apprentice.dark : SRS_COLORS.apprentice.light;
    case "guru":
      return isDark ? SRS_COLORS.guru.dark : SRS_COLORS.guru.light;
    case "master":
      return isDark ? SRS_COLORS.master.dark : SRS_COLORS.master.light;
    case "enlightened":
      return isDark
        ? SRS_COLORS.enlightened.dark
        : SRS_COLORS.enlightened.light;
    case "burned":
      return isDark ? SRS_COLORS.burned.dark : SRS_COLORS.burned.light;
    default:
      return isDark ? SRS_COLORS.apprentice.dark : SRS_COLORS.apprentice.light;
  }
}
