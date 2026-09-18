import { ConversationAPI, parseResponse, assessmentSchema } from '../api';

const output = (text = 'こんにちは。') => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text }] }], usage: { input_tokens: 12, output_tokens: 8 } });

describe('Conversation OpenAI requests', () => {
  beforeEach(() => jest.useRealTimers());
  afterEach(() => jest.useRealTimers());

  it('uses the exact Responses model, private storage policy, structured schema and bounded web search', async () => {
    const request = jest.fn().mockResolvedValue({ ok: true, json: async () => output() });
    const api = new ConversationAPI(async () => 'sk-personal-key', request);
    const schema = assessmentSchema('ja');
    const result = await api.respond({ instructions: 'Teach Japanese', input: 'こんにちは', schema, search: true });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe('https://api.openai.com/v1/responses');
    const options = request.mock.calls[0][1];
    expect(options.redirect).toBe('error');
    expect(options.credentials).toBe('omit');
    expect(JSON.parse(options.body)).toMatchObject({ model: 'gpt-5.6-luna', store: false, reasoning: { effort: 'low' }, tools: [{ type: 'web_search' }], max_tool_calls: 1, text: { format: { type: 'json_schema', strict: true, schema } } });
    expect(result.usage).toEqual({ input: 12, output: 8, searches: 0 });
  });

  it('never sends a request without a key or after cancellation during credential retrieval', async () => {
    const request = jest.fn();
    await expect(new ConversationAPI(async () => null, request).respond({ instructions: '', input: '' })).rejects.toThrow('Add your OpenAI');
    const controller = new AbortController();
    const api = new ConversationAPI(async () => { controller.abort(); return 'sk-key'; }, request);
    await expect(api.respond({ instructions: '', input: '', signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(request).not.toHaveBeenCalled();
  });

  it('does not retry billable requests and never surfaces provider response bodies or keys in errors', async () => {
    const request = jest.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({ key: 'secret' }) });
    const api = new ConversationAPI(async () => 'sk-secret', request);
    await expect(api.respond({ instructions: '', input: '' })).rejects.toThrow('rate limit');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('aborts a hung HTTP request at the deadline with a useful timeout', async () => {
    jest.useFakeTimers();
    const request = jest.fn((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('cancelled')))));
    const api = new ConversationAPI(async () => 'sk-key', request as typeof fetch);
    const pending = api.respond({ instructions: '', input: '', timeoutMS: 50 });
    const rejection = expect(pending).rejects.toThrow('too long');
    await jest.advanceTimersByTimeAsync(51);
    await rejection;
    expect(request.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('validates completion, refuses refusals, and deduplicates only safe HTTPS citations', () => {
    const response = output('A sourced reply');
    const data = { ...response, output: [{ type: 'web_search_call' }, { type: 'message', content: [{ type: 'output_text', text: 'A sourced reply', annotations: [
      { type: 'url_citation', url: 'https://example.org/a', title: 'A' },
      { type: 'url_citation', url: 'https://example.org/a', title: 'Again' },
      { type: 'url_citation', url: 'javascript:alert(1)', title: 'Unsafe' },
      { type: 'url_citation', url: 'https://user:pass@example.org', title: 'Unsafe' },
    ] }] }] };
    expect(parseResponse(data)).toMatchObject({ sources: [{ title: 'A', url: 'https://example.org/a' }], usage: { searches: 1 } });
    expect(() => parseResponse({ ...response, status: 'incomplete' })).toThrow('incomplete');
    expect(() => parseResponse({ ...response, output: [{ content: [{ type: 'refusal' }] }] })).toThrow('different topic');
    expect(() => parseResponse(output(' '))).toThrow('empty');
  });
});
