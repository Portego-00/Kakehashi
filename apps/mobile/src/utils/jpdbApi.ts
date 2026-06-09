import * as SecureStore from "expo-secure-store";

const JPDB_API_KEY_STORAGE_KEY = "jpdb_api_key";
const JPDB_PARSE_ENDPOINT = "https://jpdb.io/api/v1/parse";
const JPDB_JA2EN_ENDPOINT = "https://jpdb.io/api/v1/ja2en";
const JPDB_PARSE_TOKEN_FIELDS = ["vocabulary_index", "position", "length"] as const;
const JPDB_PARSE_VOCABULARY_FIELDS = [
  "spelling",
  "reading",
  "part_of_speech",
  "meanings_chunks",
] as const;

type JpdbErrorResponse = {
  error?: string;
};

type JpdbJa2EnResponse = {
  text?: string;
  is_truncated?: boolean;
};

type JpdbJa2EnRequestBody = {
  text: string;
  context?: [string, string];
};

export class JpdbApiError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status: number, code?: string | null) {
    super(message);
    this.name = "JpdbApiError";
    this.status = status;
    this.code = code ?? null;
  }
}

function normalizeJpdbApiKey(rawValue: string | null | undefined): string | null {
  if (typeof rawValue !== "string") {
    return null;
  }
  const normalizedValue = rawValue.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

export function getJpdbApiKeyFromEnv(): string | null {
  return normalizeJpdbApiKey(process.env.EXPO_PUBLIC_JPDB_API_KEY);
}

export async function getStoredJpdbApiKey(): Promise<string | null> {
  try {
    const storedKey = await SecureStore.getItemAsync(JPDB_API_KEY_STORAGE_KEY);
    return normalizeJpdbApiKey(storedKey);
  } catch {
    return null;
  }
}

export async function getActiveJpdbApiKey(): Promise<string | null> {
  const storedKey = await getStoredJpdbApiKey();
  if (storedKey) {
    return storedKey;
  }

  // Runtime should use the explicitly saved Settings key only.
  // Keep env fallback in tests so unit tests can inject synthetic keys.
  if (process.env.NODE_ENV === "test") {
    return getJpdbApiKeyFromEnv();
  }

  return null;
}

export async function saveJpdbApiKey(apiKey: string): Promise<void> {
  const normalizedApiKey = normalizeJpdbApiKey(apiKey);
  if (!normalizedApiKey) {
    throw new Error("JPDB API key cannot be empty.");
  }

  await SecureStore.setItemAsync(JPDB_API_KEY_STORAGE_KEY, normalizedApiKey);
}

export async function clearJpdbApiKey(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(JPDB_API_KEY_STORAGE_KEY);
  } catch {
    // Best effort only.
  }
}

export async function validateJpdbApiKey(apiKey: string): Promise<boolean> {
  const normalizedApiKey = normalizeJpdbApiKey(apiKey);
  if (!normalizedApiKey) {
    return false;
  }

  try {
    const response = await fetch(JPDB_PARSE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${normalizedApiKey}`,
      },
      body: JSON.stringify({
        text: ["テスト"],
        position_length_encoding: "utf16",
        token_fields: JPDB_PARSE_TOKEN_FIELDS,
        vocabulary_fields: JPDB_PARSE_VOCABULARY_FIELDS,
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function getJpdbErrorResponse(response: Response): Promise<JpdbErrorResponse> {
  try {
    const payload = (await response.json()) as JpdbErrorResponse;
    return payload && typeof payload === "object" ? payload : {};
  } catch {
    return {};
  }
}

export async function translateJapaneseToEnglish(
  text: string,
  options?: {
    apiKey?: string | null;
    context?: [string, string] | null;
    signal?: AbortSignal;
  }
): Promise<{ text: string; isTruncated: boolean }> {
  const normalizedText = text.trim();
  if (!normalizedText) {
    return { text: "", isTruncated: false };
  }

  const normalizedApiKey =
    normalizeJpdbApiKey(options?.apiKey) ?? (await getActiveJpdbApiKey());

  if (!normalizedApiKey) {
    throw new JpdbApiError("JPDB API key is missing.", 403, "bad_key");
  }

  const requestBody: JpdbJa2EnRequestBody = {
    text: normalizedText,
  };

  const context = options?.context;
  if (
    context &&
    context.length === 2 &&
    context[0].trim().length > 0 &&
    context[1].trim().length > 0
  ) {
    requestBody.context = [context[0].trim(), context[1].trim()];
  }

  const response = await fetch(JPDB_JA2EN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${normalizedApiKey}`,
    },
    body: JSON.stringify(requestBody),
    signal: options?.signal,
  });

  if (!response.ok) {
    const errorPayload = await getJpdbErrorResponse(response);
    const errorCode =
      typeof errorPayload.error === "string" ? errorPayload.error : null;
    throw new JpdbApiError(
      errorCode
        ? `JPDB translation failed: ${errorCode}`
        : "JPDB translation request failed.",
      response.status,
      errorCode
    );
  }

  const payload = (await response.json()) as JpdbJa2EnResponse;
  if (!payload || typeof payload.text !== "string") {
    throw new JpdbApiError(
      "JPDB translation returned an invalid response.",
      response.status,
      "bad_response"
    );
  }

  return {
    text: payload.text,
    isTruncated: Boolean(payload.is_truncated),
  };
}
