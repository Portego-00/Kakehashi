import { readKey } from './credentials';
import type { SourceLink } from './types';

export interface APIUsage { input: number; output: number; searches: number }
export interface APIResult { text: string; sources: SourceLink[]; usage: APIUsage }
export interface ResponseToolset {
  definitions: readonly JSONObject[];
  execute(name: string, args: unknown, signal?: AbortSignal): Promise<unknown>;
}
export interface ResponseRequest {
  instructions: string;
  input: string;
  schema?: Record<string, unknown>;
  search?: boolean;
  signal?: AbortSignal;
  timeoutMS?: number;
  toolset?: ResponseToolset;
}
export type JSONObject = Record<string, unknown>;
export function object(value: unknown): JSONObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JSONObject : {};
}
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const count = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
export const isAbortError = (error: unknown) => error instanceof Error && error.name === 'AbortError';
export function abortError(): Error {
  const error = new Error('Request cancelled.');
  error.name = 'AbortError';
  return error;
}
export function safeSourceURL(value: string): boolean {
  try { const url = new URL(value); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password; }
  catch { return false; }
}

export class ConversationAPIError extends Error {
  constructor(message: string, public readonly status = 0) { super(message); this.name = 'ConversationAPIError'; }
}
function httpError(status: number): ConversationAPIError {
  if (status === 401) return new ConversationAPIError('Your OpenAI key was not accepted. Check it in Conversation settings.', status);
  if (status === 403 || status === 404) return new ConversationAPIError('This OpenAI project may not have access to GPT-Live or GPT-5.6 Luna. Check your project’s model access.', status);
  if (status === 429) return new ConversationAPIError('OpenAI’s usage or rate limit was reached. Check your project’s billing and limits.', status);
  return new ConversationAPIError(`OpenAI could not complete the request (HTTP ${status}). Please try again.`, status);
}

function readResponse(value: unknown, requireText: boolean): APIResult {
  const json = object(value);
  if (json.status !== 'completed') throw new ConversationAPIError('OpenAI returned an incomplete response. Please try again.');
  let text = '';
  const sources: SourceLink[] = [];
  const usage: APIUsage = { input: count(object(json.usage).input_tokens), output: count(object(json.usage).output_tokens), searches: 0 };
  for (const raw of list(json.output)) {
    const item = object(raw);
    if (item.type === 'web_search_call') usage.searches++;
    for (const rawContent of list(item.content)) {
      const content = object(rawContent);
      if (content.type === 'refusal') throw new ConversationAPIError('That request could not be completed. Try a different topic.');
      if (content.type === 'output_text' && typeof content.text === 'string') text += content.text;
      for (const rawCitation of list(content.annotations)) {
        const citation = object(rawCitation);
        if (citation.type === 'url_citation' && typeof citation.url === 'string' && safeSourceURL(citation.url)
          && !sources.some((source) => source.url === citation.url)) {
          sources.push({ title: typeof citation.title === 'string' ? citation.title : 'Source', url: citation.url });
        }
      }
    }
  }
  if (requireText && !text.trim()) throw new ConversationAPIError('OpenAI returned an empty response. Please try again.');
  return { text, sources, usage };
}

export function parseResponse(value: unknown): APIResult { return readResponse(value, true); }

// A final request with tools disabled follows at most four rounds of study lookups.
const MAXIMUM_FUNCTION_ROUNDS = 4;
const MAXIMUM_FUNCTION_CALLS = 8;
const MAXIMUM_ARGUMENT_LENGTH = 16_000;
const MAXIMUM_TOOL_OUTPUT_LENGTH = 64_000;
const toolFailure = (code: string, message: string) => JSON.stringify({ error: { code, message } });

function abortable<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const cancel = () => { signal.removeEventListener('abort', cancel); reject(abortError()); };
    signal.addEventListener('abort', cancel, { once: true });
    Promise.resolve().then(() => {
      if (signal.aborted) throw abortError();
      return operation();
    }).then(resolve, reject).finally(() => signal.removeEventListener('abort', cancel));
  });
}

