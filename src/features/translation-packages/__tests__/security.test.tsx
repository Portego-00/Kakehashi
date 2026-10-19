import React from "react";
import {render} from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import {File} from "expo-file-system";
import sample from "../../../../translation-packages/example-tr-v3.json";
import {PACKAGE_LIMITS, parsePackageText, parseTranslationPackage} from "../resolver";
import {selectTranslationPackage} from "../import-file";
import {createPackageManager, PACKAGE_STORAGE_KEY} from "../package-store";
import {MeaningRows} from "../MeaningRows";
import {SentenceExplanation} from "../SentenceExplanation";

jest.mock("expo-file-system", () => ({File: {pickFileAsync: jest.fn()}}));
jest.mock("../../../utils/theme", () => ({useTheme: () => ({theme: {textColor: "#111", textSecondary: "#555", primary: "#08f"}})}));
const packet = () => JSON.parse(JSON.stringify(sample));
const script = '<script>globalThis.__translationExecuted = true</script>';
const url = 'https://attacker.invalid/collect?token=${apiToken}';

beforeEach(() => {jest.clearAllMocks();});
it("treats script and HTML strings as literal text without following package URLs or reading credentials", async () => {
 const data = packet();
 data.language = "fr"; data.name = script; data.$schema = url;
 data.subjects["440"].meaning.primary = script;
 const raw = JSON.stringify(data);
 jest.mocked(File.pickFileAsync).mockResolvedValueOnce({size: raw.length, text: async () => raw} as any);
 const imported = (await selectTranslationPackage())!;
 const s = render(<><MeaningRows language="fr" primary={imported.subjects["440"].meaning.primary} alternatives={[]} english="English" englishAlternatives={[]} />
   <SentenceExplanation english="English" usage={url}/></>);
 expect(s.getByText(script)).toBeTruthy();
 expect(s.getByText(url)).toBeTruthy();
 expect((globalThis as any).__translationExecuted).toBeUndefined();
 expect(fetch).not.toHaveBeenCalled();
 expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
});
it("uses app-generated package storage keys and never reads or overwrites unrelated secrets", async () => {
 const secretKey = "wanikani_api_token", secret = "fixture-secret-not-in-package";
 const values = new Map<string,string>([[secretKey, secret]]);
 const storage = {
  getItem: jest.fn(async (key:string) => values.get(key) ?? null),
  setItem: jest.fn(async (key:string,value:string) => {values.set(key,value);}),
  removeItem: jest.fn(async (key:string) => {values.delete(key);}),
  multiGet: jest.fn(async (keys:string[]) => keys.map(key => [key,values.get(key) ?? null] as [string,string|null])),
  multiSet: jest.fn(async (entries:[string,string][]) => {entries.forEach(([key,value]) => values.set(key,value));}),
  multiRemove: jest.fn(async (keys:string[]) => {keys.forEach(key => values.delete(key));}),
 };
 const data = packet(); data.packageId = secretKey; data.$schema = url;
 const manager = createPackageManager(storage as any);
 await manager.activate(parsePackageText(JSON.stringify(data)));
 expect(storage.getItem.mock.calls.every(([key]) => key === PACKAGE_STORAGE_KEY)).toBe(true);
 expect(values.get(secretKey)).toBe(secret);
 for (const [key,value] of values) if (key !== secretKey) expect(value).not.toContain(secret);
 expect([...values.keys()].filter(key => key !== secretKey && key !== PACKAGE_STORAGE_KEY).every(key => key.startsWith("kakehashi-learning-chunks-"))).toBe(true);
 expect(fetch).not.toHaveBeenCalled();
});
it.each(["__proto__", "constructor", "prototype"])("rejects the hostile subject key %s without modifying prototypes", key => {
 const data = packet();
 Object.defineProperty(data.subjects, key, {value: {polluted: true}, enumerable: true});
 expect(() => parsePackageText(JSON.stringify(data))).toThrow("Unsupported");
 expect(({} as any).polluted).toBeUndefined();
});
it("rejects unknown executable instructions instead of interpreting them", () => {
 expect(parseTranslationPackage({...packet(), onImport: script, downloadUrl: url})).toBeNull();
});
it("rejects the reproduced half-million-alternatives payload below the file-size limit", () => {
 const data = packet(); data.subjects["440"].meaning.alternatives = Array(500000).fill("x");
 const raw = JSON.stringify(data);
 expect(raw.length).toBeLessThan(20 * 1024 * 1024);
 expect(() => parsePackageText(raw)).toThrow("Unsupported");
});
it.each(["primary", "alternatives", "meaningsEn", "readingsJa", "synonymAnswers", "translation", "usage", "examples"])("bounds untrusted %s before content can reach the UI", field => {
 const data = packet(), entry = data.subjects["2761"];
 switch (field) {
  case "primary": entry.meaning.primary = "x".repeat(PACKAGE_LIMITS.meaning + 1); break;
  case "alternatives": entry.meaning.alternatives = Array(PACKAGE_LIMITS.alternatives + 1).fill("x"); break;
  case "meaningsEn": entry.source.meaningsEn = Array(PACKAGE_LIMITS.meanings + 1).fill("x"); break;
  case "readingsJa": entry.source.readingsJa = Array(PACKAGE_LIMITS.readings + 1).fill("x"); break;
  case "synonymAnswers": entry.synonymAnswers.values = Array(PACKAGE_LIMITS.synonyms + 1).fill("x"); break;
  case "translation": entry.examples[0].translation = "x".repeat(PACKAGE_LIMITS.sentence + 1); break;
  case "usage": entry.examples[0].usage = "x".repeat(PACKAGE_LIMITS.usage + 1); break;
  case "examples": entry.examples = Array(PACKAGE_LIMITS.examplesPerSubject + 1).fill(null); break;
 }
 expect(parseTranslationPackage(data)).toBeNull();
});
it("rejects an invalid subject before inspecting later catalog entries", () => {
 const data = packet();
 const subjects = {"1": null, "2": null};
 Object.defineProperty(subjects, "2", {enumerable:true,get:()=>{throw new Error("Later entries must not be validated");}});
 expect(parseTranslationPackage({...data,subjects})).toBeNull();
});
it("caps subject counts before validating their contents", () => {
 const subjects = Object.fromEntries(Array.from({length:PACKAGE_LIMITS.subjects + 1},(_,i)=>[String(i+1), null]));
 expect(parseTranslationPackage({...packet(),subjects})).toBeNull();
});
