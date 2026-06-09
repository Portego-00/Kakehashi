
/**
 * Azure Translator service that calls the REST endpoint directly with the
 * subscription key + region headers (no bearer‑token round‑trip needed).
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

  private async getAccessToken(): Promise<string> {
    this.ensureConfigured();

    try {
      const tokenEndpoint = `https://${AZURE_CONFIG.region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
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
      console.error('Error getting access token:', error);
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
    to: string = 'en'
  ): Promise<string> {
    try {
      const accessToken = await this.getAccessToken();
      this.ensureConfigured();

      const endpoint = `${AZURE_CONFIG.apiBaseUrl}/translate?api-version=3.0&from=${from}&to=${to}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': AZURE_CONFIG.subscriptionKey,
          'Ocp-Apim-Subscription-Region': AZURE_CONFIG.region,
        },
        body: JSON.stringify([{ text }]),
      });

      if (!response.ok) {
        throw new Error(`Translation failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data[0].translations[0].text;
    } catch (error) {
      console.error('Error translating text:', error);
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
