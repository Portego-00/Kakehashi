import type { ReactNode } from "react";
import {
  type StyleProp,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";

type NoteFieldContainerProps = {
  activeOpacity?: number;
  addAccessibilityLabel: string;
  children: ReactNode;
  hasContent: boolean;
  onAdd?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function NoteFieldContainer({
  activeOpacity,
  addAccessibilityLabel,
  children,
  hasContent,
  onAdd,
  style,
}: NoteFieldContainerProps) {
  if (hasContent) {
    return <View style={style}>{children}</View>;
  }

  return (
    <TouchableOpacity
      accessible
      accessibilityLabel={addAccessibilityLabel}
      accessibilityRole="button"
      activeOpacity={activeOpacity}
      onPress={onAdd}
      style={style}
    >
      {children}
    </TouchableOpacity>
  );
}
