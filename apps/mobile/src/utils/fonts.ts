import { StyleSheet, TextStyle } from 'react-native';

// Helper function to check if text contains Japanese characters
export function containsJapanese(text: string): boolean {
  if (!text) return false;
  
  // Regular expression to match Japanese characters:
  // - Hiragana (3040-309F)
  // - Katakana (30A0-30FF)
  // - CJK Unified Ideographs/Kanji (4E00-9FAF)
  // - Half-width Katakana (FF65-FF9F)
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\uFF65-\uFF9F]/.test(text);
}

// Font styles for different text types
export const fontStyles = StyleSheet.create({
  // Japanese text styles
  japaneseText: {
    fontFamily: 'SourceHanSansJP-Regular',
  },
  japaneseBold: {
    fontFamily: 'SourceHanSansJP-Bold',
  },
});

// Function to get appropriate text style for content
export function getTextStyle(text: string, defaultStyle?: TextStyle): TextStyle {
  if (containsJapanese(text)) {
    return {
      ...defaultStyle,
      fontFamily: 'SourceHanSansJP-Regular',
    };
  }
  return defaultStyle || {};
}

// Function to get appropriate bold text style for content
export function getBoldTextStyle(text: string, defaultStyle?: TextStyle): TextStyle {
  if (containsJapanese(text)) {
    return {
      ...defaultStyle,
      fontFamily: 'SourceHanSansJP-Bold',
    };
  }
  return {
    ...defaultStyle,
    fontWeight: 'bold',
  };
}

// Custom Text component that automatically applies the correct font
export function getJapaneseStyleIfNeeded(text?: string): TextStyle | undefined {
  if (!text) return undefined;
  return containsJapanese(text) ? fontStyles.japaneseText : undefined;
}

export function getJapaneseBoldStyleIfNeeded(text?: string): TextStyle | undefined {
  if (!text) return undefined;
  return containsJapanese(text) ? fontStyles.japaneseBold : undefined;
} 