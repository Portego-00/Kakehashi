import * as SecureStore from "expo-secure-store";
import {
  BunproBaseStatsResponse,
  BunproDashboardPayload,
  BunproDueResponse,
  BunproForecastDailyResponse,
  BunproForecastHourlyResponse,
  BunproJlptProgressMixedResponse,
  BunproQueueResponse,
  BunproReviewableDetailsResponse,
  BunproReviewableKind,
  BunproGrammarPointAttributes,
  BunproLearnIndexResponse,
  BunproLearnReviewableTuple,
  BunproReviewOnlyFilter,
  BunproReviewQuizIndexResponse,
  BunproReviewUpdateRequest,
  BunproReviewUpdateResponse,
  BunproVocabAttributes,
  BunproReviewablesSearchRequest,
  BunproReviewablesSearchResponse,
  BunproReviewActivityResponse,
  BunproSrsOverviewResponse,
  BunproUserResponse,
} from "../types/bunpro";

const BUNPRO_FRONTEND_API_BASE_URL = "https://api.bunpro.jp/api/frontend";
const BUNPRO_API_TOKEN_STORAGE_KEY = "bunpro_frontend_api_token";
const BUNPRO_AUTH_QUERY_FLAG = "dangerously_authenticate_using_api_token";
const BUNPRO_AUTH_QUERY_FLAG_VALUE = "true";

type BunproRequestQueryValue = string | number | boolean | null | undefined;
type BunproRequestBody = unknown;

export class BunproApiError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status: number, code?: string | null) {
    super(message);
    this.name = "BunproApiError";
    this.status = status;
    this.code = code ?? null;
  }
}

function normalizeBunproApiToken(rawValue: string | null | undefined): string | null {
  if (typeof rawValue !== "string") {
    return null;
  }
  const normalizedValue = rawValue.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function buildBunproUrl(
  endpoint: string,
  query: Record<string, BunproRequestQueryValue> = {}
): string {
  const normalizedPath = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = new URL(`${BUNPRO_FRONTEND_API_BASE_URL}${normalizedPath}`);

  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }
    url.searchParams.set(key, String(value));
  });

  url.searchParams.set(BUNPRO_AUTH_QUERY_FLAG, BUNPRO_AUTH_QUERY_FLAG_VALUE);
  return url.toString();
}

export async function getStoredBunproApiToken(): Promise<string | null> {
  try {
    const storedToken = await SecureStore.getItemAsync(BUNPRO_API_TOKEN_STORAGE_KEY);
    return normalizeBunproApiToken(storedToken);
  } catch {
    return null;
  }
}

export function getBunproApiTokenFromEnv(): string | null {
  return normalizeBunproApiToken(process.env.EXPO_PUBLIC_BUNPRO_API_TOKEN);
}

export async function getActiveBunproApiToken(): Promise<string | null> {
  return getStoredBunproApiToken();
}

export async function saveBunproApiToken(apiToken: string): Promise<void> {
  const normalizedToken = normalizeBunproApiToken(apiToken);
  if (!normalizedToken) {
    throw new Error("Bunpro API token cannot be empty.");
  }

  await SecureStore.setItemAsync(BUNPRO_API_TOKEN_STORAGE_KEY, normalizedToken);
}

export async function clearBunproApiToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(BUNPRO_API_TOKEN_STORAGE_KEY);
  } catch {
    // Best effort only.
  }
}

async function parseBunproErrorPayload(
  response: Response
): Promise<{ message: string; code: string | null }> {
  try {
    const payload = (await response.json()) as Record<string, unknown>;
    const messageCandidate =
      typeof payload.message === "string"
        ? payload.message
        : typeof payload.error === "string"
          ? payload.error
          : null;
    const codeCandidate = payload.code;

    return {
      message: messageCandidate ?? `Bunpro request failed (${response.status}).`,
      code: typeof codeCandidate === "string" ? codeCandidate : null,
    };
  } catch {
    return {
      message: `Bunpro request failed (${response.status}).`,
      code: null,
    };
  }
}

