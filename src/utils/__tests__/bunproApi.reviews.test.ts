import * as SecureStore from "expo-secure-store";
import fetchMock from "jest-fetch-mock";
import { updateBunproReview, getBunproCoverage, saveBunproCoverage } from "../bunproApi";
import type { BunproReviewUpdateRequest } from "../../types/bunpro";

const payload: BunproReviewUpdateRequest = {
  review_session_id: 3,
  correct: true,
  fsrs_input: null,
  loaded_review_ids: [10],
  loaded_ghost_review_ids: [10, 14273034],
  loaded_self_study_review_ids: [10],
  deck_id: null,
  only_review: "GrammarPoint",
};

beforeEach(() => fetchMock.resetMocks());

it.each([
  { reviewType: "review" as const, path: "/api/frontend/reviews/14273034/update" },
  { reviewType: "ghost_review" as const, path: "/api/frontend/ghost_reviews/14273034/update" },
  { reviewType: "self_study_review" as const, path: "/api/frontend/self_study_reviews/14273034/update" },
])("saves a $reviewType through its own endpoint with every category's loaded IDs", async ({ reviewType, path }) => {
  const queue = { review_session_id: 3, pending_attempt: [], pending_wrapup: [] };
  fetchMock.mockResponse(async request => new URL(request.url).pathname === path
    ? JSON.stringify(queue)
    : { status: 500, body: "{}" });

  await expect(updateBunproReview({ reviewId: "14273034", reviewType, payload, apiToken: "fixture-key" })).resolves.toEqual(queue);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual(payload);
});

it("rejects unsupported review categories without submitting a normal review", async () => {
  fetchMock.mockResponseOnce("{}");
  // @ts-expect-error Reject invalid runtime values from untyped callers too.
  await expect(updateBunproReview({ reviewId: 10, reviewType: "unsupported", payload, apiToken: "fixture-key" })).rejects.toMatchObject({ status: 400 });
  expect(fetchMock).not.toHaveBeenCalled();
});

it("keeps legacy submissions on the normal endpoint and preserves null pagination", async () => {
  fetchMock.mockResponseOnce("{}");
  await updateBunproReview({ reviewId: 10, payload: { ...payload, loaded_review_ids: null, loaded_ghost_review_ids: null, loaded_self_study_review_ids: null }, apiToken: "fixture-key" });
  expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe("/api/frontend/reviews/10/update");
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ loaded_review_ids: null, loaded_ghost_review_ids: null, loaded_self_study_review_ids: null });
});

it.each([401, 403, 500])("reports a ghost submission failure (%s) without retrying the grade", async status => {
  fetchMock.mockResponseOnce("{}", { status });
  await expect(updateBunproReview({ reviewId: 10, reviewType: "ghost_review", payload, apiToken: "fixture-key" })).rejects.toMatchObject({ status });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("hydrates coverage and saves knowledge grades through the same endpoints as web", async () => {
  const token = jest.spyOn(SecureStore, "getItemAsync").mockResolvedValue("fixture-key");
  fetchMock.mockResponseOnce(JSON.stringify({ data: [] }));
  await getBunproCoverage([1, 1, 2]);
  expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe("/api/frontend/reviews/hydrate_reviewables");
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ reviewables: [["Vocab", 1], ["Vocab", 2]] });
  fetchMock.mockResponseOnce("{}");
  await saveBunproCoverage([1, 2], 12, 5);
  expect(fetchMock.mock.calls[1][1]?.method).toBe("PATCH");
  expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ action_type: "mark_known", deck_id: 5, reviewables: [["Vocab", 1], ["Vocab", 2]] });
  token.mockRestore();
});
