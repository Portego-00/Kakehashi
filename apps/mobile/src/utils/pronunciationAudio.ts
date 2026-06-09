export interface SubjectReading {
  reading: string;
  primary?: boolean;
  accepted_answer?: boolean;
}

export interface PronunciationAudio {
  url: string;
  content_type: string;
  metadata?: {
    gender?: string;
    source_id?: number;
    pronunciation?: string;
    pronounciation?: string;
    voice_actor_id?: number;
    voice_actor_name?: string;
    voice_description?: string;
  } | null;
}

interface PronunciationAudioFilterOptions {
  preferredContentType?: string;
}

export type PronunciationAudioVoicePreference =
  | "female"
  | "male"
  | "random"
  | "both";

const KATAKANA_START = 0x30a1;
const KATAKANA_END = 0x30f6;
const KATAKANA_TO_HIRAGANA_OFFSET = 0x60;

function normalizeKana(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, "");
  let result = "";

  for (const char of normalized) {
    const charCode = char.charCodeAt(0);
    if (charCode >= KATAKANA_START && charCode <= KATAKANA_END) {
      result += String.fromCharCode(charCode - KATAKANA_TO_HIRAGANA_OFFSET);
    } else {
      result += char;
    }
  }

  return result;
}

function getAudioPronunciation(audio: PronunciationAudio): string {
  return normalizeKana(
    audio.metadata?.pronunciation ?? audio.metadata?.pronounciation
  );
}

function getPrimaryAndAcceptedReadings(
  readings: SubjectReading[] | null | undefined
): SubjectReading[] {
  if (!Array.isArray(readings) || readings.length === 0) {
    return [];
  }

  const validReadings = readings.filter(
    (reading) => normalizeKana(reading.reading).length > 0
  );
  if (validReadings.length === 0) {
    return [];
  }

  const acceptedReadings = validReadings.filter(
    (reading) => reading.accepted_answer !== false
  );
  const readingsToRank =
    acceptedReadings.length > 0 ? acceptedReadings : validReadings;

  return [...readingsToRank].sort((left, right) => {
    const leftPrimary = left.primary ? 1 : 0;
    const rightPrimary = right.primary ? 1 : 0;
    return rightPrimary - leftPrimary;
  });
}

function buildReadingRankMap(
  readings: SubjectReading[] | null | undefined
): Map<string, number> {
  const ranking = new Map<string, number>();
  const rankedReadings = getPrimaryAndAcceptedReadings(readings);

  rankedReadings.forEach((reading, index) => {
    const normalized = normalizeKana(reading.reading);
    if (normalized && !ranking.has(normalized)) {
      ranking.set(normalized, index);
    }
  });

  return ranking;
}

function rankAudioByReading(
  audios: PronunciationAudio[],
  readingRankMap: Map<string, number>
): PronunciationAudio[] {
  return audios
    .map((audio, index) => {
      const pronunciation = getAudioPronunciation(audio);
      const rank =
        pronunciation && readingRankMap.has(pronunciation)
          ? readingRankMap.get(pronunciation) ?? Number.MAX_SAFE_INTEGER
          : Number.MAX_SAFE_INTEGER;

      return { audio, index, rank };
    })
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map((entry) => entry.audio);
}

function resolveBaseAudioCandidates(
  pronunciationAudios: PronunciationAudio[] | null | undefined,
  preferredContentType: string
): PronunciationAudio[] {
  if (!Array.isArray(pronunciationAudios) || pronunciationAudios.length === 0) {
    return [];
  }

  const preferredTypeAudios = pronunciationAudios.filter(
    (audio) => audio.content_type === preferredContentType
  );
  if (preferredTypeAudios.length > 0) {
    return preferredTypeAudios;
  }

  return pronunciationAudios;
}