async function executeFunction(call: JSONObject, allowedNames: ReadonlySet<string>, toolset: ResponseToolset, signal: AbortSignal): Promise<string> {
  if (signal.aborted) throw abortError();
  const name = call.name;
  if (typeof name !== 'string' || !allowedNames.has(name)) {
    return toolFailure('unknown_tool', 'This tool is not available. Use only the provided tools.');
  }
  let args: unknown;
  try {
    if (typeof call.arguments !== 'string' || call.arguments.length > MAXIMUM_ARGUMENT_LENGTH) throw new Error();
    args = JSON.parse(call.arguments);
    if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error();
  } catch {
    return toolFailure('invalid_arguments', 'Tool arguments must be a valid JSON object matching the tool definition.');
  }
  try {
    const result = await abortable(() => toolset.execute(name, args, signal), signal);
    if (signal.aborted) throw abortError();
    if (result instanceof Error) throw new Error();
    const output = JSON.stringify(result);
    if (typeof output !== 'string') throw new Error();
    if (output.length > MAXIMUM_TOOL_OUTPUT_LENGTH) {
      return toolFailure('result_too_large', 'This tool result was too large. Request fewer items or a narrower query.');
    }
    return output;
  } catch (error) {
    if (signal.aborted || isAbortError(error)) throw abortError();
    // Provider errors and credentials must never be echoed into model context.
    return toolFailure('tool_unavailable', 'The study information could not be retrieved. Continue using available information and explain this limitation.');
  }
}

export class ConversationAPI {
  constructor(private readonly getKey: () => Promise<string | null>, private readonly request: typeof fetch = fetch) {}

  async post(path: 'responses' | 'live/sessions', body: JSONObject, signal?: AbortSignal, timeoutMS = 45_000): Promise<JSONObject> {
    if (signal?.aborted) throw abortError();
    const key = await this.getKey();
    if (signal?.aborted) throw abortError();
    if (!key) throw new ConversationAPIError('Add your OpenAI API key in Conversation settings to begin.');
    const controller = new AbortController();
    let timedOut = false;
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMS);
    try {
      // Fixed origin and refused redirects prevent forwarding a personal key elsewhere.
      const response = await this.request(`https://api.openai.com/v1/${path}`, {
        method: 'POST', redirect: 'error', credentials: 'omit', cache: 'no-store',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: controller.signal,
      });
      if (!response.ok) throw httpError(response.status);
      const result: unknown = await response.json();
      if (controller.signal.aborted) throw abortError();
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw new ConversationAPIError('OpenAI returned an invalid response. Please try again.');
      return result as JSONObject;
    } catch (error) {
      if (timedOut) throw new ConversationAPIError('OpenAI took too long to respond. Check your connection and try again.');
      if (signal?.aborted || isAbortError(error)) throw abortError();
      if (error instanceof ConversationAPIError) throw error;
      throw new ConversationAPIError('Could not reach OpenAI. Check your internet connection and try again.');
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
  }

