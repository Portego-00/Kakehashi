import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { encodedBytes, MAXIMUM_ARCHIVE_BYTES } from './storage';

export async function shareLearningBackup(json: string) {
  const name = `kakehashi-conversations-${new Date().toISOString().slice(0, 10)}.json`;
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = name; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const file = new File(Paths.cache, name);
  try {
    let Sharing: typeof import('expo-sharing');
    try {
      // Load new native modules only when their action is requested; older builds can still read history.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      Sharing = require('expo-sharing');
    }
    catch { throw new Error('Sharing backups needs the updated Kakehashi build. Install the latest iOS or Android build with file sharing support.'); }
    file.write(json);
    if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is unavailable on this device.');
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Save learning backup' });
  } finally { if (file.exists) file.delete(); }
}

export async function pickLearningBackup(): Promise<string | null> {
  let DocumentPicker: typeof import('expo-document-picker');
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    DocumentPicker = require('expo-document-picker');
  }
  catch { throw new Error('Importing backups needs the updated Kakehashi build. Install the latest iOS or Android build with document picker support.'); }
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const tooLarge = () => new Error(`This backup is too large. The limit is ${MAXIMUM_ARCHIVE_BYTES / 1_000_000} MB.`);
  if (Platform.OS === 'web' && asset.file) {
    if ((asset.size ?? asset.file.size) > MAXIMUM_ARCHIVE_BYTES) throw tooLarge();
    const text = await asset.file.text();
    if (encodedBytes(text) > MAXIMUM_ARCHIVE_BYTES) throw tooLarge();
    return text;
  }
  const file = new File(asset.uri);
  try {
    if ((asset.size ?? 0) > MAXIMUM_ARCHIVE_BYTES || file.size > MAXIMUM_ARCHIVE_BYTES) throw tooLarge();
    const text = await file.text();
    if (encodedBytes(text) > MAXIMUM_ARCHIVE_BYTES) throw tooLarge();
    return text;
  } finally { if (file.exists) file.delete(); }
}
