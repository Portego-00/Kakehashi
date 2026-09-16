import { StyleSheet } from 'react-native';
import { useTheme, type lightTheme } from '../../utils/theme';

type AppTheme = typeof lightTheme;

/** Blend opaque app colors so accents remain legible on each theme's surface. */
function mix(base: string, accent: string, amount: number): string {
  const channels = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  const a = channels(base); const b = channels(accent);
  return `#${a.map((channel, index) => Math.round(channel + (b[index] - channel) * amount).toString(16).padStart(2, '0')).join('')}`;
}
function luminance(color: string): number {
  const values = [1, 3, 5].map(index => {
    const value = parseInt(color.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
const contrast = (a: string, b: string) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);

/** Mural's existing layout tokens now follow Kakehashi's selected app palette. */
export function createConversationTheme(theme: AppTheme) {
  const tint = (accent: string, light = 0.10, dark = 0.17) => mix(theme.cardBackground, accent, theme.isDark ? dark : light);
  const errorSurface = tint(theme.error);
  let danger = theme.error;
  // Small error labels must remain readable on both the canvas and tinted cards.
  for (let amount = 0.05; amount <= 1 && [errorSurface, theme.backgroundColor, theme.cardBackground].some(surface => contrast(danger, surface) < 4.5); amount += 0.05) {
    danger = mix(theme.error, theme.textColor, amount);
  }
  const colors = {
    cream: theme.backgroundColor,
    paper: theme.cardBackground,
    ink: theme.textColor,
    secondary: theme.textSecondary,
    muted: theme.textSecondary,
    orange: theme.primary,
    onPrimary: contrast('#ffffff', theme.primary) > contrast('#111111', theme.primary) ? '#ffffff' : '#111111',
    border: theme.border,
    danger,
    errorSurface,
    peach: tint(theme.secondary),
    lilac: tint(theme.primary),
    sage: tint(mix(theme.primary, theme.accent, 0.5)),
    butter: tint(theme.accent),
    selection: tint(theme.primary, 0.15, 0.24),
  };
  const panels = [colors.peach, colors.lilac, colors.sage, colors.butter];
  const orb = {
    baseLight: mix(theme.cardBackground, theme.primary, theme.isDark ? 0.82 : 0.24),
    baseMid: theme.primary,
    baseDeep: mix(theme.primary, theme.backgroundColor, theme.isDark ? 0.32 : 0.12),
    secondary: theme.secondary,
    secondarySoft: mix(theme.primary, theme.secondary, 0.55),
    accent: theme.accent,
    highlight: mix(theme.cardBackground, theme.primary, theme.isDark ? 0.64 : 0.10),
    satelliteLight: mix(theme.cardBackground, theme.primary, theme.isDark ? 0.85 : 0.05),
    satelliteMid: mix(theme.cardBackground, theme.secondary, theme.isDark ? 0.65 : 0.20),
    satelliteDeep: theme.secondary,
    shadow: theme.primary,
    ring: theme.primary,
  };
  const styles = StyleSheet.create({
    text: { fontFamily: 'ConversationNunito', fontSize: 16, color: colors.ink },
    secondary: { color: colors.secondary, fontSize: 14, lineHeight: 22 },
    heading: { fontSize: 30, fontWeight: '700', letterSpacing: -0.8 },
    subheading: { fontSize: 19, fontWeight: '700' },
    input: { fontFamily: 'ConversationNunito', fontSize: 16, color: colors.ink, backgroundColor: colors.paper, borderColor: colors.border, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, minHeight: 48 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    section: { gap: 12 },
    action: { minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper, paddingVertical: 13, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
    actionLabel: { fontWeight: '600', fontSize: 15 },
    sheetHeader: { paddingHorizontal: 22, paddingVertical: 12, gap: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    sheetTitle: { fontSize: 22, fontWeight: '700', flex: 1 },
    close: { width: 42, height: 42, borderRadius: 22, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  });
  return { colors, panels, orb, styles, isDark: theme.isDark };
}

type ConversationTheme = ReturnType<typeof createConversationTheme>;
const cache = new WeakMap<AppTheme, ConversationTheme>();
export function useConversationTheme(): ConversationTheme {
  const { theme } = useTheme();
  let result = cache.get(theme);
  if (!result) { result = createConversationTheme(theme); cache.set(theme, result); }
  return result;
}