  async respond({ instructions, input, schema, search = false, signal, timeoutMS, toolset }: ResponseRequest): Promise<APIResult> {
    const body: JSONObject = {
      model: 'gpt-5.6-luna', store: false, instructions,
      input: [{ role: 'user', content: input }], max_output_tokens: schema ? 2200 : 1400,
      reasoning: { effort: 'low' },
    };
    if (schema) body.text = { format: { type: 'json_schema', name: 'mural_result', strict: true, schema } };
    if (search) Object.assign(body, { tools: [{ type: 'web_search' }], tool_choice: 'auto', max_tool_calls: 1 });
    if (!toolset?.definitions.length) return parseResponse(await this.post('responses', body, signal, timeoutMS));

    const definitions = toolset.definitions.filter((definition) => definition.type === 'function'
      && typeof definition.name === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(definition.name));
    if (definitions.length !== toolset.definitions.length) throw new ConversationAPIError('The study tools are not configured correctly. Please update the app.');
    const allowedNames = new Set(definitions.map((definition) => definition.name as string));
    const controller = new AbortController();
    let timedOut = false;
    const cancel = () => controller.abort();
    if (signal?.aborted) throw abortError();
    signal?.addEventListener('abort', cancel, { once: true });
    const duration = timeoutMS ?? 45_000;
    const deadline = Date.now() + duration;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, duration);
    const history: unknown[] = [...list(body.input)];
    const usage: APIUsage = { input: 0, output: 0, searches: 0 };
    const sources: SourceLink[] = [];
    const seenCallIDs = new Set<string>();
    let callsUsed = 0;
    try {
      for (let round = 0; round <= MAXIMUM_FUNCTION_ROUNDS; round++) {
        if (controller.signal.aborted) throw abortError();
        const finish = round === MAXIMUM_FUNCTION_ROUNDS || callsUsed >= MAXIMUM_FUNCTION_CALLS;
        const tools: JSONObject[] = [...definitions];
        // Preserve the original one-search budget across the entire answer, not per round.
        if (search && usage.searches === 0 && !finish) tools.push({ type: 'web_search' });
        const response = await abortable(() => this.post('responses', {
          ...body, input: history, tools, tool_choice: finish ? 'none' : 'auto',
          include: ['reasoning.encrypted_content'], max_tool_calls: 1,
        }, controller.signal, Math.max(1, deadline - Date.now())), controller.signal);
        if (controller.signal.aborted) throw abortError();
        const result = readResponse(response, false);
        usage.input += result.usage.input; usage.output += result.usage.output; usage.searches += result.usage.searches;
        for (const source of result.sources) if (!sources.some((prior) => prior.url === source.url)) sources.push(source);
        const output = list(response.output);
        const calls = output.map(object).filter((item) => item.type === 'function_call');
        if (!calls.length) return { ...parseResponse(response), usage, sources };
        if (finish || calls.length > MAXIMUM_FUNCTION_CALLS - callsUsed) {
          throw new ConversationAPIError('The study lookup limit was reached. Try a more focused question.');
        }
        for (const call of calls) {
          if (typeof call.call_id !== 'string' || !call.call_id || call.call_id.length > 256 || seenCallIDs.has(call.call_id)) {
            throw new ConversationAPIError('OpenAI returned an invalid study tool request. Please try again.');
          }
          seenCallIDs.add(call.call_id);
        }
        callsUsed += calls.length;
        // Stateless continuation needs the complete output, including encrypted reasoning and message phases.
        history.push(...output);
        const results = await Promise.all(calls.map(async (call) => ({
          type: 'function_call_output', call_id: call.call_id,
          output: await executeFunction(call, allowedNames, toolset, controller.signal),
        })));
        if (controller.signal.aborted) throw abortError();
        history.push(...results);
      }
      throw new ConversationAPIError('The study lookup limit was reached. Try a more focused question.');
    } catch (error) {
      if (timedOut) throw new ConversationAPIError('OpenAI took too long to respond. Check your connection and try again.');
      if (signal?.aborted || isAbortError(error)) throw abortError();
      throw error;
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', cancel);
      controller.abort();
    }
  }
}

export const apiForAccount = (accountId: string) => new ConversationAPI(() => readKey(accountId));

const string = { type: 'string' };
const schemaObject = (properties: JSONObject) => ({ type: 'object', properties, required: Object.keys(properties).sort(), additionalProperties: false });
export function assessmentSchema(languageID: string): JSONObject {
  return schemaObject({
    outcome: { type: 'string', enum: ['success', 'partial', 'breakdown', 'uncertain'] },
    suggestedLevel: { type: 'integer', minimum: 0, maximum: 5 }, nextGoal: string, capability: string,
    words: { type: 'array', maxItems: 12, items: schemaObject({
      lemma: string, meaning: string, form: string, quote: string,
      language: { type: 'string', enum: [...new Set([languageID, 'en', 'mixed', 'uncertain'])].sort() },
      kind: { type: 'string', enum: ['exposure', 'understanding', 'assisted', 'independent', 'lapse'] },
      confidence: { type: 'number', minimum: 0, maximum: 1 }, sourceIDs: { type: 'array', items: string },
    }) },
  });
}
