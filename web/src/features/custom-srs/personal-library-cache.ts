import { EMPTY_PERSONAL_LIBRARY, personalEntrySchema, type PersonalLibrary } from "./personal-vocabulary";

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("kakehashi-personal-vocabulary", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("accounts");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
export async function loadPersonalLibraryCache(scope: string): Promise<PersonalLibrary> {
  let db: IDBDatabase | undefined;
  try {
    db = await database();
    const value = await new Promise<PersonalLibrary | undefined>((resolve, reject) => {
      const request = db!.transaction("accounts", "readonly").objectStore("accounts").get(scope);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    if (!value || !Number.isSafeInteger(value.revision) || value.revision < 0 || !value.entries || Array.isArray(value.entries)) return EMPTY_PERSONAL_LIBRARY;
    for (const [id, entry] of Object.entries(value.entries)) {
      if (!personalEntrySchema.safeParse(entry).success || entry.id !== id || entry.revision > value.revision) return EMPTY_PERSONAL_LIBRARY;
    }
    return value;
  } catch { return EMPTY_PERSONAL_LIBRARY; }
  finally { db?.close(); }
}
export async function savePersonalLibraryCache(scope: string, library: PersonalLibrary) {
  let db: IDBDatabase | undefined;
  try {
    db = await database();
    await new Promise<void>((resolve, reject) => {
      const transaction = db!.transaction("accounts", "readwrite");
      const store = transaction.objectStore("accounts");
      const existing = store.get(scope);
      existing.onsuccess = () => { if (!existing.result || existing.result.revision <= library.revision) store.put(library, scope); };
      transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);
    });
  } catch { /* The cloud is authoritative. Cache failure only means a full sync next visit. */ }
  finally { db?.close(); }
}
