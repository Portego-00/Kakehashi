const path = require('path');
const root = path.resolve(__dirname, '../../..');
const config = require(path.join(root, 'metro.config.js'));
const fixture = name => ({type: 'sourceFile', filePath: path.join(__dirname, name)});
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'expo-router/entry' || moduleName === 'expo-router/entry-classic' || moduleName.endsWith('/expo-router/entry.js') || moduleName.endsWith('/expo-router/entry')) return fixture('entry.tsx');
  if (moduleName === 'react-native-mmkv/issue-110-original') return context.resolveRequest(context, 'react-native-mmkv', platform);
  if (moduleName === 'react-native-mmkv') return fixture('mmkv.ts');
  if (moduleName === 'expo-router') return fixture('router.tsx');
  if (moduleName === '@react-native-async-storage/async-storage') return fixture('async-storage.ts');
  const resolved = context.resolveRequest(context, moduleName, platform);
  if (resolved.type !== 'sourceFile') return resolved;
  const aliases = {
    'src/utils/api.ts': 'api.ts',
    'src/utils/store.ts': 'store.ts',
    'src/lib/supabase.ts': 'supabase.ts',
    'src/hooks/useSubjectLists.ts': 'subject-lists.ts',
    'src/services/offlineVocabularyAudioService.ts': 'audio-cache.ts',
  };
  const replacement = aliases[path.relative(root, resolved.filePath)];
  return replacement ? fixture(replacement) : resolved;
};
module.exports = config;
