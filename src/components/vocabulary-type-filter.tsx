import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";

import { useTheme } from "../utils/theme";
import {
  formatVocabularyType,
  getVocabularyTypeOptions,
  normalizeVocabularyTypes,
} from "../utils/vocabularyTypeFilter";

interface VocabularyTypeFilterProps {
  subjects?: readonly {
    object: string;
    data: { parts_of_speech?: readonly string[] | null };
  }[];
  selected: readonly string[];
  onChange: (values: string[]) => void;
  onSearchFocus?: () => void;
  initiallyExpanded?: boolean;
}

const EMPTY_SUBJECTS: NonNullable<VocabularyTypeFilterProps["subjects"]> = [];

export function VocabularyTypeFilter({
  subjects = EMPTY_SUBJECTS,
  selected,
  onChange,
  onSearchFocus,
  initiallyExpanded = false,
}: VocabularyTypeFilterProps) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [query, setQuery] = useState("");
  const normalizedSelected = useMemo(
    () => normalizeVocabularyTypes(selected),
    [selected],
  );
  const options = useMemo(
    () => getVocabularyTypeOptions(subjects, normalizedSelected),
    [subjects, normalizedSelected],
  );
  const queryLower = query.trim().toLowerCase();
  const visibleOptions = options.filter((option) =>
    option.label.toLowerCase().includes(queryLower),
  );
  const summary =
    normalizedSelected.length === 0
      ? "All"
      : normalizedSelected.length === 1
        ? formatVocabularyType(normalizedSelected[0])
        : `${normalizedSelected.length} selected`;

  return (
    <View>
      <TouchableOpacity
        onPress={() => setExpanded((value) => !value)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Vocab type: ${summary}`}
        accessibilityHint="Choose parts of speech for vocabulary results"
        accessibilityState={{ expanded }}
        style={{
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Text style={{ color: theme.textColor, fontSize: 15, fontWeight: "600" }}>
          Vocab type
        </Text>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            color: normalizedSelected.length ? theme.primary : theme.textSecondary,
            fontSize: 14,
            textAlign: "right",
          }}
        >
          {summary}
        </Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={theme.textSecondary}
        />
      </TouchableOpacity>

      {expanded ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 8 }}>
            Match any selected type. Only vocabulary is included.
          </Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={onSearchFocus}
            placeholder="Find a vocab type…"
            placeholderTextColor={theme.textLight}
            accessibilityLabel="Find a vocabulary type"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={{
              minHeight: 44,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 8,
              backgroundColor: theme.cardBackground,
              color: theme.textColor,
              paddingHorizontal: 12,
              fontSize: 14,
            }}
          />
          {normalizedSelected.length > 0 ? (
            <TouchableOpacity
              onPress={() => onChange([])}
              accessibilityRole="button"
              accessibilityLabel="Clear vocabulary types"
              style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-end" }}
            >
              <Text style={{ color: theme.primary, fontSize: 14 }}>Clear</Text>
            </TouchableOpacity>
          ) : null}
          {visibleOptions.map((option) => {
            const checked = normalizedSelected.includes(option.value);
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() =>
                  onChange(
                    checked
                      ? normalizedSelected.filter((value) => value !== option.value)
                      : [...normalizedSelected, option.value],
                  )
                }
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityLabel={`${option.label} vocabulary type`}
                accessibilityState={{ checked }}
                style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <Ionicons
                  name={checked ? "checkbox" : "square-outline"}
                  size={22}
                  color={checked ? theme.primary : theme.textSecondary}
                />
                <Text style={{ flex: 1, color: theme.textColor, fontSize: 14 }}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
          {visibleOptions.length === 0 ? (
            <Text selectable style={{ color: theme.textSecondary, paddingVertical: 12 }}>
              No matching vocabulary types
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
