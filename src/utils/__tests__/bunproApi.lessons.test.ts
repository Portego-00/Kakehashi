import fetchMock from "jest-fetch-mock";
import { getBunproLearnIndex, getBunproLearnQuiz } from "../bunproApi";

beforeEach(() => fetchMock.resetMocks());

it("starts the selected lesson quiz using the working web app's object payload", async () => {
  const quiz = { review_session_id: 42, pending_attempt: [{ data: { id: "10", type: "review" } }], pending_wrapup: [] };
  const expected = { deck_id: 1, reviewables: [{ reviewable_id: 20, reviewable_type: "grammar_point" }, { reviewable_id: 21, reviewable_type: "vocab" }] };
  fetchMock.mockResponse(async request => new URL(request.url).pathname === "/api/frontend/learn/quiz" && request.method === "POST" && JSON.stringify(JSON.parse(await request.text())) === JSON.stringify(expected)
    ? JSON.stringify(quiz) : { status: 500, body: "{}" });
  await expect(getBunproLearnQuiz({ deckId: 1, reviewables: [["GrammarPoint", 20], ["Vocab", 21]], apiToken: "fixture-key" })).resolves.toEqual(quiz);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual(expected);
});

it("loads a lesson deck with the same query and authentication as web", async () => {
  fetchMock.mockResponseOnce(JSON.stringify({ content: [] }));
  await getBunproLearnIndex({ deckId: 1, apiToken: "fixture-key" });
  const url = new URL(String(fetchMock.mock.calls[0][0]));
  expect(url.pathname).toBe("/api/frontend/learn");
  expect(url.searchParams.get("deck_id")).toBe("1");
  expect(url.searchParams.get("dangerously_authenticate_using_api_token")).toBe("true");
});
