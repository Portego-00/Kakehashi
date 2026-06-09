import type { CrosswordWordInput } from "../games/crossword";
import type { Summary, WaniKaniItemType } from "../types/wanikani";

export const WANIKANI_API_BASE_URL = "https://api.wanikani.com/v2";
export const WANIKANI_API_REVISION = "20170710";
export const WANIKANI_PERSONAL_ACCESS_TOKENS_URL =
  "https://www.wanikani.com/settings/personal_access_tokens";

export type WaniKaniApiResource<TData, TObject extends string = string> = {
  id?: string | number;
  object: TObject;
  url: string;
  data_updated_at: string;
  data: TData;
};

export type WaniKaniCollectionResponse<TResource> = {
  object: "collection";
  url: string;
  pages: {
    per_page: number;
    next_url: string | null;
    previous_url: string | null;
  };
  total_count: number;
  data_updated_at: string;
  data: TResource[];
};

export type WaniKaniUser = {
  id: string;
  username: string;
  level: number;
  profile_url: string;
  started_at: string;
  current_vacation_started_at: string | null;
  subscription: {
    active: boolean;
    type: string;
    max_level_granted: number;
    period_ends_at: string | null;
  };
  preferences: {
    default_voice_actor_id: number;
    extra_study_autoplay_audio: boolean;
    lessons_autoplay_audio: boolean;
    lessons_batch_size: number;
    lessons_presentation_order: string;
    reviews_autoplay_audio: boolean;
    reviews_display_srs_indicator: boolean;
    reviews_presentation_order: string;
  };
};

export type WaniKaniUserResponse = WaniKaniApiResource<WaniKaniUser, "user">;
export type WaniKaniSummaryResponse = WaniKaniApiResource<Summary, "report">;

export type WaniKaniSubjectData = {
  level: number;
  characters: string | null;
  meanings: Array<{
    meaning: string;
    primary?: boolean;
    accepted_answer?: boolean;
  }>;
  readings?: Array<{
    reading: string;
    primary?: boolean;
    type?: string;
    accepted_answer?: boolean;
  }>;
};

export type WaniKaniSubjectResource = WaniKaniApiResource<
  WaniKaniSubjectData,
  WaniKaniItemType
> & {
  id: number;
};

export type WaniKaniAssignmentData = {
  created_at: string;
  subject_id: number;
  subject_type: WaniKaniItemType;
  srs_stage: number;
  unlocked_at: string | null;
  started_at: string | null;
  passed_at: string | null;
  burned_at: string | null;
  available_at: string | null;
  resurrected_at: string | null;
};

export type WaniKaniAssignmentResource = WaniKaniApiResource<
  WaniKaniAssignmentData,
  "assignment"
> & {
  id: number;
};

export type WaniKaniSummaryCounts = {
  lessons: number;
  reviews: number;
};

export type WaniKaniCrosswordPoolOptions = {
  minLevel?: number;
  maxLevel?: number;
  srsStages?: number[];
  hiraganaOnly?: boolean;
};

export type ValidateWaniKaniApiTokenResult =
  | {
      ok: true;
      user: WaniKaniUserResponse;
    }
  | {
      ok: false;
      status?: number;
      message: string;
    };

export type WaniKaniFetchOptions = {
  apiBaseUrl?: string;
  fetcher?: typeof fetch;
};

type WaniKaniApiErrorBody = {
  error?: string | { message?: string };
  message?: string;
};

export class WaniKaniApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "WaniKaniApiError";
    this.status = status;
    this.details = details;
  }
}

export function normalizeWaniKaniApiToken(apiToken: string): string {
  return apiToken.trim();
}

export function hasWaniKaniApiToken(apiToken?: string | null): boolean {
  return normalizeWaniKaniApiToken(apiToken ?? "").length > 0;
}

