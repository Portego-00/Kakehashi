import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { useEffect } from "react";
import { parsePackageText, type TranslationPackage } from "./resolver";

export const PACKAGE_STORAGE_KEY = "kakehashi-learning-package-v2";
interface PackageState {
  packet: TranslationPackage | null;
  hydrated: boolean;
  error: string | null;
}
export function createPackageManager(storage = AsyncStorage) {
  const state = create<PackageState>(() => ({packet: null, hydrated: false, error: null}));
  let hydration: Promise<void> | undefined;
  type Pointer = {id: string; count: number};
  const readPointer = (text: string): Pointer => {
    const pointer = JSON.parse(text);
    if (!/^kakehashi-learning-chunks-[a-z0-9-]+$/.test(pointer?.id) ||
      !Number.isInteger(pointer?.count) || pointer.count < 1 || pointer.count > 150)
      throw new Error("Invalid saved package index");
    return pointer;
  };
  const cleanup = async (pointer: Pointer | null) => {
    if (pointer) await storage.multiRemove(Array.from({length: pointer.count}, (_, i) => `${pointer.id}-${i}`));
  };
  let writes = Promise.resolve();
  const hydrate = () => hydration ??= (async () => {
    try {
      const saved = await storage.getItem(PACKAGE_STORAGE_KEY);
      let packet: TranslationPackage | null = null;
      if (saved) {
        const pointer = readPointer(saved);
        const chunks = await storage.multiGet(Array.from({length: pointer.count}, (_, i) => `${pointer.id}-${i}`));
        if (chunks.some(([, value]) => value === null)) throw new Error("Missing saved package chunk");
        packet = parsePackageText(chunks.map(([, value]) => value).join(""));
      }
      state.setState({packet, error: null});
    } catch {
      state.setState({packet: null, error: "Could not read the saved package. Original English is being used."});
    } finally { state.setState({hydrated: true}); }
  })();
  const enqueue = (operation: () => Promise<void>) => {
    const next = writes.then(operation);
    writes = next.catch(() => {});
    return next;
  };
  const activate = (packet: TranslationPackage) => enqueue(async () => {
    const text = JSON.stringify(packet);
    const validated = parsePackageText(text);
    await hydrate();
    const previousText = await storage.getItem(PACKAGE_STORAGE_KEY);
    let previous: Pointer | null = null;
    try { if (previousText) previous = readPointer(previousText); } catch {}
    const pointer = {id: `kakehashi-learning-chunks-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, count: Math.ceil(text.length / 200000)};
    try {
      const chunks: [string, string][] = Array.from({length: pointer.count}, (_, i) =>
        [`${pointer.id}-${i}`, text.slice(i * 200000, (i + 1) * 200000)]);
      await storage.multiSet(chunks);
      // Publish only after every chunk is durable; the old pointer survives failed writes.
      await storage.setItem(PACKAGE_STORAGE_KEY, JSON.stringify(pointer));
    } catch (error) {
      await cleanup(pointer).catch(() => {});
      throw error;
    }
    await cleanup(previous).catch(() => {});
    state.setState({packet: validated, error: null});
  });
  const reset = () => enqueue(async () => {
    await hydrate();
    const previousText = await storage.getItem(PACKAGE_STORAGE_KEY);
    await storage.removeItem(PACKAGE_STORAGE_KEY);
    try { if (previousText) await cleanup(readPointer(previousText)); } catch {}
    state.setState({packet: null, error: null});
  });
  return {state, hydrate, activate, reset};
}
export const packageManager = createPackageManager();
export function useActiveContent() {
  const packet = packageManager.state(s => s.packet);
  useEffect(() => { void packageManager.hydrate(); }, []);
  return packet;
}
