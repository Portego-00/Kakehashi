/** Title-case Turkish meaning labels without changing stored translations. */
export function formatTurkishMeaning(value: string): string {
  return value.replace(/(^|[\s(/-])(\p{L})/gu, (_, prefix: string, letter: string) =>
    prefix + letter.toLocaleUpperCase("tr-TR"));
}

/** Preserve author casing for other languages; Turkish labels retain locale-aware initials. */
export const formatDisplayMeaning=(value:string,language:string)=>language==="tr"?formatTurkishMeaning(value):value;
