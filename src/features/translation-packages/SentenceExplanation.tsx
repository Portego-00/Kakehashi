import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../utils/theme";

export function SentenceExplanation({english, usage}: {english: string; usage: string}) {
  const { theme } = useTheme();
  const [showEnglish, setShowEnglish] = useState(false);
  return <View style={{marginTop: 6}}>
    <Text selectable style={{color: theme.textSecondary}}>{usage}</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityState={{expanded: showEnglish}}
      onPress={() => setShowEnglish(value => !value)} style={{paddingVertical: 8}}>
      <Text style={{color: theme.primary}}>{showEnglish ? "Hide original English" : "Show original English"}</Text>
    </TouchableOpacity>
    {showEnglish && <Text selectable style={{color: theme.textSecondary}}>{english}</Text>}
  </View>;
}
