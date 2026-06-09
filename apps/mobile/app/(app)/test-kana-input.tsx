import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import KanaInput from '../../src/components/TextToKanaInput';

export default function TestKanaInput() {
  const [currentKana, setCurrentKana] = useState('');
  const [history, setHistory] = useState<string[]>([]);

  const handleKanaChange = (kana: string) => {
    setCurrentKana(kana);
    // Add to history when the input is complete (no trailing 'n')
    if (!kana.endsWith('n')) {
      setHistory(prev => [kana, ...prev].slice(0, 10));
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Kana Input Test</Text>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Type to convert to kana:</Text>
          <KanaInput
            style={styles.input}
            onKanaChange={handleKanaChange}
            placeholder="Type romaji here..."
          />
        </View>

        <View style={styles.currentContainer}>
          <Text style={styles.label}>Current Input:</Text>
          <Text style={styles.currentText}>{currentKana || '(empty)'}</Text>
        </View>

        <View style={styles.historyContainer}>
          <Text style={styles.label}>Recent Conversions:</Text>
          {history.length === 0 ? (
            <Text style={styles.emptyText}>No conversions yet</Text>
          ) : (
            history.map((kana, index) => (
              <Text key={index} style={styles.historyItem}>
                {kana}
              </Text>
            ))
          )}
        </View>

        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>Instructions:</Text>
          <Text style={styles.instructionsText}>
            • Type romaji to convert to hiragana{'\n'}
            • Use &apos;n&apos; for ん{'\n'}
            • Type &apos;nn&apos; for んん{'\n'}
            • Use &apos;x&apos; before a letter for small kana{'\n'}
            • Type &apos;xtsu&apos; for っ{'\n'}
            • Use &apos;-&apos; for long vowels{'\n'}
            • Type &apos;wo&apos; for を
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f6f6',
  },
  content: {
    padding: 16,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  currentContainer: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  currentText: {
    fontSize: 24,
    color: '#333',
    textAlign: 'center',
  },
  historyContainer: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  historyItem: {
    fontSize: 18,
    color: '#333',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  instructionsContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
}); 