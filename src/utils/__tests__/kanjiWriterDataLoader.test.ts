import AsyncStorage from '@react-native-async-storage/async-storage';
import fetchMock from 'jest-fetch-mock';
import { clearKanjiWriterCache, isKanjiStrokeDataAvailable, loadKanjiWriterData } from '../kanjiWriterDataLoader';
import data from '../../components/__tests__/fixtures/kanji-betsu.json';

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.resetMocks();
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
});
afterEach(() => jest.useRealTimers());

test('replaces malformed cached data instead of handing it to the player', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(JSON.stringify({ strokes: ['M0 0'], medians: [] }));
  fetchMock.mockResponseOnce(JSON.stringify(data));
  expect(await loadKanjiWriterData('別')).toEqual(data);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('falls back when a successful response contains invalid stroke data', async () => {
  fetchMock.mockResponseOnce(JSON.stringify({strokes: []})).mockResponseOnce(JSON.stringify(data));
  expect(await loadKanjiWriterData('別')).toEqual(data);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('a stalled response body times out and tries the fallback', async () => {
  jest.useFakeTimers();
  fetchMock.mockImplementationOnce(async () => ({ ok: true, json: () => new Promise(() => {}) }) as Response);
  fetchMock.mockResponseOnce(JSON.stringify(data));
  const result = loadKanjiWriterData('別');
  await jest.advanceTimersByTimeAsync(8001);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await expect(result).resolves.toEqual(data);
});

test('offline failures and old unavailable flags do not permanently hide stroke data', async () => {
  fetchMock.mockReject(new Error('offline'));
  await expect(isKanjiStrokeDataAvailable('別')).resolves.toBe(false);
  jest.mocked(AsyncStorage.getItem).mockImplementation(async (key) => key.startsWith('kanji_unavailable_') ? 'true' : null);
  fetchMock.mockResponse(JSON.stringify(data));
  await expect(isKanjiStrokeDataAvailable('別')).resolves.toBe(true);
});

test('shares one load between concurrent callers and reads valid cache offline', async () => {
  fetchMock.mockResponse(JSON.stringify(data));
  await expect(Promise.all([loadKanjiWriterData('別'), loadKanjiWriterData('別')])).resolves.toEqual([data, data]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(data));
  fetchMock.mockReject(new Error('offline'));
  await expect(loadKanjiWriterData('別')).resolves.toEqual(data);
});

test('clears data and legacy unavailable flags together', async () => {
  jest.mocked(AsyncStorage.getAllKeys).mockResolvedValue(['kanji_writer_05225', 'kanji_unavailable_別', 'other']);
  await clearKanjiWriterCache();
  expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(['kanji_writer_05225', 'kanji_unavailable_別']);
});
