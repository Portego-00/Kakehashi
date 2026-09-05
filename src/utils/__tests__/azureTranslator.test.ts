/* eslint-disable @typescript-eslint/no-require-imports -- the service reads environment configuration when its module loads. */
import fetchMock from 'jest-fetch-mock';

const ORIGINAL_ENV = {
  subscriptionKey:
    process.env.EXPO_PUBLIC_AZURE_TRANSLATOR_SUBSCRIPTION_KEY,
  fallbackKey: process.env.EXPO_PUBLIC_AZURE_TRANSLATOR_KEY,
  region: process.env.EXPO_PUBLIC_AZURE_TRANSLATOR_REGION,
  apiBaseUrl: process.env.EXPO_PUBLIC_AZURE_TRANSLATOR_API_BASE_URL,
};

function loadService(): typeof import('../azureTranslator').azureTranslatorService {
  return require('../azureTranslator').azureTranslatorService;
}

function restoreEnvironmentValue(
  key: keyof NodeJS.ProcessEnv,
  value: string | undefined,
): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

describe('Azure Translator service', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    fetchMock.resetMocks();
    process.env.EXPO_PUBLIC_AZURE_TRANSLATOR_SUBSCRIPTION_KEY = 'test-key';
    delete process.env.EXPO_PUBLIC_AZURE_TRANSLATOR_KEY;
    process.env.EXPO_PUBLIC_AZURE_TRANSLATOR_REGION = 'test-region';
    process.env.EXPO_PUBLIC_AZURE_TRANSLATOR_API_BASE_URL =
      'https://translator.example';
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  afterAll(() => {
    restoreEnvironmentValue(
      'EXPO_PUBLIC_AZURE_TRANSLATOR_SUBSCRIPTION_KEY',
      ORIGINAL_ENV.subscriptionKey,
    );
    restoreEnvironmentValue(
      'EXPO_PUBLIC_AZURE_TRANSLATOR_KEY',
      ORIGINAL_ENV.fallbackKey,
    );
    restoreEnvironmentValue(
      'EXPO_PUBLIC_AZURE_TRANSLATOR_REGION',
      ORIGINAL_ENV.region,
    );
    restoreEnvironmentValue(
      'EXPO_PUBLIC_AZURE_TRANSLATOR_API_BASE_URL',
      ORIGINAL_ENV.apiBaseUrl,
    );
  });

  it('returns blank translation input locally without requesting credentials', async () => {
    const service = loadService();

    await expect(service.translate('  \n  ', 'ja', 'en')).resolves.toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('translates trimmed text and passes the abort signal to both requests', async () => {
    fetchMock
      .mockResponseOnce('access-token')
      .mockResponseOnce(
        JSON.stringify([
          { translations: [{ text: 'The cat is sleeping.' }] },
        ]),
      );
    const service = loadService();
    const controller = new AbortController();

    await expect(
      service.translate('  猫が寝ています。  ', 'ja', 'en', {
        signal: controller.signal,
      }),
    ).resolves.toBe('The cat is sleeping.');

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://translator.example/translate?api-version=3.0&from=ja&to=en',
      expect.objectContaining({
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify([{ text: '猫が寝ています。' }]),
      }),
    );
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
    expect(fetchMock.mock.calls[1]?.[1]?.signal).toBe(controller.signal);
  });

  it('rejects a malformed Azure translation payload', async () => {
    fetchMock
      .mockResponseOnce('access-token')
      .mockResponseOnce(JSON.stringify([{ translations: [{}] }]));
    const service = loadService();

    await expect(service.translate('猫', 'ja', 'en')).rejects.toThrow(
      'Translation returned an invalid response.',
    );
  });

  it('returns blank input locally without requesting credentials', async () => {
    const service = loadService();

    await expect(
      service.transliterateJapaneseToKana('  \n  '),
    ).resolves.toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes kana-only Japanese locally', async () => {
    const service = loadService();

    await expect(
      service.transliterateJapaneseToKana('  コンピューターです。  '),
    ).resolves.toBe('こんぴゅーたーです。');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('handles Azure documented Japanese romanization conventions', async () => {
    fetchMock
      .mockResponseOnce('access-token')
      .mockResponseOnce(
        JSON.stringify([
          { text: 'kyouha konnnichiha.', script: 'Latn' },
        ]),
      );
    const service = loadService();

    await expect(
      service.transliterateJapaneseToKana('今日はこんにちは。'),
    ).resolves.toBe('きょうは こんにちは。');
  });

  it('restores devoiced vowels from Azure romanization before conversion', async () => {
    fetchMock
      .mockResponseOnce('access-token')
      .mockResponseOnce(
        JSON.stringify([{ text: 'honha sodeska.', script: 'Latn' }]),
      );
    const service = loadService();

    await expect(
      service.transliterateJapaneseToKana('本はそうですか。'),
    ).resolves.toBe('ほんは そうですか。');
  });

  it('transliterates Japanese through Azure and converts macrons to hiragana', async () => {
    fetchMock
      .mockResponseOnce('access-token')
      .mockResponseOnce(
        JSON.stringify([
          { text: 'Tōkyō de gakkō ni ikimasu.', script: 'Latn' },
        ]),
      );
    const service = loadService();

    const kana = await service.transliterateJapaneseToKana(
      '  東京で学校に行きます。  ',
    );

    expect(kana).toBe('とうきょう で がっこう に いきます。');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://test-region.api.cognitive.microsoft.com/sts/v1.0/issueToken',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://translator.example/transliterate?api-version=3.0&language=ja&fromScript=Jpan&toScript=Latn',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify([{ text: '東京で学校に行きます。' }]),
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
          'Ocp-Apim-Subscription-Key': 'test-key',
          'Ocp-Apim-Subscription-Region': 'test-region',
        }),
      }),
    );

    const latinOrMacronPattern = /[A-Za-zĀāĪīŪūĒēŌō]/;
    expect(latinOrMacronPattern.test(kana)).toBe(false);
  });

  it('rejects a non-successful transliteration response', async () => {
    fetchMock
      .mockResponseOnce('access-token')
      .mockResponseOnce('temporarily unavailable', {
        status: 503,
        statusText: 'Service Unavailable',
      });
    const service = loadService();

    await expect(
      service.transliterateJapaneseToKana('東京'),
    ).rejects.toThrow('Transliteration failed: Service Unavailable');
  });

  it('rejects a malformed Azure transliteration payload', async () => {
    fetchMock
      .mockResponseOnce('access-token')
      .mockResponseOnce(JSON.stringify([{ script: 'Latn' }]));
    const service = loadService();

    await expect(
      service.transliterateJapaneseToKana('東京'),
    ).rejects.toThrow('Transliteration returned an invalid response.');
  });

  it('rejects an unexpected transliteration output script', async () => {
    fetchMock
      .mockResponseOnce('access-token')
      .mockResponseOnce(JSON.stringify([{ text: 'toukyou', script: 'Jpan' }]));
    const service = loadService();

    await expect(
      service.transliterateJapaneseToKana('東京'),
    ).rejects.toThrow('Transliteration returned an unexpected script.');
  });

  it('passes the abort signal to both credential and transliteration requests', async () => {
    fetchMock
      .mockResponseOnce('access-token')
      .mockResponseOnce(
        JSON.stringify([{ text: 'Toukyou', script: 'Latn' }]),
      );
    const service = loadService();
    const controller = new AbortController();

    await expect(
      service.transliterateJapaneseToKana('東京', {
        signal: controller.signal,
      }),
    ).resolves.toBe('とうきょう');

    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
    expect(fetchMock.mock.calls[1]?.[1]?.signal).toBe(controller.signal);
  });

  it('does not start a request when the signal is already aborted', async () => {
    const service = loadService();
    const controller = new AbortController();
    controller.abort();

    await expect(
      service.transliterateJapaneseToKana('東京', {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