async function bunproRequest<TResponse>(
  endpoint: string,
  options?: {
    apiToken?: string | null;
    query?: Record<string, BunproRequestQueryValue>;
    method?: "GET" | "POST";
    body?: BunproRequestBody;
    signal?: AbortSignal;
  }
): Promise<TResponse> {
  const apiToken =
    normalizeBunproApiToken(options?.apiToken) ?? (await getActiveBunproApiToken());

  if (!apiToken) {
    throw new BunproApiError("Bunpro API token is missing.", 403, "missing_token");
  }

  const url = buildBunproUrl(endpoint, options?.query);
  const method = options?.method ?? "GET";
  const hasBody = method !== "GET" && options?.body !== undefined;
  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiToken}`,
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
    },
    ...(hasBody ? { body: JSON.stringify(options?.body ?? null) } : {}),
    signal: options?.signal,
  });

  if (!response.ok) {
    const errorPayload = await parseBunproErrorPayload(response);
    throw new BunproApiError(errorPayload.message, response.status, errorPayload.code);
  }

  return (await response.json()) as TResponse;
}

export async function getBunproUser(options?: {
  apiToken?: string | null;
  signal?: AbortSignal;
}): Promise<BunproUserResponse> {
  return bunproRequest<BunproUserResponse>("/user", options);
}

export async function getBunproBaseStats(options?: {
  apiToken?: string | null;
  signal?: AbortSignal;
}): Promise<BunproBaseStatsResponse> {
  return bunproRequest<BunproBaseStatsResponse>("/user_stats/base_stats", options);
}

export async function getBunproJlptProgressMixed(options?: {
  apiToken?: string | null;
  signal?: AbortSignal;
}): Promise<BunproJlptProgressMixedResponse> {
  return bunproRequest<BunproJlptProgressMixedResponse>(
    "/user_stats/jlpt_progress_mixed",
    options
  );
}

export async function getBunproForecastDaily(options?: {
  apiToken?: string | null;
  signal?: AbortSignal;
}): Promise<BunproForecastDailyResponse> {
  return bunproRequest<BunproForecastDailyResponse>("/user_stats/forecast_daily", options);
}

export async function getBunproForecastHourly(options?: {
  apiToken?: string | null;
  signal?: AbortSignal;
}): Promise<BunproForecastHourlyResponse> {
  return bunproRequest<BunproForecastHourlyResponse>("/user_stats/forecast_hourly", options);
}

export async function getBunproSrsLevelOverview(options?: {
  apiToken?: string | null;
  signal?: AbortSignal;
}): Promise<BunproSrsOverviewResponse> {
  return bunproRequest<BunproSrsOverviewResponse>(
    "/user_stats/srs_level_overview",
    options
  );
}

export async function getBunproReviewActivity(options?: {
  apiToken?: string | null;
  signal?: AbortSignal;
}): Promise<BunproReviewActivityResponse> {
  return bunproRequest<BunproReviewActivityResponse>("/user_stats/review_activity", options);
}

export async function getBunproDue(options?: {
  apiToken?: string | null;
  signal?: AbortSignal;
}): Promise<BunproDueResponse> {
  return bunproRequest<BunproDueResponse>("/user/due", options);
}

export async function getBunproQueue(options?: {
  apiToken?: string | null;
  signal?: AbortSignal;
}): Promise<BunproQueueResponse> {
  return bunproRequest<BunproQueueResponse>("/user/queue", options);
}

export async function getBunproLearnIndex(options?: {
  deckId?: number | null;
  grammarPointIds?: number[];
  vocabIds?: number[];
  apiToken?: string | null;
  signal?: AbortSignal;
}): Promise<BunproLearnIndexResponse> {
  const grammarPointIds = options?.grammarPointIds?.filter(Number.isFinite) ?? [];
  const vocabIds = options?.vocabIds?.filter(Number.isFinite) ?? [];

  return bunproRequest<BunproLearnIndexResponse>("/learn", {
    apiToken: options?.apiToken,
    signal: options?.signal,
    query: {
      deck_id: options?.deckId ?? undefined,
      grammar_points:
        grammarPointIds.length > 0 ? JSON.stringify(grammarPointIds) : undefined,
      vocabs: vocabIds.length > 0 ? JSON.stringify(vocabIds) : undefined,
    },
  });
}

export async function getBunproLearnQuiz(options: {
  deckId?: number | null;
  reviewables: BunproLearnReviewableTuple[];
  isOnboarding?: boolean;
  apiToken?: string | null;
  signal?: AbortSignal;
}): Promise<BunproReviewQuizIndexResponse> {
  return bunproRequest<BunproReviewQuizIndexResponse>("/learn/quiz", {
    apiToken: options.apiToken,
    signal: options.signal,
    method: "POST",
    body: {
      deck_id: options.deckId ?? null,
      reviewables: options.reviewables,
      ...(options.isOnboarding ? { is_onboarding: true } : {}),
    },
  });
}

export async function getBunproReviewQuizIndex(options?: {
  onlyReview?: BunproReviewOnlyFilter;
  apiToken?: string | null;
  signal?: AbortSignal;
}): Promise<BunproReviewQuizIndexResponse> {
  return bunproRequest<BunproReviewQuizIndexResponse>("/reviews/quiz_index", {
    apiToken: options?.apiToken,
    signal: options?.signal,
    query:
      options?.onlyReview && options.onlyReview.length > 0
        ? {
            only_review: options.onlyReview,
          }
        : undefined,
  });
}

export async function updateBunproReview(options: {
  reviewId: string | number;
  payload: BunproReviewUpdateRequest;
  apiToken?: string | null;
  signal?: AbortSignal;
}): Promise<BunproReviewUpdateResponse> {
  const reviewId = String(options.reviewId).trim();
  if (reviewId.length === 0) {
    throw new BunproApiError("Review ID is missing.", 400, "missing_review_id");
  }

  return bunproRequest<BunproReviewUpdateResponse>(
    `/reviews/${encodePathSegment(reviewId)}/update`,
    {
      apiToken: options.apiToken,
      signal: options.signal,
      method: "POST",
      body: options.payload,
    }
  );
}

export async function searchBunproReviewables(options: {
  query: string;
  apiToken?: string | null;
  signal?: AbortSignal;
  includeReviews?: boolean;
  includeBookmarks?: boolean;
  includeNotes?: boolean;
  onlyBookmarks?: boolean;
  isSearchingGrammar?: boolean;
  isSearchingVocab?: boolean;
}): Promise<BunproReviewablesSearchResponse> {
  const trimmedQuery = options.query.trim();
  if (trimmedQuery.length === 0) {
    throw new BunproApiError("Search query cannot be empty.", 400, "empty_query");
  }

  const payload: BunproReviewablesSearchRequest = {
    query: trimmedQuery,
    options: {
      include_reviews: options.includeReviews ?? true,
      include_bookmarks: options.includeBookmarks ?? true,
      include_notes: options.includeNotes ?? true,
      only_bookmarks: options.onlyBookmarks ?? false,
    },
    is_searching_grammar: options.isSearchingGrammar ?? true,
    is_searching_vocab: options.isSearchingVocab ?? true,
  };

  return bunproRequest<BunproReviewablesSearchResponse>(
    "/search/reviewables_v1_1",
    {
      apiToken: options.apiToken,
      signal: options.signal,
      method: "POST",
      body: payload,
    }
  );
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value).replace(/%2F/gi, "/");
}

export async function getBunproReviewableDetails(options: {
  kind: BunproReviewableKind;
  slug: string;
  apiToken?: string | null;
  signal?: AbortSignal;
}): Promise<
  BunproReviewableDetailsResponse<
    BunproVocabAttributes | BunproGrammarPointAttributes
  >
> {
  const normalizedSlug = options.slug.trim();
  if (normalizedSlug.length === 0) {
    throw new BunproApiError("Reviewable slug is missing.", 400, "missing_slug");
  }

  const encodedSlug = encodePathSegment(normalizedSlug);
  const endpoints =
    options.kind === "vocab"
      ? [`/reviewables/vocab/${encodedSlug}`]
      : [
          `/reviewables/grammar_point/${encodedSlug}`,
          `/reviewables/grammar/${encodedSlug}`,
        ];

  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    try {
      return await bunproRequest<
        BunproReviewableDetailsResponse<
          BunproVocabAttributes | BunproGrammarPointAttributes
        >
      >(endpoint, {
        apiToken: options.apiToken,
        signal: options.signal,
      });
    } catch (error) {
      lastError = error;
      if (error instanceof BunproApiError && error.status === 404) {
        continue;
      }
      throw error;
    }
  }

  if (lastError instanceof BunproApiError) {
    throw lastError;
  }
  throw new BunproApiError(
    "Unable to load Bunpro reviewable details.",
    404,
    "not_found"
  );
}

export async function validateBunproApiToken(apiToken: string): Promise<boolean> {
  const normalizedToken = normalizeBunproApiToken(apiToken);
  if (!normalizedToken) {
    return false;
  }

  try {
    await getBunproUser({ apiToken: normalizedToken });
    return true;
  } catch {
    return false;
  }
}

export async function getBunproDashboard(options?: {
  apiToken?: string | null;
  signal?: AbortSignal;
}): Promise<BunproDashboardPayload> {
  const [
    user,
    baseStats,
    jlptProgressMixed,
    forecastDaily,
    forecastHourly,
    srsLevelOverview,
    reviewActivity,
    due,
    queue,
  ] =
    await Promise.all([
      getBunproUser(options),
      getBunproBaseStats(options),
      getBunproJlptProgressMixed(options),
      getBunproForecastDaily(options),
      getBunproForecastHourly(options),
      getBunproSrsLevelOverview(options),
      getBunproReviewActivity(options),
      getBunproDue(options),
      getBunproQueue(options),
    ]);

  return {
    user,
    baseStats,
    jlptProgressMixed,
    forecastDaily,
    forecastHourly,
    srsLevelOverview,
    reviewActivity,
    due,
    queue,
  };
}
