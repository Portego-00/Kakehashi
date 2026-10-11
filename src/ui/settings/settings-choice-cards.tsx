import React, { useCallback, useRef, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import {
  type SettingsIllustrationName,
} from "./artwork";
import { SettingsIcon } from "./settings-icon";
import { isReviewModeSketch } from "./review-mode-sketch";
import { SettingsScreenPreview } from "./screen-preview";
import { ReviewModeSketch } from "./review-mode-preview";
import { useSettingsSearchEntry } from "./settings-search";

type Choice<T extends string> = {
  value: T;
  label: string;
  description?: string;
  art: SettingsIllustrationName;
  disabled?: boolean;
  hint?: string;
};
export function SettingsChoiceCards<T extends string>({
  label,
  value,
  options,
  onChange,
  theme,
  compact = false,
}: {
  label: string;
  value: T;
  options: readonly Choice<T>[];
  onChange: (value: T) => void;
  theme: {
    primary: string;
    textColor: string;
    textSecondary: string;
    cardBackground: string;
    border: string;
  };
  compact?: boolean;
}) {
  const { width, fontScale } = useWindowDimensions();
  const [contentWidth, setContentWidth] = useState(Math.max(0, width - 48));
  const ref = useRef<View>(null);
  const measure = useCallback(
    (callback: (y: number) => void) =>
      ref.current?.measureInWindow((_x, y) => callback(y)),
    [],
  );
  useSettingsSearchEntry(
    label,
    options
      .map((option) => option.label + " " + (option.description ?? ""))
      .join(" "),
    measure,
  );
  const columns =
    fontScale > 1.3
      ? 1
      : options.length === 3
        ? 3
        : options.length > 3
          ? 2
          : options.length;
  const gap = 8;
  const cardWidth = Math.max(0, (contentWidth - (columns - 1) * gap) / columns);
  const artWidth = Math.min(compact ? 82 : 100, Math.max(40, cardWidth - 18));
  const phone = width < 600;
  return (
    <View
      ref={ref}
      accessible={false}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ padding: 12, gap: 9 }}
    >
      <Text style={{ fontSize: 13, fontWeight: "600", color: theme.textColor }}>
        {label}
      </Text>
      <View
        style={{ flexDirection: "row", flexWrap: "wrap", gap }}
        onLayout={(event) => {
          const measured = event.nativeEvent.layout.width;
          if (Math.abs(contentWidth - measured) > 0.5)
            setContentWidth(measured);
        }}
      >
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityHint={option.hint ?? option.description}
              accessibilityState={{
                checked: selected,
                disabled: option.disabled,
              }}
              disabled={option.disabled}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => ({
                width: cardWidth,
                minHeight:
                  112,
                padding: 8,
                paddingTop: 12,
                flexDirection: "column",
                alignItems: "flex-start",
                borderRadius: 10,
                borderWidth: 1.5,
                borderColor: selected ? theme.primary : theme.border,
                backgroundColor: selected
                  ? `${theme.primary}12`
                  : theme.cardBackground,
                opacity: option.disabled ? 0.5 : pressed ? 0.75 : 1,
                gap: 7,
              })}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                {isReviewModeSketch(option.art) ? (
                  <ReviewModeSketch
                    name={option.art}
                    width={artWidth}
                    theme={theme}
                  />
                ) : (
                  <SettingsScreenPreview name={option.art} width={artWidth} theme={theme} />
                )}
              </View>
              <View style={{ alignSelf: "stretch", minWidth: 0, gap: 4 }}>
                <Text
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  style={{
                    fontSize: 12,
                    minHeight: 30,
                    lineHeight: 15,
                    fontWeight: "600",
                    color: theme.textColor,
                  }}
                >
                  {option.label}
                </Text>
                {option.description &&
                (!phone || !isReviewModeSketch(option.art)) ? (
                  <Text
                    style={{
                      fontSize: 11,
                      lineHeight: 15,
                      color: theme.textSecondary,
                    }}
                  >
                    {option.description}
                  </Text>
                ) : null}
              </View>
              {option.disabled && option.hint ? (
                <Text
                  style={{
                    fontSize: 10,
                    lineHeight: 14,
                    color: theme.textSecondary,
                  }}
                >
                  {option.hint}
                </Text>
              ) : null}
              <View style={{ position: "absolute", top: 5, right: 5 }}>
                {selected ? (
                  <SettingsIcon name="check" size={12} color={theme.primary} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
