import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useTheme } from '../../src/utils/theme';
import {
  getSpeechHistory,
  clearSpeechHistory,
  removeSpeechHistoryItem,
  formatHistoryTimestamp,
  type SpeechHistoryItem
} from '../../src/utils/searchHistory';

export default function SpeechHistoryScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [history, setHistory] = useState<SpeechHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      const speechHistory = await getSpeechHistory();
      setHistory(speechHistory);
    } catch (error) {
      console.error('Error loading speech history:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSelectHistory = useCallback((item: SpeechHistoryItem) => {
    router.push({
      pathname: '/speech-history-result',
      params: {
        historyItem: JSON.stringify(item)
      }
    });
  }, [router]);

  const handleDeleteHistoryItem = useCallback(async (id: string) => {
    try {
      await removeSpeechHistoryItem(id);
      setHistory(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('Error removing speech history item:', error);
    }
  }, []);

  const handleClearHistory = useCallback(async () => {
    try {
      await clearSpeechHistory();
      setHistory([]);
    } catch (error) {
      console.error('Error clearing speech history:', error);
    }
  }, []);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.textColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textColor }]}>Speech History</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading history...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>Speech History</Text>
        {history.length > 0 && (
          <TouchableOpacity onPress={handleClearHistory} style={styles.clearButton}>
            <Text style={[styles.clearButtonText, { color: theme.error }]}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {history.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="mic-outline" size={64} color={theme.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No speech history yet</Text>
          <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
            Your voice searches will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.historyItem, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
              onPress={() => handleSelectHistory(item)}
              activeOpacity={0.7}
            >
              <View style={styles.historyContent}>
                {/* Speech/Translation indicator */}
                <View style={[styles.modeIndicator, { backgroundColor: item.isEnglishMode ? '#007AFF' : '#34C759' }]}>
                  <Text style={styles.modeIndicatorText}>{item.isEnglishMode ? 'EN→JA' : 'JA'}</Text>
                </View>
                
                <View style={styles.historyText}>
                  <Text style={[styles.historyRecognized, { color: theme.textColor }]} numberOfLines={2}>
                    {item.recognizedText}
                  </Text>
                  
                  {item.originalText !== item.recognizedText && (
                    <Text style={[styles.historyOriginal, { color: theme.textSecondary }]} numberOfLines={1}>
                      Original: {item.originalText}
                    </Text>
                  )}
                  
                  {item.translation && (
                    <Text style={[styles.historyTranslation, { color: theme.textSecondary }]} numberOfLines={1}>
                      Translation: {item.translation}
                    </Text>
                  )}
                  
                  <Text style={[styles.historyMatches, { color: theme.primary }]}>
                    {item.vocabularyMatchCount} vocab, {item.kanjiMatchCount} kanji
                  </Text>
                </View>
                
                <View style={styles.historyMeta}>
                  <Text style={[styles.historyTime, { color: theme.textSecondary }]}>
                    {formatHistoryTimestamp(item.timestamp)}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => handleDeleteHistoryItem(item.id)}
                    style={styles.deleteButton}
                  >
                    <Ionicons name="trash-outline" size={20} color={theme.error} />
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  historyList: {
    flex: 1,
  },
  historyListContent: {
    padding: 16,
  },
  historyItem: {
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  historyContent: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  modeIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 12,
    alignSelf: 'flex-start',
  },
  modeIndicatorText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  historyText: {
    flex: 1,
  },
  historyRecognized: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  historyOriginal: {
    fontSize: 13,
    marginBottom: 2,
  },
  historyTranslation: {
    fontSize: 13,
    marginBottom: 4,
  },
  historyMatches: {
    fontSize: 12,
    fontWeight: '600',
  },
  historyMeta: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
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