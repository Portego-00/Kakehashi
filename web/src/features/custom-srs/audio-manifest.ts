import publicationData from "./audio-publication.generated.json";
import type { PronunciationAudio } from "../../types/wanikani";

export interface CustomVocabularyAudioEntry {
  packId: string;
  reading: string;
  sha256: string;
  bytes: number;
  objectPath: string;
}

export interface CustomVocabularyAudioPublication {
  schemaVersion: 1;
  bucket: "custom-vocabulary-audio";
  voice: { name: string; gender: string; description: string; actorId: number };
  entries: Record<string, CustomVocabularyAudioEntry>;
}

const publication: CustomVocabularyAudioPublication = publicationData as CustomVocabularyAudioPublication;

/** Public origin of the verified release; no credentials or unpublished recordings are included. */
export const CUSTOM_VOCABULARY_AUDIO_PUBLIC_ORIGIN = "https://zcvoxqcvobgvcwcrqytz.supabase.co";

const SAFE_SEGMENT = /^[a-z0-9][a-z0-9-]*$/;
const SHA256 = /^[a-f0-9]{64}$/;

/** No credentials or per-play server requests: published recordings are public CDN assets. */
export function customVocabularyAudioOrigin(baseUrl: string | undefined): string | null {
  if (!baseUrl) return null;
  try {
    const url = new URL(baseUrl);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if ((url.protocol !== "https:" && !(local && url.protocol === "http:"))
      || url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function sourceId(wordId: string) {
  let hash = 2_166_136_261;
  for (const character of wordId) hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), 16_777_619);
  return 1_500_000_000 + (hash >>> 0) % 500_000_000;
}

/** Missing, unpublished, or invalid entries deliberately have no playback control. */
export function getCustomVocabularyAudio(
  wordId: string,
  baseUrl: string | undefined,
  release: CustomVocabularyAudioPublication = publication,
): PronunciationAudio[] {
  const origin = customVocabularyAudioOrigin(baseUrl);
  if (!origin || release.schemaVersion !== 1 || release.bucket !== "custom-vocabulary-audio"
    || !SAFE_SEGMENT.test(wordId) || !Object.prototype.hasOwnProperty.call(release.entries, wordId)) return [];
  const entry = release.entries[wordId];
  if (!entry || !SAFE_SEGMENT.test(entry.packId) || !SHA256.test(entry.sha256)
    || !Number.isSafeInteger(entry.bytes) || entry.bytes <= 0 || !entry.reading
    || entry.objectPath !== `v1/${entry.packId}/${wordId}/${entry.sha256}.mp3`) return [];
  return [{
    url: `${origin}/storage/v1/object/public/${release.bucket}/${entry.objectPath}`,
    content_type: "audio/mpeg",
    metadata: {
      gender: release.voice.gender,
      source_id: sourceId(wordId),
      pronunciation: entry.reading,
      voice_actor_id: release.voice.actorId,
      voice_actor_name: release.voice.name,
      voice_description: release.voice.description,
    },
  }];
}
