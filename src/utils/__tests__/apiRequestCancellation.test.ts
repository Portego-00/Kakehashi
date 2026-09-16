jest.mock('../apiDebugger', () => ({
  apiDebugger: { logCall: jest.fn(), logNetworkCall: jest.fn(async () => undefined) },
}));
jest.mock('../startupDiagnostics', () => ({
  startupDiagnostics: { shouldSuppressApiCallLogs: () => true },
}));

function loadApi(): typeof import('../api') {
  // Resetting modules gives each case a fresh shared rate-limit queue.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../api');
}

function responseAtLimit() {
  return {
    status: 200, ok: true,
    headers: new Headers({ 'RateLimit-Limit': '2', 'RateLimit-Remaining': '1' }),
    json: async () => ({ data: [] }),
    text: async () => '{"data":[]}',
  };
}

describe('WaniKani shared request cancellation', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-15T12:00:00.000Z'));
    (global.fetch as jest.Mock).mockReset();
  });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  it('rejects an already canceled request before reserving a network request', async () => {
    const { fetchWaniKaniApi } = loadApi();
    const controller = new AbortController();
    controller.abort();

    await expect(fetchWaniKaniApi('https://api.wanikani.com/v2/user', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);

    // Cancellation must not occupy the next otherwise available slot.
    (global.fetch as jest.Mock).mockResolvedValueOnce(responseAtLimit());
    const next = await fetchWaniKaniApi('https://api.wanikani.com/v2/summary');
    await next.json();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('removes a canceled rate-limit wait immediately and never fetches it in a later minute', async () => {
    const { fetchWaniKaniApi } = loadApi();
    (global.fetch as jest.Mock).mockResolvedValue(responseAtLimit());
    const first = await fetchWaniKaniApi('https://api.wanikani.com/v2/user');
    await first.json();

    const controller = new AbortController();
    const queued = fetchWaniKaniApi('https://api.wanikani.com/v2/subjects', { signal: controller.signal });
    const rejection = expect(queued).rejects.toMatchObject({ name: 'AbortError' });
    await jest.advanceTimersByTimeAsync(0);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(1);

    controller.abort();
    await rejection;
    expect(jest.getTimerCount()).toBe(0);
    await jest.advanceTimersByTimeAsync(120_000);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const next = await fetchWaniKaniApi('https://api.wanikani.com/v2/assignments');
    await next.json();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect((global.fetch as jest.Mock).mock.calls.map(([url]) => url)).toEqual([
      'https://api.wanikani.com/v2/user', 'https://api.wanikani.com/v2/assignments',
    ]);
    expect(jest.getTimerCount()).toBe(0);
  });
});
