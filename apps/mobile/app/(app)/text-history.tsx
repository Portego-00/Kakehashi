import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../src/utils/theme";
import {
  getTextHistory,
  clearTextHistory,
  removeTextHistoryItem,
  formatHistoryTimestamp,
  type TextHistoryItem,
} from "../../src/utils/searchHistory";
import { useSubjectColors } from "../../src/utils/subjectColors";

export default function TextHistoryScreen() {
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const router = useRouter();
  const [history, setHistory] = useState<TextHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      const textHistory = await getTextHistory();
      setHistory(textHistory);
    } catch (error) {
      console.error("Error loading text history:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSelectHistory = useCallback(
    (item: TextHistoryItem) => {
      router.push({
        pathname: "/translator",
        params: {
          historyItem: JSON.stringify(item),
        },
      });
    },
    [router]
  );

  const handleDeleteHistoryItem = useCallback(async (id: string) => {
    try {
      await removeTextHistoryItem(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Error removing text history item:", error);
    }
  }, []);

  const handleClearHistory = useCallback(async () => {
    try {
      await clearTextHistory();
      setHistory([]);
    } catch (error) {
      console.error("Error clearing text history:", error);
    }
  }, []);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleNewSearch = useCallback(() => {
    router.push("/translator");
  }, [router]);

  if (isLoading) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.textColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textColor }]}>
            Text History
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading history...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>
          Text History
        </Text>
        <View style={styles.headerButtons}>
          {history.length > 0 && (
            <TouchableOpacity
              onPress={handleClearHistory}
              style={styles.clearButton}
            >
              <Text style={[styles.clearButtonText, { color: theme.error }]}>
                Clear All
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {history.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="document-text-outline"
            size={64}
            color={theme.textSecondary}
          />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No text history yet
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
            Your text searches will appear here
          </Text>
          <TouchableOpacity
            style={[styles.newSearchButton, { backgroundColor: theme.primary }]}
            onPress={handleNewSearch}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={20} color="white" />
            <Text style={styles.newSearchButtonText}>New Text Search</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.historyItem,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => handleSelectHistory(item)}
              activeOpacity={0.7}
            >
              <View style={styles.historyContent}>
                {/* Mode indicator */}
                <View
                  style={[
                    styles.modeIndicator,
                    {
                      backgroundColor: item.isEnglishMode
                        ? "#007AFF"
                        : "#34C759",
                    },
                  ]}
                >
                  <Text style={styles.modeIndicatorText}>
                    {item.isEnglishMode ? "EN→JA" : "JA"}
                  </Text>
                </View>

                <View style={styles.historyText}>
                  <Text
                    style={[styles.historyInput, { color: theme.textColor }]}
                    numberOfLines={2}
                  >
                    {item.inputText}
                  </Text>

                  {item.isEnglishMode && item.japaneseText && (
                    <Text
                      style={[
                        styles.historyJapanese,
                        { color: theme.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      → {item.japaneseText}
                    </Text>
                  )}

                  {!item.isEnglishMode && item.translation && (
                    <Text
                      style={[
                        styles.historyTranslation,
                        { color: theme.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {item.translation}
                    </Text>
                  )}

                  <View style={styles.historyStats}>
                    <View style={styles.statBadge}>
                      <View
                        style={[
                          styles.statDot,
                          { backgroundColor: subjectColors.vocabulary },
                        ]}
                      />
                      <Text
                        style={[styles.statText, { color: theme.textSecondary }]}
                      >
                        {item.vocabularyMatchCount} vocab
                      </Text>
                    </View>
                    <View style={styles.statBadge}>
                      <View
                        style={[
                          styles.statDot,
                          { backgroundColor: subjectColors.kanji },
                        ]}
                      />
                      <Text
                        style={[styles.statText, { color: theme.textSecondary }]}
                      >
                        {item.kanjiMatchCount} kanji
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.historyMeta}>
                  <Text
                    style={[styles.historyTime, { color: theme.textSecondary }]}
                  >
                    {formatHistoryTimestamp(item.timestamp)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleDeleteHistoryItem(item.id)}
                    style={styles.deleteButton}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color={theme.error}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
          style={styles.historyList}
          contentContainerStyle={styles.historyListContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
    marginLeft: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  newSearchButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  newSearchButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  historyList: {
    flex: 1,
  },
  historyListContent: {
    padding: 16,
  },
  historyItem: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  historyContent: {
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  modeIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 12,
    alignSelf: "flex-start",
  },
  modeIndicatorText: {
    color: "white",
    fontSize: 11,
    fontWeight: "700",
  },
  historyText: {
    flex: 1,
  },
  historyInput: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
    lineHeight: 22,
  },
  historyJapanese: {
    fontSize: 14,
    marginBottom: 4,
  },
  historyTranslation: {
    fontSize: 13,
    fontStyle: "italic",
    marginBottom: 6,
  },
  historyStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statText: {
    fontSize: 12,
  },
  historyMeta: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingLeft: 12,
  },
  historyTime: {
    fontSize: 12,
    marginBottom: 8,
  },
  deleteButton: {
    padding: 4,
  },
});
