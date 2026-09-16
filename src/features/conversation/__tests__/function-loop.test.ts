import { abortError, ConversationAPI, type JSONObject, type ResponseToolset } from '../api';

const definitions: JSONObject[] = ['read_profile', 'read_items'].map((name) => ({
  type: 'function', name, description: 'Read study information', strict: true,
  parameters: { type: 'object', properties: {}, additionalProperties: false, required: [] },
}));
const call = (id: string, name = 'read_profile', args = '{}') => ({ type: 'function_call', id: `fc_${id}`, call_id: id, name, arguments: args });
const message = (text: string, annotations: JSONObject[] = []) => ({
  type: 'message', role: 'assistant', phase: 'final_answer', content: [{ type: 'output_text', text, annotations }],
});
const response = (output: JSONObject[], input = 10, generated = 5) => ({ status: 'completed', output, usage: { input_tokens: input, output_tokens: generated } });
const http = (data: JSONObject) => ({ ok: true, json: async () => data });
const base = { instructions: 'Use study information to teach Japanese.', input: 'What should I practise?' };
const bodyAt = (request: jest.Mock, index: number): JSONObject => JSON.parse(request.mock.calls[index][1].body);

describe('Luna study function loop', () => {
  beforeEach(() => jest.useRealTimers());
  afterEach(() => jest.useRealTimers());

  it('replays all reasoning, assistant phases, and matching function outputs while accumulating usage and citations', async () => {
    const reasoning = { type: 'reasoning', id: 'rs_1', summary: [], encrypted_content: 'encrypted-provider-reasoning' };
    const citation = { type: 'url_citation', url: 'https://example.org/study', title: 'Study source' };
    const interim = { ...message('I will check your study items.', [citation]), phase: 'commentary' };
    const first = response([reasoning, { type: 'web_search_call', id: 'ws_1' }, interim, call('one'), call('two', 'read_items', '{"status":"due"}')], 30, 15);
    const final = response([message('Practise the words that are due.', [citation, { type: 'url_citation', url: 'https://example.org/next', title: 'Next' }])], 50, 20);
    const request = jest.fn().mockResolvedValueOnce(http(first)).mockResolvedValueOnce(http(final));
    const execute = jest.fn(async (name: string, _args: unknown, _signal?: AbortSignal) => name === 'read_profile' ? { level: 5 } : { items: ['山'] });
    const schema = { type: 'object', properties: {} };
    const result = await new ConversationAPI(async () => 'sk-test', request).respond({ ...base, schema, search: true, toolset: { definitions, execute } });

    expect(result).toEqual({ text: 'Practise the words that are due.', usage: { input: 80, output: 35, searches: 1 }, sources: [
      { title: 'Study source', url: 'https://example.org/study' }, { title: 'Next', url: 'https://example.org/next' },
    ] });
    expect(execute.mock.calls.map(([name, args]) => [name, args])).toEqual([['read_profile', {}], ['read_items', { status: 'due' }]]);
    const firstBody = bodyAt(request, 0);
    expect(firstBody).toMatchObject({ model: 'gpt-5.6-luna', store: false, tools: [...definitions, { type: 'web_search' }], include: ['reasoning.encrypted_content'], max_tool_calls: 1 });
    const next = bodyAt(request, 1);
    expect(next.input).toEqual([
      { role: 'user', content: base.input }, ...first.output,
      { type: 'function_call_output', call_id: 'one', output: '{"level":5}' },
      { type: 'function_call_output', call_id: 'two', output: '{"items":["山"]}' },
    ]);
    expect(next).toMatchObject({ model: 'gpt-5.6-luna', store: false, tools: definitions, instructions: base.instructions, text: { format: { strict: true, schema } } });
    expect(next).not.toHaveProperty('previous_response_id');
  });

  it('rejects unknown functions, malformed JSON, and non-object arguments without executing them or echoing arguments', async () => {
    const request = jest.fn().mockResolvedValueOnce(http(response([
      call('unknown', 'delete_everything'), call('invalid', 'read_profile', '{sk-secret'), call('array', 'read_items', '[]'),
    ]))).mockResolvedValueOnce(http(response([message('Those study details are unavailable.')])));
    const execute = jest.fn();
    await new ConversationAPI(async () => 'sk-test', request).respond({ ...base, toolset: { definitions, execute } });
    expect(execute).not.toHaveBeenCalled();
    const outputs = (bodyAt(request, 1).input as JSONObject[]).filter((item) => item.type === 'function_call_output');
    expect(outputs.map((item) => JSON.parse(item.output as string).error.code)).toEqual(['unknown_tool', 'invalid_arguments', 'invalid_arguments']);
    expect(JSON.stringify(outputs)).not.toContain('sk-secret');
    expect(JSON.stringify(outputs)).not.toContain('delete_everything');
  });

  it('returns sanitized tool failures and oversized-result errors to Luna', async () => {
    const request = jest.fn().mockResolvedValueOnce(http(response([call('one'), call('two', 'read_items')]))).mockResolvedValueOnce(http(response([message('I could not read your study details.')])));
    const execute = jest.fn(async (name) => {
      if (name === 'read_profile') throw new Error('Authorization: Bearer private-wanikani-key');
      return { text: 'a'.repeat(64_001) };
    });
    await new ConversationAPI(async () => 'sk-test', request).respond({ ...base, toolset: { definitions, execute } });
    const outputs = (bodyAt(request, 1).input as JSONObject[]).filter((item) => item.type === 'function_call_output');
    expect(outputs.map((item) => JSON.parse(item.output as string).error.code)).toEqual(['tool_unavailable', 'result_too_large']);
    expect(JSON.stringify(outputs)).not.toContain('private-wanikani-key');
  });

  it('cancels a hung tool immediately and never sends late results to OpenAI', async () => {
    const controller = new AbortController();
    const request = jest.fn().mockResolvedValue(http(response([call('one')])));
    let finish!: (result: unknown) => void;
    let began!: () => void;
    const started = new Promise<void>((resolve) => { began = resolve; });
    const execute = jest.fn((_name: string, _args: unknown, signal?: AbortSignal) => new Promise((resolve) => { finish = resolve; began(); }));
    const pending = new ConversationAPI(async () => 'sk-test', request).respond({ ...base, signal: controller.signal, toolset: { definitions, execute } });
    const rejection = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await started;
    controller.abort();
    await rejection;
    expect(execute.mock.calls[0][2]?.aborted).toBe(true);
    finish({ level: 9 });
    await Promise.resolve(); await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('uses one deadline across function work and the follow-up request', async () => {
    jest.useFakeTimers();
    const request = jest.fn().mockResolvedValueOnce(http(response([call('one')]))).mockImplementationOnce(() => new Promise(() => {}));
    const execute = jest.fn(async () => { await new Promise((resolve) => setTimeout(resolve, 40)); return { level: 5 }; });
    const pending = new ConversationAPI(async () => 'sk-test', request).respond({ ...base, timeoutMS: 50, toolset: { definitions, execute } });
    const rejection = expect(pending).rejects.toThrow('too long');
    await jest.advanceTimersByTimeAsync(51);
    await rejection;
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][1].signal.aborted).toBe(true);
  });

  it('bounds even credential lookup and tool executors that ignore cancellation', async () => {
    jest.useFakeTimers();
    const request = jest.fn();
    const execute = jest.fn();
    const pending = new ConversationAPI(() => new Promise(() => {}), request).respond({ ...base, timeoutMS: 20, toolset: { definitions, execute } });
    const rejection = expect(pending).rejects.toThrow('too long');
    await jest.advanceTimersByTimeAsync(21);
    await rejection;
    expect(request).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();

    request.mockResolvedValue(http(response([call('one')])));
    execute.mockImplementation(() => new Promise(() => {}));
    const second = new ConversationAPI(async () => 'sk-test', request).respond({ ...base, timeoutMS: 20, toolset: { definitions, execute } });
    const nextRejection = expect(second).rejects.toThrow('too long');
    await jest.advanceTimersByTimeAsync(21);
    await nextRejection;
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('disables all tools after eight calls so Luna can finish without more lookups', async () => {
    const request = jest.fn().mockResolvedValueOnce(http(response(Array.from({ length: 8 }, (_, i) => call(`${i}`))))).mockResolvedValueOnce(http(response([message('Here is your practice plan.')])));
    const execute = jest.fn(async () => ({ level: 5 }));
    const result = await new ConversationAPI(async () => 'sk-test', request).respond({ ...base, search: true, toolset: { definitions, execute } });
    expect(execute).toHaveBeenCalledTimes(8);
    expect(bodyAt(request, 1)).toMatchObject({ tool_choice: 'none', tools: definitions });
    expect(result.text).toBe('Here is your practice plan.');
  });

  it('stops after four tool rounds even if the model ignores the final tool prohibition', async () => {
    let sequence = 0;
    const request = jest.fn(async () => http(response([call(`${++sequence}`)])));
    const execute = jest.fn(async () => ({ level: 5 }));
    await expect(new ConversationAPI(async () => 'sk-test', request).respond({ ...base, toolset: { definitions, execute } })).rejects.toThrow('lookup limit');
    expect(request).toHaveBeenCalledTimes(5);
    expect(execute).toHaveBeenCalledTimes(4);
    expect(bodyAt(request, 4).tool_choice).toBe('none');
  });

  it('does not execute a batch that exceeds the remaining call budget', async () => {
    const request = jest.fn().mockResolvedValueOnce(http(response(Array.from({ length: 7 }, (_, i) => call(`${i}`))))).mockResolvedValueOnce(http(response([call('eight'), call('nine')])));
    const execute = jest.fn(async () => ({ level: 5 }));
    await expect(new ConversationAPI(async () => 'sk-test', request).respond({ ...base, toolset: { definitions, execute } })).rejects.toThrow('lookup limit');
    expect(execute).toHaveBeenCalledTimes(7);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('never executes incomplete or malformed function batches', async () => {
    const execute = jest.fn();
    const toolset: ResponseToolset = { definitions, execute };
    const request = jest.fn().mockResolvedValueOnce(http({ ...response([call('one')]), status: 'incomplete' }))
      .mockResolvedValueOnce(http(response([call('duplicate'), call('duplicate')])));
    const api = new ConversationAPI(async () => 'sk-test', request);
    await expect(api.respond({ ...base, toolset })).rejects.toThrow('incomplete');
    await expect(api.respond({ ...base, toolset })).rejects.toThrow('invalid study tool request');
    expect(execute).not.toHaveBeenCalled();
  });

  it('propagates an executor abort instead of turning it into a tool failure', async () => {
    const request = jest.fn().mockResolvedValue(http(response([call('one')])));
    const execute = jest.fn(async () => { throw abortError(); });
    await expect(new ConversationAPI(async () => 'sk-test', request).respond({ ...base, toolset: { definitions, execute } })).rejects.toMatchObject({ name: 'AbortError' });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
