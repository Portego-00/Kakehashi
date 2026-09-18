import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Browsers have no equivalent to Keychain. BYOK remains in memory for this tab;
// it is never included in an archive, logs, AsyncStorage, or the application bundle.
const browserKeys = new Map<string, string>();
const keyName = (accountId: string) => `conversation.openai.${Array.from(accountId).map((c) => c.codePointAt(0)!.toString(16)).join('-')}`;

export async function readKey(accountId: string): Promise<string | null> {
  if (!accountId) return null;
  if (Platform.OS === 'web') return browserKeys.get(accountId) ?? null;
  return SecureStore.getItemAsync(keyName(accountId));
}

export async function saveKey(accountId: string, value: string): Promise<void> {
  if (!accountId) throw new Error('Sign in before adding your OpenAI key.');
  const key = value.trim();
  if (!key.startsWith('sk-') || key.length < 20 || /\s/.test(key)) {
    throw new Error('Enter a valid OpenAI API key, beginning with sk-.');
  }
  if (Platform.OS === 'web') browserKeys.set(accountId, key);
  else await SecureStore.setItemAsync(keyName(accountId), key, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearKey(accountId: string): Promise<void> {
  browserKeys.delete(accountId);
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(keyName(accountId));
}
