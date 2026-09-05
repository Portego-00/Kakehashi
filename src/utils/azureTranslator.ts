import * as wanakana from 'wanakana';

export type TransliterateJapaneseToKanaOptions = {
  signal?: AbortSignal;
};

export type AzureTranslateOptions = {
  signal?: AbortSignal;
};

type AzureTransliterationResponse = {
  text?: unknown;
  script?: unknown;
};

const LONG_VOWEL_ROMAJI_REPLACEMENTS: Record<string, string> = {
  Ā: 'Aa',
  ā: 'aa',
  Â: 'Aa',
  â: 'aa',
  Ī: 'Ii',
  ī: 'ii',
  Î: 'Ii',
  î: 'ii',
  Ū: 'Uu',
  ū: 'uu',
  Û: 'Uu',
  û: 'uu',
  Ē: 'Ee',
  ē: 'ee',
  Ê: 'Ee',
  ê: 'ee',
  Ō: 'Ou',
  ō: 'ou',
  Ô: 'Ou',
  ô: 'ou',
};

function normalizeAzureRomanization(value: string): string {
  return value
    .normalize('NFC')
    .replace(
      /[ĀāÂâĪīÎîŪūÛûĒēÊêŌōÔô]/g,
      (character) => LONG_VOWEL_ROMAJI_REPLACEMENTS[character] ?? character,
    )
    .replace(/[’ʼ]/g, "'")
    // Azure documents こんにちは as `konnnichiha`; mark the syllabic ん so
    // WanaKana does not interpret it as an extra ん.
    .replace(/n{3}(?=[aeiouy])/gi, "n'n")
    // Azure can omit the devoiced `u` in common copula endings (for example,
    // `sodeska`). Restore it before converting the Latin script to kana.
    .replace(/des(?=ka|ne|yo|kedo|kara|[\s.,!?]|$)/gi, 'desu')
    .replace(/mas(?=ka|ne|yo|[\s.,!?]|$)/gi, 'masu')
    .replace(
      /(^|\s)so(?=desu(?:ka|ne|yo)?(?:[\s.,!?]|$))/gi,
      '$1sou',
    );
}

function katakanaToHiraganaPreservingLongVowels(value: string): string {
  return value.replace(/[ァ-ヶ]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) - 0x60),
  );
}

function createAbortError(): Error {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  );
}

/**
 * Azure Translator service that obtains a short-lived access token and calls
 * the REST translation and transliteration endpoints directly.
 * 
 * These EXPO_PUBLIC values are bundled into the app and should be treated as
 * public client configuration.
 */
class AzureTranslatorService {
  private ensureConfigured(): void {
    if (!AZURE_CONFIG.subscriptionKey || !AZURE_CONFIG.region) {
      throw new Error(
        "Missing Azure Translator config. Set EXPO_PUBLIC_AZURE_TRANSLATOR_SUBSCRIPTION_KEY and EXPO_PUBLIC_AZURE_TRANSLATOR_REGION."
      );
    }
  }

