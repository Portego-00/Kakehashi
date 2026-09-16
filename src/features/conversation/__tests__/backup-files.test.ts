import { Platform } from 'react-native';
import { getDocumentAsync } from 'expo-document-picker';
import { pickLearningBackup } from '../backup-files';
import { MAXIMUM_ARCHIVE_BYTES } from '../storage';

const mockDelete = jest.fn();
const mockText = jest.fn(async () => '{"schemaVersion":2}');
let mockSize = 0;
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///cache/' },
  File: class {
    uri: string;
    constructor(uri: string) { this.uri = uri; }
    get size() { return mockSize; }
    get exists() { return true; }
    text = mockText;
    delete = mockDelete;
  },
}));

describe('Conversation backup selection', () => {
  const originalOS = Platform.OS;
  beforeEach(() => {
    jest.clearAllMocks(); mockSize = 0;
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  });
  afterEach(() => Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true }));

  it('accepts backups between the old 25 MB limit and the archive’s 30 MB limit', async () => {
    mockSize = 27_000_000;
    (getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/backup.json', size: mockSize }] });
    await expect(pickLearningBackup()).resolves.toBe('{"schemaVersion":2}');
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('removes the native cache copy even when picker metadata identifies an oversize file', async () => {
    (getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/backup.json', size: MAXIMUM_ARCHIVE_BYTES + 1 }] });
    await expect(pickLearningBackup()).rejects.toThrow('30 MB');
    expect(mockText).not.toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('also checks actual file size when picker metadata is unavailable', async () => {
    mockSize = MAXIMUM_ARCHIVE_BYTES + 1;
    (getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/backup.json' }] });
    await expect(pickLearningBackup()).rejects.toThrow('30 MB');
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });
});
