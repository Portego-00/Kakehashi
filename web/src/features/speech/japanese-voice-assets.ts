export const JAPANESE_VOICE_MODEL_REVISION = "bf70fae2e21f9670456ebb40e8df131f146f1821";
export const JAPANESE_VOICE_MODEL_SIZE = 39_414_515;
export const JAPANESE_VOICE_MODEL_SHA256 = "375694f9a9c24d57ebbccfff7e16b20a3775a926754603f34123744d2e4d9d2a";
export const JAPANESE_VOICE_DOWNLOAD_LABEL = "about 65 MB";

export const JAPANESE_VOICE_MODEL_URL = `https://huggingface.co/ayousanz/piper-plus-css10-ja-6lang/resolve/${JAPANESE_VOICE_MODEL_REVISION}/css10-ja-6lang-fp16.onnx`;

const MODEL_DATABASE = "piper-plus-models";
const MODEL_STORE = "models";
const DICTIONARY_STORE = "dictionaries";
const DATABASE_VERSION = 2;

function openModelDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(MODEL_DATABASE, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(MODEL_STORE)) database.createObjectStore(MODEL_STORE);
      if (!database.objectStoreNames.contains(DICTIONARY_STORE)) database.createObjectStore(DICTIONARY_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The Japanese voice database could not be opened."));
    request.onblocked = () => reject(new Error("The Japanese voice database is busy in another tab."));
  });
}

export function supportsJapaneseVoice() {
  return typeof window !== "undefined"
    && typeof indexedDB !== "undefined"
    && typeof Worker !== "undefined"
    && typeof WebAssembly !== "undefined"
    && Boolean(window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
}

/** Checks the pinned cache key without reading the 39 MB model into memory. */
export async function hasSavedJapaneseVoice() {
  if (!supportsJapaneseVoice()) return false;
  const database = await openModelDatabase();
  try {
    return await new Promise<boolean>((resolve, reject) => {
      const request = database.transaction(MODEL_STORE, "readonly").objectStore(MODEL_STORE).getKey(JAPANESE_VOICE_MODEL_URL);
      request.onsuccess = () => resolve(request.result === JAPANESE_VOICE_MODEL_URL);
      request.onerror = () => reject(request.error ?? new Error("The saved Japanese voice could not be checked."));
    });
  } finally {
    database.close();
  }
}

