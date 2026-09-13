import type { WebJitaiFont, WebStudyPreferences } from "./settings";

export const BUILT_IN_JITAI_FONTS = [
  { id: "gothic", name: "Gothic", family: '"Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif' },
  { id: "mincho", name: "Mincho", family: '"Yu Mincho", "Hiragino Mincho ProN", serif' },
  { id: "rounded", name: "Rounded", family: '"Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif' },
] as const;

export const MAX_CUSTOM_FONT_BYTES = 2 * 1024 * 1024;
const DB_NAME = "kakehashi-jitai-fonts";
const STORE_NAME = "fonts";

function customFamily(id: string) {
  return `KakehashiJitai_${id.replace(/[^a-z0-9_]/gi, "_")}`;
}

function openFontDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("Custom font storage is not available in this browser.")); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Custom font storage could not be opened."));
  });
}

async function fontRecord(id: string) {
  const database = await openFontDatabase();
  return new Promise<{ id: string; dataUrl: string } | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as { id: string; dataUrl: string } | undefined);
    request.onerror = () => reject(request.error || new Error("The custom font could not be read."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => { database.close(); reject(transaction.error || new Error("The custom font could not be read.")); };
  });
}

export async function saveCustomJitaiFont(font: WebJitaiFont) {
  if (!font.dataUrl) throw new Error("The selected font file is empty.");
  const database = await openFontDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({ id: font.id, dataUrl: font.dataUrl });
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error || new Error("The custom font could not be saved.")); };
    transaction.onabort = () => { database.close(); reject(transaction.error || new Error("The custom font could not be saved.")); };
  });
}

export async function deleteCustomJitaiFont(id: string) {
  const database = await openFontDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error || new Error("The custom font could not be removed.")); };
    transaction.onabort = () => { database.close(); reject(transaction.error || new Error("The custom font could not be removed.")); };
  });
}

export async function migrateLegacyJitaiFonts(fonts: WebJitaiFont[]) {
  const legacy = fonts.filter((font) => Boolean(font.dataUrl));
  if (!legacy.length) return false;
  await Promise.all(legacy.map(saveCustomJitaiFont));
  return true;
}

export function resolveJitaiFontFamily(settings: WebStudyPreferences, seed: string | number) {
  if (!settings.jitaiEnabled) return undefined;
  const builtIn = new Map<string, string>(BUILT_IN_JITAI_FONTS.map((font) => [font.id, font.family]));
  const custom = new Map(settings.jitaiCustomFonts.map((font) => [font.id, `"${customFamily(font.id)}"` ]));
  const available = settings.jitaiSelectedFontIds.map((id) => builtIn.get(id) || custom.get(id)).filter((family): family is string => Boolean(family));
  if (!available.length) return undefined;
  const hash = [...String(seed)].reduce((value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0, 7);
  return available[hash % available.length];
}

export async function installCustomJitaiFonts(fonts: WebJitaiFont[]) {
  if (typeof document === "undefined" || typeof FontFace === "undefined") return;
  await Promise.all(fonts.map(async (font) => {
    const family = customFamily(font.id);
    if (document.fonts.check(`1rem "${family}"`)) return;
    const source = font.dataUrl || (await fontRecord(font.id))?.dataUrl;
    if (!source) throw new Error(`${font.name} is missing from custom font storage.`);
    const face = new FontFace(family, `url(${source})`);
    await face.load();
    document.fonts.add(face);
  }));
}

export function readFontFile(file: File): Promise<WebJitaiFont> {
  const extension = file.name.split(".").pop()?.toLocaleLowerCase();
  const mime = extension === "otf" ? "font/otf" : extension === "ttf" ? "font/ttf" : extension === "woff" ? "font/woff" : extension === "woff2" ? "font/woff2" : "";
  if (!mime) return Promise.reject(new Error("Choose a TTF, OTF, WOFF, or WOFF2 font file."));
  if (file.size > MAX_CUSTOM_FONT_BYTES) return Promise.reject(new Error("Choose a font smaller than 2 MB so it can stay in this browser’s settings."));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The browser could not read that font."));
    reader.onload = () => {
      const raw = typeof reader.result === "string" ? reader.result : "";
      const dataUrl = raw.replace(/^data:[^;]+;/, `data:${mime};`);
      const token = crypto.randomUUID().replace(/[^a-z0-9]/gi, "").slice(0, 16);
      resolve({ id: `custom-${token}`, name: file.name.replace(/\.(?:ttf|otf|woff2?)$/i, ""), dataUrl });
    };
    reader.readAsDataURL(file);
  });
}
