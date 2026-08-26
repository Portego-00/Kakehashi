import fetchMock from "jest-fetch-mock";
import { postStudyTimeEdge } from "../studyTimeEdgeClient";

describe("study time Edge client", () => {
  const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    fetchMock.resetMocks();
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://project.supabase.co/";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "publishable-anon-key";
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
  });

  it("posts the device-scoped request with WaniKani authentication", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ days: [] }), { status: 200 });

    await postStudyTimeEdge(
      "study-time-history",
      "secret-wanikani-token",
      { deviceId: "device-a" },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://project.supabase.co/functions/v1/study-time-history",
    );
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      apikey: "publishable-anon-key",
      "Content-Type": "application/json",
      "x-wanikani-token": "secret-wanikani-token",
    });
    expect(init?.headers).not.toHaveProperty("Authorization");
    expect(JSON.parse(String(init?.body))).toEqual({ deviceId: "device-a" });
  });

  it("rejects non-success statuses before callers parse a payload", async () => {
    fetchMock.mockResponseOnce("not authorized", { status: 401 });
    const secretToken = "should-never-appear-in-errors";

    try {
      await postStudyTimeEdge("study-time-sync", secretToken, {
        deviceId: "device-a",
        days: [],
      });
      throw new Error("Expected request to fail");
    } catch (error) {
      expect(String(error)).toContain("HTTP 401");
      expect(String(error)).not.toContain(secretToken);
    }
  });

  it("aborts requests that exceed the timeout without exposing the token", async () => {
    fetchMock.mockImplementationOnce((_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new Error("underlying request aborted"));
        });
      }),
    );
    const secretToken = "timeout-secret-token";

    try {
      await postStudyTimeEdge(
        "study-time-history",
        secretToken,
        { deviceId: "device-a" },
        5,
      );
      throw new Error("Expected request to time out");
    } catch (error) {
      expect(String(error)).toContain("timed out");
      expect(String(error)).not.toContain(secretToken);
    }
  });

  it("sanitizes native network errors that might contain request metadata", async () => {
    const secretToken = "network-secret-token";
    fetchMock.mockRejectOnce(
      new Error(`failed request with x-wanikani-token=${secretToken}`),
    );

    try {
      await postStudyTimeEdge(
        "study-time-history",
        secretToken,
        { deviceId: "device-a" },
      );
      throw new Error("Expected request to fail");
    } catch (error) {
      expect(String(error)).toContain("could not be reached");
      expect(String(error)).not.toContain(secretToken);
    }
  });
});