  private async getAccessToken(signal?: AbortSignal): Promise<string> {
    throwIfAborted(signal);
    this.ensureConfigured();

    try {
      const tokenEndpoint = `https://${AZURE_CONFIG.region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        ...(signal ? { signal } : {}),
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_CONFIG.subscriptionKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get access token: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      if (!isAbortError(error)) {
        console.error('Error getting access token:', error);
      }
      throw error;
    }
  }

  /**
   * Translate text from one language to another.
   * @param text The text to translate.
   * @param from Source language (ISO code). Defaults to Japanese (“ja”).
   * @param to   Target language (ISO code). Defaults to English (“en”).
   */
  async translate(
    text: string,
    from: string = 'ja',
    to: string = 'en',
    options: AzureTranslateOptions = {},
  ): Promise<string> {
    const normalizedText = text.trim();
    if (!normalizedText) {
      return '';
    }

    const { signal } = options;
    throwIfAborted(signal);

    try {
      const accessToken = await this.getAccessToken(signal);
      throwIfAborted(signal);
      this.ensureConfigured();

      const endpoint =
        `${AZURE_CONFIG.apiBaseUrl}/translate?api-version=3.0` +
        `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        signal,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': AZURE_CONFIG.subscriptionKey,
          'Ocp-Apim-Subscription-Region': AZURE_CONFIG.region,
        },
        body: JSON.stringify([{ text: normalizedText }]),
      });

      if (!response.ok) {
        throw new Error(`Translation failed: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        translations?: { text?: unknown }[];
      }[];
      const translatedText = Array.isArray(data)
        ? data[0]?.translations?.[0]?.text
        : undefined;
      if (typeof translatedText !== 'string') {
        throw new Error('Translation returned an invalid response.');
      }

      return translatedText;
    } catch (error) {
      if (!isAbortError(error)) {
        console.error('Error translating text:', error);
      }
      throw error;
    }
  }

  /**
   * Derive a hiragana rendering of Japanese text using Azure's Japanese
   * transliteration before converting the returned Latin script locally.
   */
  async transliterateJapaneseToKana(
    text: string,
    options: TransliterateJapaneseToKanaOptions = {},
  ): Promise<string> {
    const normalizedText = text.trim();
    if (!normalizedText) {
      return '';
    }

    const { signal } = options;
    throwIfAborted(signal);

    if (
      !/[\u3400-\u9FFF々〆ヵヶ]/.test(normalizedText) &&
      !/[A-Za-z]/.test(normalizedText)
    ) {
      return katakanaToHiraganaPreservingLongVowels(normalizedText);
    }

    try {
      const accessToken = await this.getAccessToken(signal);
      throwIfAborted(signal);
      this.ensureConfigured();

      const endpoint =
        `${AZURE_CONFIG.apiBaseUrl}/transliterate?api-version=3.0` +
        '&language=ja&fromScript=Jpan&toScript=Latn';
      const response = await fetch(endpoint, {
        method: 'POST',
        signal,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': AZURE_CONFIG.subscriptionKey,
          'Ocp-Apim-Subscription-Region': AZURE_CONFIG.region,
        },
        body: JSON.stringify([{ text: normalizedText }]),
      });

      if (!response.ok) {
        const statusLabel = response.statusText || String(response.status);
        throw new Error(`Transliteration failed: ${statusLabel}`);
      }

      const data = (await response.json()) as AzureTransliterationResponse[];
      const romanizedText = Array.isArray(data) ? data[0]?.text : undefined;
      const outputScript = Array.isArray(data) ? data[0]?.script : undefined;
      if (typeof romanizedText !== 'string' || !romanizedText.trim()) {
        throw new Error('Transliteration returned an invalid response.');
      }
      if (
        typeof outputScript !== 'string' ||
        outputScript.toLowerCase() !== 'latn'
      ) {
        throw new Error('Transliteration returned an unexpected script.');
      }

      const kana = wanakana.toHiragana(
        normalizeAzureRomanization(romanizedText.trim()),
        { IMEMode: false },
      );
      if (/[A-Za-z]/.test(kana)) {
        throw new Error('Transliteration could not be converted fully to kana.');
      }

      return kana;
    } catch (error) {
      if (!isAbortError(error)) {
        console.error('Error transliterating Japanese text:', error);
      }
      throw error;
    }
  }
}

/** Singleton instance for convenience */
export const azureTranslatorService = new AzureTranslatorService();

const AZURE_CONFIG = {
  subscriptionKey:
    process.env.EXPO_PUBLIC_AZURE_TRANSLATOR_SUBSCRIPTION_KEY?.trim() ||
    process.env.EXPO_PUBLIC_AZURE_TRANSLATOR_KEY?.trim() ||
    "",
  region: process.env.EXPO_PUBLIC_AZURE_TRANSLATOR_REGION?.trim() || "",
  apiBaseUrl:
    process.env.EXPO_PUBLIC_AZURE_TRANSLATOR_API_BASE_URL?.trim() ||
    "https://api.cognitive.microsofttranslator.com",
};