function matchesPreferredVoice(
  audio: PronunciationAudio,
  preferredVoice: "female" | "male"
): boolean {
  const normalizedGender = audio.metadata?.gender?.trim().toLowerCase();
  if (normalizedGender) {
    return normalizedGender === preferredVoice;
  }

  const normalizedActorName = audio.metadata?.voice_actor_name
    ?.trim()
    .toLowerCase();
  if (!normalizedActorName) {
    return false;
  }

  if (preferredVoice === "female") {
    return normalizedActorName === "kyoko";
  }
  return normalizedActorName === "kenichi";
}

function getGenderSortRank(audio: PronunciationAudio): number {
  if (matchesPreferredVoice(audio, "male")) {
    return 0;
  }

  if (matchesPreferredVoice(audio, "female")) {
    return 1;
  }

  return 2;
}

function getVoiceActorKey(audio: PronunciationAudio, index: number): string {
  const voiceActorId = audio.metadata?.voice_actor_id;
  if (typeof voiceActorId === "number") {
    return `id:${voiceActorId}`;
  }

  const voiceActorName = audio.metadata?.voice_actor_name?.trim().toLowerCase();
  if (voiceActorName) {
    return `name:${voiceActorName}`;
  }

  const gender = audio.metadata?.gender?.trim().toLowerCase();
  if (gender) {
    return `gender:${gender}`;
  }

  return `index:${index}`;
}

function getRandomAudio(
  audios: PronunciationAudio[]
): PronunciationAudio | null {
  if (audios.length === 0) {
    return null;
  }
  if (audios.length === 1) {
    return audios[0];
  }

  const index = Math.floor(Math.random() * audios.length);
  return audios[index] ?? audios[0];
}

function dedupeByUrl(audios: PronunciationAudio[]): PronunciationAudio[] {
  const seen = new Set<string>();
  const deduped: PronunciationAudio[] = [];

  for (const audio of audios) {
    if (seen.has(audio.url)) {
      continue;
    }
    seen.add(audio.url);
    deduped.push(audio);
  }

  return deduped;
}

export function sortPronunciationAudiosByReadingAndGender(
  pronunciationAudios: PronunciationAudio[] | null | undefined,
  readings: SubjectReading[] | null | undefined
): PronunciationAudio[] {
  if (!Array.isArray(pronunciationAudios) || pronunciationAudios.length === 0) {
    return [];
  }

  if (pronunciationAudios.length === 1) {
    return [pronunciationAudios[0]];
  }

  const readingRankMap = buildReadingRankMap(readings);
  const unknownPronunciationOrder = new Map<string, number>();

  pronunciationAudios.forEach((audio) => {
    const pronunciation = getAudioPronunciation(audio);
    if (
      pronunciation.length > 0 &&
      !readingRankMap.has(pronunciation) &&
      !unknownPronunciationOrder.has(pronunciation)
    ) {
      unknownPronunciationOrder.set(
        pronunciation,
        unknownPronunciationOrder.size
      );
    }
  });

  const unknownPronunciationBase = readingRankMap.size;
  const noPronunciationBase =
    unknownPronunciationBase + unknownPronunciationOrder.size;

  return pronunciationAudios
    .map((audio, index) => {
      const pronunciation = getAudioPronunciation(audio);
      let readingRank = noPronunciationBase + index;

      if (pronunciation.length > 0) {
        if (readingRankMap.has(pronunciation)) {
          readingRank = readingRankMap.get(pronunciation) ?? readingRank;
        } else {
          readingRank =
            unknownPronunciationBase +
            (unknownPronunciationOrder.get(pronunciation) ?? 0);
        }
      }

      return {
        audio,
        index,
        readingRank,
        genderRank: getGenderSortRank(audio),
      };
    })
    .sort(
      (left, right) =>
        left.readingRank - right.readingRank ||
        left.genderRank - right.genderRank ||
        left.index - right.index
    )
    .map((entry) => entry.audio);
}