export function createWaniKaniApiHeaders(apiToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${normalizeWaniKaniApiToken(apiToken)}`,
    "Wanikani-Revision": WANIKANI_API_REVISION,
  };
}

export function getWaniKaniSummaryCounts(summary: Summary): WaniKaniSummaryCounts {
  return {
    lessons: sumSubjectIds(summary.lessons),
    reviews: sumSubjectIds(summary.reviews),
  };
}

export async function getWaniKaniUser(
  apiToken: string,
  options: WaniKaniFetchOptions = {}
): Promise<WaniKaniUserResponse> {
  return fetchWaniKaniResource<WaniKaniUserResponse>("/user", apiToken, options);
}

export async function getWaniKaniSummary(
  apiToken: string,
  options: WaniKaniFetchOptions = {}
): Promise<WaniKaniSummaryResponse> {
  return fetchWaniKaniResource<WaniKaniSummaryResponse>("/summary", apiToken, options);
}

export async function getAllWaniKaniSubjects(
  apiToken: string,
  params: Record<string, string | number | boolean | undefined> = {},
  options: WaniKaniFetchOptions = {}
): Promise<WaniKaniSubjectResource[]> {
  return fetchAllWaniKaniPages<WaniKaniSubjectResource>(
    `/subjects${toQueryString(params)}`,
    apiToken,
    options
  );
}

export async function getAllWaniKaniAssignments(
  apiToken: string,
  params: Record<string, string | number | boolean | undefined> = {},
  options: WaniKaniFetchOptions = {}
): Promise<WaniKaniAssignmentResource[]> {
  return fetchAllWaniKaniPages<WaniKaniAssignmentResource>(
    `/assignments${toQueryString(params)}`,
    apiToken,
    options
  );
}

export async function getWaniKaniCrosswordWordInputs(
  apiToken: string,
  poolOptions: WaniKaniCrosswordPoolOptions = {},
  options: WaniKaniFetchOptions = {}
): Promise<CrosswordWordInput[]> {
  const subjectParams = {
    types: "vocabulary,kana_vocabulary",
    levels:
      poolOptions.minLevel && poolOptions.maxLevel
        ? buildNumberRange(poolOptions.minLevel, poolOptions.maxLevel)
        : undefined,
  };
  const assignmentParams = {
    subject_types: "vocabulary,kana_vocabulary",
    srs_stages: poolOptions.srsStages?.join(","),
    started: true,
  };

  const [subjects, assignments] = await Promise.all([
    getAllWaniKaniSubjects(apiToken, subjectParams, options),
    getAllWaniKaniAssignments(apiToken, assignmentParams, options),
  ]);

  const allowedSubjectIds = new Set(assignments.map((assignment) => assignment.data.subject_id));
  return buildCrosswordWordInputsFromSubjects(
    subjects.filter((subject) => allowedSubjectIds.has(subject.id)),
    poolOptions
  );
}

export function buildCrosswordWordInputsFromSubjects(
  subjects: WaniKaniSubjectResource[],
  options: Pick<WaniKaniCrosswordPoolOptions, "hiraganaOnly"> = {}
): CrosswordWordInput[] {
  const out: CrosswordWordInput[] = [];

  for (const subject of subjects) {
    if (subject.object !== "vocabulary" && subject.object !== "kana_vocabulary") {
      continue;
    }

    const hiragana = getPrimarySubjectReading(subject);
    if (!hiragana || !HIRAGANA_REGEX.test(hiragana)) {
      continue;
    }

    if (options.hiraganaOnly) {
      const characters = subject.data.characters ?? "";
      if (
        characters &&
        characters !== hiragana &&
        (KATAKANA_REGEX.test(characters) || KANJI_REGEX.test(characters))
      ) {
        continue;
      }
    }

    const meaning = getPrimarySubjectMeaning(subject);
    if (!meaning) {
      continue;
    }

    out.push({
      subjectId: subject.id,
      hiragana,
      meaning,
      level: subject.data.level,
    });
  }

  return out;
}

export async function validateWaniKaniApiToken(
  apiToken: string,
  options: WaniKaniFetchOptions = {}
): Promise<ValidateWaniKaniApiTokenResult> {
  if (!hasWaniKaniApiToken(apiToken)) {
    return {
      ok: false,
      message: "Enter a WaniKani personal access token.",
    };
  }

  try {
    const user = await getWaniKaniUser(apiToken, options);
    return { ok: true, user };
  } catch (error) {
    if (error instanceof WaniKaniApiError) {
      return {
        ok: false,
        status: error.status,
        message: getFriendlyWaniKaniErrorMessage(error),
      };
    }

    return {
      ok: false,
      message: "Could not reach WaniKani. Check your connection and try again.",
    };
  }
}

async function fetchWaniKaniResource<TResponse>(
  path: string,
  apiToken: string,
  options: WaniKaniFetchOptions
): Promise<TResponse> {
  const token = normalizeWaniKaniApiToken(apiToken);
  if (!token) {
    throw new WaniKaniApiError(401, "Missing WaniKani API token.");
  }

  const apiBaseUrl = options.apiBaseUrl ?? WANIKANI_API_BASE_URL;
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(buildWaniKaniUrl(apiBaseUrl, path), {
    method: "GET",
    headers: createWaniKaniApiHeaders(token),
  });

  if (!response.ok) {
    const { body, message } = await parseWaniKaniErrorResponse(response);
    throw new WaniKaniApiError(response.status, message, body);
  }

  return response.json() as Promise<TResponse>;
}

async function fetchAllWaniKaniPages<TResource>(
  path: string,
  apiToken: string,
  options: WaniKaniFetchOptions
): Promise<TResource[]> {
  const resources: TResource[] = [];
  let nextPath: string | null = path;

  while (nextPath) {
    const response: WaniKaniCollectionResponse<TResource> = await fetchWaniKaniResource(
      nextPath,
      apiToken,
      options
    );
    resources.push(...response.data);
    nextPath = response.pages.next_url;
  }

  return resources;
}

async function parseWaniKaniErrorResponse(response: Response): Promise<{
  body: unknown;
  message: string;
}> {
  const text = await response.text().catch(() => "");
  let body: unknown = text;

  try {
    body = text ? (JSON.parse(text) as WaniKaniApiErrorBody) : null;
  } catch {
    body = text;
  }

  const error = typeof body === "object" && body !== null ? (body as WaniKaniApiErrorBody).error : null;
  const message =
    typeof error === "string"
      ? error
      : typeof error?.message === "string"
        ? error.message
        : typeof (body as WaniKaniApiErrorBody | null)?.message === "string"
          ? (body as WaniKaniApiErrorBody).message!
          : text || `WaniKani returned HTTP ${response.status}.`;

  return { body, message };
}

function getFriendlyWaniKaniErrorMessage(error: WaniKaniApiError): string {
  if (error.status === 401) {
    return "That WaniKani token was not accepted. Check that it was copied completely.";
  }

  if (error.status === 403) {
    return "That token does not have permission to read your WaniKani account.";
  }

  if (error.status === 429) {
    return "WaniKani rate limited the request. Wait a moment and try again.";
  }

  return error.message || `WaniKani returned HTTP ${error.status}.`;
}

function sumSubjectIds(groups: Array<{ subject_ids: number[] }>): number {
  return groups.reduce((total, group) => total + group.subject_ids.length, 0);
}

function buildWaniKaniUrl(apiBaseUrl: string, pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }

  return `${apiBaseUrl}${pathOrUrl}`;
}

function toQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildNumberRange(min: number, max: number): string {
  const start = Math.max(1, Math.floor(Math.min(min, max)));
  const end = Math.max(start, Math.floor(Math.max(min, max)));
  const values: number[] = [];

  for (let value = start; value <= end; value += 1) {
    values.push(value);
  }

  return values.join(",");
}

function getPrimarySubjectReading(subject: WaniKaniSubjectResource): string | null {
  if (
    subject.object === "kana_vocabulary" &&
    typeof subject.data.characters === "string" &&
    subject.data.characters.length > 0
  ) {
    return normalizeKatakanaToHiragana(subject.data.characters);
  }

  const primary = subject.data.readings?.find((reading) => reading.primary);
  const fallback = subject.data.readings?.[0];
  const reading = primary?.reading ?? fallback?.reading;

  return reading ? normalizeKatakanaToHiragana(reading) : null;
}

function getPrimarySubjectMeaning(subject: WaniKaniSubjectResource): string | null {
  const primary = subject.data.meanings.find((meaning) => meaning.primary);
  const fallback = subject.data.meanings[0];
  return primary?.meaning ?? fallback?.meaning ?? null;
}

function normalizeKatakanaToHiragana(input: string): string {
  let out = "";

  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x30a1 && code <= 0x30f6) {
      out += String.fromCodePoint(code - 0x60);
    } else {
      out += ch;
    }
  }

  return out;
}

const HIRAGANA_REGEX = /^[\u3040-\u309fー]+$/;
const KATAKANA_REGEX = /[\u30a1-\u30f6ー]/;
const KANJI_REGEX = /[\u4e00-\u9fff]/;
