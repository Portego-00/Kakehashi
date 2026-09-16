import { ConversationAPI, type JSONObject } from '../api';
import { KakehashiLearningTools } from '../kakehashi-tools';

function response(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

describe('Luna and Kakehashi learning context integration', () => {
  it('executes a real profile tool and keeps each credential exclusively with its own service', async () => {
    const accountId = 'test-account-portego';
    const waniKaniToken = 'wk-test-only-credential';
    const openAIKey = 'sk-openai-test-only-credential';
    const now = Date.parse('2026-09-15T12:00:00Z');
    const unsubscribe = jest.fn();
    (global.fetch as jest.Mock).mockClear();

    const waniKaniRequest = jest.fn(async (input: string, _init: RequestInit) => {
      const url = new URL(input);
      if (url.pathname === '/v2/user') return response({ data: {
        id: accountId, level: 12, current_vacation_started_at: null,
        username: 'private-user-name', subscription: { period_ends_at: 'private-billing-information' },
      } });
      if (url.pathname === '/v2/summary') return response({ data: {
        lessons: [{ available_at: '2026-09-15T10:00:00Z', subject_ids: [1, 2] }],
        reviews: [
          { available_at: '2026-09-15T11:00:00Z', subject_ids: [10, 11] },
          { available_at: '2026-09-15T13:00:00Z', subject_ids: [12] },
        ],
        next_reviews_at: '2026-09-15T13:00:00Z',
      } });
      if (url.pathname === '/v2/assignments') return response({
        data: [{ id: 1001, data: { subject_id: 10, started_at: '2026-09-10T00:00:00Z' } }],
        total_count: url.searchParams.get('subject_types') === 'kanji' ? 90 : 220,
        pages: { next_url: null },
      });
      throw new Error('Unexpected test endpoint');
    });
    const learning = new KakehashiLearningTools(accountId, {
      getAuth: () => ({ accountId, token: waniKaniToken, authenticated: true }),
      subscribeAuth: () => unsubscribe,
      request: waniKaniRequest,
      now: () => now,
    });
    const openAIRequest = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { input: JSONObject[] };
      const toolOutput = body.input.find((item) => item.type === 'function_call_output');
      if (!toolOutput) return response({
        status: 'completed', usage: { input_tokens: 30, output_tokens: 10 },
        output: [
          { type: 'reasoning', id: 'rs_test', encrypted_content: 'encrypted-reasoning', summary: [] },
          { type: 'function_call', id: 'fc_test', call_id: 'profile_call', name: 'get_kakehashi_learning_profile', arguments: '{}' },
        ],
      });
      const profile = JSON.parse(String(toolOutput.output)) as { level: number; reviewsDue: number };
      return response({
        status: 'completed', usage: { input_tokens: 60, output_tokens: 20 },
        output: [{ type: 'message', role: 'assistant', content: [{
          type: 'output_text', text: `Let’s practise level ${profile.level} vocabulary. You have ${profile.reviewsDue} reviews due.`,
        }] }],
      });
    });

    try {
      const result = await new ConversationAPI(async () => openAIKey, openAIRequest).respond({
        instructions: 'Use the learner’s actual study information to personalise practice.',
        input: 'What should I practise today?', toolset: learning,
      });

      expect(result).toEqual({
        text: 'Let’s practise level 12 vocabulary. You have 2 reviews due.',
        usage: { input: 90, output: 30, searches: 0 }, sources: [],
      });
      expect(waniKaniRequest).toHaveBeenCalledTimes(4);
      expect(openAIRequest).toHaveBeenCalledTimes(2);
      for (const [url, init] of waniKaniRequest.mock.calls) {
        expect(new URL(url).origin).toBe('https://api.wanikani.com');
        expect(init).toMatchObject({ method: 'GET', redirect: 'error' });
        expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${waniKaniToken}`);
        expect(JSON.stringify({ url, ...init })).not.toContain(openAIKey);
        expect(init.body).toBeUndefined();
      }
      for (const [url, init] of openAIRequest.mock.calls) {
        expect(String(url)).toBe('https://api.openai.com/v1/responses');
        expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${openAIKey}`);
        expect(JSON.stringify({ url, ...init })).not.toContain(waniKaniToken);
        expect(String(init?.body)).not.toContain(openAIKey);
        for (const privateValue of [accountId, 'private-user-name', 'private-billing-information']) {
          expect(String(init?.body)).not.toContain(privateValue);
        }
      }
      const continuation = JSON.parse(String(openAIRequest.mock.calls[1][1]?.body)) as { input: JSONObject[] };
      const output = continuation.input.find((item) => item.type === 'function_call_output');
      expect(output?.call_id).toBe('profile_call');
      expect(JSON.parse(String(output?.output))).toMatchObject({
        source: 'WaniKani via the signed-in Kakehashi account', retrievedAt: '2026-09-15T12:00:00.000Z',
        level: 12, lessonsAvailable: 2, reviewsDue: 2, reviewsInNext24Hours: 3,
        startedKanji: 90, startedVocabulary: 220, vacationMode: false,
      });
      expect(global.fetch).not.toHaveBeenCalled();
    } finally { learning.dispose(); }
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
