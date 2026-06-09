import TextRecognition, {
    TextRecognitionScript,
} from '@react-native-ml-kit/text-recognition';

export interface DetectedTextRegion {
  text: string;
  frame: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export const filterJapaneseText = (text: string): string => {
  // Japanese character ranges:
  // Hiragana: \u3040-\u309F
  // Katakana: \u30A0-\u30FF
  // Kanji: \u4E00-\u9FAF
  // Japanese punctuation: \u3000-\u303F
  // Japanese symbols: \uFF00-\uFFEF (full-width characters)

  const lines = text.split('\n');
  const filteredLines = lines
    .map((line) => {
      const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3000-\u303F\uFF00-\uFFEF\s]/g;
      const matches = line.match(japaneseRegex);
      if (matches) {
        return matches.join('').replace(/\s+/g, ' ').trim();
      }
      return '';
    })
    .filter((line) => line.length > 0);

  return filteredLines.join('\n');
};

export async function performOcr(imageUri: string): Promise<{
  recognizedText: string;
  originalText: string;
  regions: DetectedTextRegion[];
}> {
  // Use Japanese script for better Japanese text recognition
  const result = await TextRecognition.recognize(
    imageUri,
    TextRecognitionScript.JAPANESE
  );

  const originalText = result.text ?? '';
  const recognizedText = filterJapaneseText(originalText);

  const regions: DetectedTextRegion[] = [];

  // Create regions from detected blocks
  if (Array.isArray(result.blocks)) {
    result.blocks.forEach((block: any) => {
      if (block?.text && filterJapaneseText(block.text).length > 0) {
        const frame = {
          // ML Kit uses 'left' and 'top' instead of 'x' and 'y'
          x: block.frame?.left || 0,
          y: block.frame?.top || 0,
          width: block.frame?.width || 0,
          height: block.frame?.height || 0,
        };
        regions.push({ text: block.text, frame });
      }
    });
  }

  return { recognizedText, originalText, regions };
}

