const DEFAULT_TIMEOUT_MS = 10_000;

class StudyTimeEdgeRequestError extends Error {}

export function isStudyTimeEdgeConfigured(): boolean {
  return Boolean(
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

/** Authenticated POST shared by study-time sync and history requests. */
export async function postStudyTimeEdge(
  functionName: "study-time-sync" | "study-time-history",
  waniKaniToken: string,
  body: unknown,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !anonKey) {
    throw new Error("Study time cloud sync is not configured");
  }
  if (!waniKaniToken) {
    throw new Error("Study time cloud sync requires login");
  }

  const controller = new AbortController();
  let didTimeout = false;
  const timeout = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(
      `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/${functionName}`,
      {
        method: "POST",
        headers: {
          apikey: anonKey,
          "Content-Type": "application/json",
          "x-wanikani-token": waniKaniToken,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new StudyTimeEdgeRequestError(
        `Study time cloud request failed (HTTP ${response.status})`,
      );
    }
    return response;
  } catch (error) {
    if (didTimeout) {
      throw new Error("Study time cloud request timed out");
    }
    if (error instanceof StudyTimeEdgeRequestError) {
      throw error;
    }
    // Do not pass native fetch diagnostics through: some implementations may
    // attach request metadata, including authentication headers.
    throw new Error("Study time cloud request could not be reached");
  } finally {
    clearTimeout(timeout);
  }
}
