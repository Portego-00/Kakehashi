import React, { useState } from "react";
import { Text, TouchableOpacity } from "react-native";
import { useTheme } from "../../utils/theme";
import { useLearningDisplay } from "./display";
import type { MnemonicField } from "./resolver";

interface Props {
  subject: unknown;
  field: MnemonicField;
  original: string;
  render: (text: string) => React.ReactNode;
}

function ToggleText({ original, translation, render }: Pick<Props, "original" | "render"> & { translation: string }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const { theme } = useTheme();
  return <>
    {render(showOriginal ? original : translation)}
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: showOriginal }}
      onPress={() => setShowOriginal(value => !value)} style={{ paddingVertical: 8 }}>
      <Text style={{ color: theme.primary }}>{showOriginal ? "Show translation" : "Show original English"}</Text>
    </TouchableOpacity>
  </>;
}

// Call the existing renderer so mnemonic tags, colors and layout stay unchanged.
// Fallback renders exactly the original node without an extra wrapper or control.
export function TranslatedStudyText({ subject, field, original, render }: Props) {
  const display = useLearningDisplay();
  const translated = display.mnemonic(subject, field, original);
  if (!translated) return <>{render(original)}</>;
  return <ToggleText key={JSON.stringify([original, translated.translation])}
    original={original} translation={translated.translation} render={render} />;
}
