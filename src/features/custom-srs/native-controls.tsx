import React from "react";
import { ActivityIndicator, Pressable, Text, TextInput, type TextInputProps, View } from "react-native";
import { useTheme } from "../../utils/theme";

export function VocabularyButton({ label, onPress, disabled = false, busy = false, primary = false }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; primary?: boolean }) {
  const { theme } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderCurve: "continuous", backgroundColor: primary ? theme.primary : theme.cardBackground, opacity: disabled || busy ? 0.5 : pressed ? 0.65 : 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 })}>
    {busy ? <ActivityIndicator color={primary ? "white" : theme.primary} /> : null}<Text style={{ color: primary ? "white" : theme.primary, fontSize: 16, fontWeight: "600" }}>{label}</Text>
  </Pressable>;
}

export function VocabularyField({ label, help, ...props }: TextInputProps & { label: string; help?: string }) {
  const { theme } = useTheme();
  return <View style={{ gap: 6 }}><Text style={{ color: theme.textColor, fontSize: 15, fontWeight: "600" }}>{label}</Text>
    <TextInput accessibilityLabel={label} autoCapitalize="none" autoCorrect={false} placeholderTextColor={theme.textSecondary} {...props} style={[{ minHeight: props.multiline ? 88 : 44, padding: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 10, borderCurve: "continuous", color: theme.textColor, backgroundColor: theme.cardBackground, fontSize: 16, textAlignVertical: props.multiline ? "top" : "center" }, props.style]} />
    {help ? <Text selectable style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19 }}>{help}</Text> : null}
  </View>;
}

export function VocabularyMessage({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  const { theme } = useTheme();
  return <Text selectable accessibilityRole={error ? "alert" : undefined} accessibilityLiveRegion="polite" style={{ color: error ? theme.error : theme.textSecondary, fontSize: 14, lineHeight: 21 }}>{children}</Text>;
}
