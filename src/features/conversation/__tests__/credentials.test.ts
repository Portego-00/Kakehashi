import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { clearKey, readKey, saveKey } from '../credentials';

describe('Per-account personal OpenAI credentials', () => {
  const originalOS = Platform.OS;
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => { Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true }); });

  it('stores native keys in the secure device store with collision-free account names', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    await saveKey('a/b', '  sk-personal-long-enough-key  ');
    await saveKey('a_b', 'sk-another-long-enough-key');
    const calls = (SecureStore.setItemAsync as jest.Mock).mock.calls;
    expect(calls[0][0]).not.toBe(calls[1][0]);
    expect(calls[0][0]).toMatch(/^[\w.-]+$/);
    expect(calls[0][1]).toBe('sk-personal-long-enough-key');
    await clearKey('a/b');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(calls[0][0]);
  });

  it('keeps browser keys only in this tab’s memory and isolates accounts', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    await saveKey('portego', 'sk-personal-long-enough-key');
    expect(await readKey('portego')).toBe('sk-personal-long-enough-key');
    expect(await readKey('another-user')).toBeNull();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    await clearKey('portego');
    expect(await readKey('portego')).toBeNull();
  });

  it('rejects empty accounts and malformed keys without persisting anything', async () => {
    await expect(saveKey('', 'sk-personal-long-enough-key')).rejects.toThrow('Sign in');
    await expect(saveKey('portego', 'password')).rejects.toThrow('valid OpenAI');
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });
});