export function getFilteredPronunciationAudios(
  pronunciationAudios: PronunciationAudio[] | null | undefined,
  readings: SubjectReading[] | null | undefined,
  options: PronunciationAudioFilterOptions = {}
): PronunciationAudio[] {
  const preferredContentType = options.preferredContentType ?? "audio/mpeg";
  const baseCandidates = resolveBaseAudioCandidates(
    pronunciationAudios,
    preferredContentType
  );
  if (baseCandidates.length === 0) {
    return [];
  }

  const readingRankMap = buildReadingRankMap(readings);
  if (readingRankMap.size === 0) {
    return baseCandidates;
  }

  const readingMatchedAudios = baseCandidates.filter((audio) => {
    const pronunciation = getAudioPronunciation(audio);
    return pronunciation.length > 0 && readingRankMap.has(pronunciation);
  });

  const candidates =
    readingMatchedAudios.length > 0 ? readingMatchedAudios : baseCandidates;

  return rankAudioByReading(candidates, readingRankMap);
}

export function getUniquePronunciationAudiosByVoiceActor(
  pronunciationAudios: PronunciationAudio[] | null | undefined,
  readings: SubjectReading[] | null | undefined,
  options: PronunciationAudioFilterOptions = {}
): PronunciationAudio[] {
  const filteredAudios = getFilteredPronunciationAudios(
    pronunciationAudios,
    readings,
    options
  );
  if (filteredAudios.length <= 1) {
    return filteredAudios;
  }

  const uniqueByActor: PronunciationAudio[] = [];
  const seenActorKeys = new Set<string>();

  filteredAudios.forEach((audio, index) => {
    const actorKey = getVoiceActorKey(audio, index);
    if (seenActorKeys.has(actorKey)) {
      return;
    }
    seenActorKeys.add(actorKey);
    uniqueByActor.push(audio);
  });

  return uniqueByActor;
}

export function pickPreferredPronunciationAudio(
  pronunciationAudios: PronunciationAudio[] | null | undefined,
  readings: SubjectReading[] | null | undefined,
  preferredVoice: PronunciationAudioVoicePreference,
  options: PronunciationAudioFilterOptions = {}
): PronunciationAudio | null {
  const audios = pickPreferredPronunciationAudios(
    pronunciationAudios,
    readings,
    preferredVoice,
    options
  );
  if (audios.length === 0) {
    return null;
  }

  return audios[0];
}

export function pickPreferredPronunciationAudios(
  pronunciationAudios: PronunciationAudio[] | null | undefined,
  readings: SubjectReading[] | null | undefined,
  preferredVoice: PronunciationAudioVoicePreference,
  options: PronunciationAudioFilterOptions = {}
): PronunciationAudio[] {
  const filteredAudios = getFilteredPronunciationAudios(
    pronunciationAudios,
    readings,
    options
  );
  if (filteredAudios.length === 0) {
    return [];
  }

  if (preferredVoice === "random") {
    const uniqueByActor = getUniquePronunciationAudiosByVoiceActor(
      filteredAudios,
      readings,
      options
    );
    const randomAudio = getRandomAudio(
      uniqueByActor.length > 0 ? uniqueByActor : filteredAudios
    );
    return randomAudio ? [randomAudio] : [];
  }

  if (preferredVoice === "both") {
    const femaleAudio = filteredAudios.find((audio) =>
      matchesPreferredVoice(audio, "female")
    );
    const maleAudio = filteredAudios.find((audio) =>
      matchesPreferredVoice(audio, "male")
    );

    const preferredPair = dedupeByUrl(
      [femaleAudio, maleAudio].filter(
        (audio): audio is PronunciationAudio => audio != null
      )
    );
    if (preferredPair.length > 0) {
      return preferredPair;
    }

    const uniqueByActor = getUniquePronunciationAudiosByVoiceActor(
      filteredAudios,
      readings,
      options
    );
    return dedupeByUrl(
      (uniqueByActor.length > 0 ? uniqueByActor : filteredAudios).slice(0, 2)
    );
  }

  const preferredVoiceAudio = filteredAudios.find((audio) =>
    matchesPreferredVoice(audio, preferredVoice)
  );
  if (preferredVoiceAudio) {
    return [preferredVoiceAudio];
  }

  return [filteredAudios[0]];
}
