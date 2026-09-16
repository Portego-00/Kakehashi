import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { newArchive, newSession, nowSeconds } from '../model';
import { exportArchive, loadArchive, saveArchive } from '../storage';

const mockFiles = new Map<string, string>();
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual<typeof import('crypto')>('crypto').randomUUID() }));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///private/documents/',
  getInfoAsync: jest.fn(async (uri: string) => ({ exists: mockFiles.has(uri), isDirectory: false, size: Buffer.byteLength(mockFiles.get(uri) ?? '') })),
  readAsStringAsync: jest.fn(async (uri: string) => mockFiles.get(uri)),
  writeAsStringAsync: jest.fn(async (uri: string, text: string) => { mockFiles.set(uri, text); }),
  makeDirectoryAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async (uri: string) => { mockFiles.delete(uri); }),
  moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    const value = mockFiles.get(from);
    if (value === undefined) throw new Error('Missing file');
    mockFiles.set(to, value);
    mockFiles.delete(from);
  }),
}));

describe('native conversation file persistence', () => {
  const originalOS = Platform.OS;
  const root = 'file:///private/documents/conversations/conversation.v1.account.';
  beforeAll(() => { Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' }); });
  afterAll(() => { Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS }); });
  beforeEach(() => { mockFiles.clear(); jest.clearAllMocks(); });

  it('uses app-private files and supports histories beyond an AsyncStorage row size', async () => {
    const archive = newArchive();
    archive.sessions = [{ ...newSession(), endedAt: nowSeconds(), title: 'a'.repeat(2_200_000) }];
    await saveArchive('700', archive);
    expect(await loadArchive('700')).toEqual(archive);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(mockFiles.has(`${root}700.json`)).toBe(true);
    expect(mockFiles.has(`${root}700.backup.json`)).toBe(true);
    expect(mockFiles.has(`${root}700.json.pending`)).toBe(false);
  });

  it('retains the previous committed history if the primary-file promotion fails', async () => {
    const first = newArchive();
    first.preferences.interests = 'original';
    await saveArchive('701', first);
    const originalMove = jest.mocked(FileSystem.moveAsync).getMockImplementation()!;
    jest.mocked(FileSystem.moveAsync).mockImplementation(async (args) => {
      if (args.to === `${root}701.json`) throw new Error('Interrupted during file promotion');
      return originalMove(args);
    });
    await expect(saveArchive('701', { ...first, preferences: { ...first.preferences, interests: 'new' } })).rejects.toThrow('Interrupted');
    expect(await loadArchive('701')).toEqual(first);
    jest.mocked(FileSystem.moveAsync).mockImplementation(originalMove);
  });

  it('can recover a complete pending backup after interruption while repairing damaged storage', async () => {
    const archive = newArchive();
    archive.preferences.interests = 'saved history';
    mockFiles.set(`${root}702.json`, '{broken');
    mockFiles.set(`${root}702.backup.json.pending`, exportArchive(archive));
    expect(await loadArchive('702')).toEqual(archive);
    await saveArchive('702', archive);
    expect(await loadArchive('702')).toEqual(archive);
  });
});
