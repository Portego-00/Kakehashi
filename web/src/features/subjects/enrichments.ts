export type PitchAccentEntry = { r: string; p: number[] };
export type UsagePattern = { name: string; examples: Array<{ ja: string; en: string }> };
export type SubjectEnrichments = { pitchAccents: PitchAccentEntry[]; patterns: UsagePattern[] };

export async function fetchSubjectEnrichments(input: { id: number; level: number; characters: string; readings: string[] }, signal?: AbortSignal): Promise<SubjectEnrichments> {
  const response = await fetch("/api/subjects/enrichments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok) throw new Error(`Subject enrichments failed with ${response.status}.`);
  return response.json() as Promise<SubjectEnrichments>;
}

const SMALL_KANA = new Set(["ゃ", "ゅ", "ょ", "ぁ", "ぃ", "ぅ", "ぇ", "ぉ", "ゎ", "ゕ", "ゖ", "ャ", "ュ", "ョ", "ァ", "ィ", "ゥ", "ェ", "ォ", "ヮ", "ヵ", "ヶ"]);

export function splitReadingIntoMoras(reading: string) {
  const moras: string[] = [];
  for (const character of Array.from(reading.trim())) {
    if (SMALL_KANA.has(character) && moras.length) moras[moras.length - 1] += character;
    else moras.push(character);
  }
  return moras;
}

export function pitchAccentLabel(accent: number, moraCount: number) {
  if (accent === 0) return "Heiban";
  if (accent === 1) return "Atamadaka";
  if (accent >= moraCount) return "Odaka";
  return "Nakadaka";
}
