import type { ConversationAPI } from '../api';
import { WebRTCLiveTransport, type LiveRuntime, type PeerConnection, type LiveCallbacks, type LiveConnectOptions } from '../live-transport-core';

class Events {
  listeners = new Map<string, ((value: unknown) => void)[]>();
  addEventListener(type: string, listener: (event: unknown) => void) { this.listeners.set(type, [...this.listeners.get(type) ?? [], listener]); }
  removeEventListener(type: string, listener: (event: unknown) => void) { this.listeners.set(type, this.listeners.get(type)?.filter((item) => item !== listener) ?? []); }
  emit(type: string, event: unknown = {}) { this.listeners.get(type)?.forEach((listener) => listener(event)); }
}
function setup() {
  const track = { enabled: true, stop: jest.fn() };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  const channel = Object.assign(new Events(), { readyState: 'open', send: jest.fn((_value: string) => {}), close: jest.fn() });
  const peer = Object.assign(new Events(), {
    connectionState: 'connected', iceConnectionState: 'connected', iceGatheringState: 'complete', localDescription: { sdp: 'offer-sdp' },
    addTrack: jest.fn(), createDataChannel: jest.fn(() => channel), createOffer: jest.fn(async () => ({ type: 'offer', sdp: 'offer-sdp' })),
    setLocalDescription: jest.fn(async () => {}), setRemoteDescription: jest.fn(async () => {}), getStats: jest.fn(async () => new Map()), close: jest.fn(),
  });
  const runtime: LiveRuntime = { createPeer: () => peer as unknown as PeerConnection, getMicrophone: jest.fn(async () => stream), startAudio: jest.fn(), stopAudio: jest.fn() };
  const callbacks: LiveCallbacks = { onEvent: jest.fn(), onLevels: jest.fn(), onFailure: jest.fn() };
  const post = jest.fn(async () => ({ session: { id: 'live_1' }, transport: { type: 'webrtc', sdp: 'answer-sdp' } }));
  const api = { post } as unknown as ConversationAPI;
  const transport = new WebRTCLiveTransport(runtime, callbacks);
  const connect = async (options?: LiveConnectOptions) => {
    const pending = transport.connect(api, 'Speak Japanese', options);
    await jest.advanceTimersByTimeAsync(50);
    channel.emit('message', { data: JSON.stringify({ type: 'session.started', session: { id: 'live_1' } }) });
    await jest.advanceTimersByTimeAsync(50);
    await pending;
  };
  return { transport, api, post, track, stream, channel, peer, runtime, callbacks, connect };
}

describe('GPT-Live WebRTC lifecycle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('creates the exact Live session and waits for session.started before sending commands', async () => {
    const x = setup();
    expect(x.transport.send({ type: 'session.instructions.append' })).toBe(false);
    await x.connect();
    expect(x.post).toHaveBeenCalledWith('live/sessions', {
      session: { model: 'gpt-live-1', instructions: 'Speak Japanese', input: [], store: false, delegation: { type: 'client' }, audio: { output: { voice: 'marin' } } },
      transport: { type: 'webrtc', sdp: 'offer-sdp' },
    }, expect.any(AbortSignal));
    expect(x.peer.setRemoteDescription).toHaveBeenCalledWith({ type: 'answer', sdp: 'answer-sdp' });
    expect(x.channel.send).not.toHaveBeenCalled();
    expect(x.transport.send({ type: 'session.thinking.append', content: 'context', delegation_id: null })).toBe(true);
    x.transport.disconnect();
  });

  it('includes the selected voice and prior written messages in the startup request', async () => {
    const x = setup();
    const history = [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: 'こんにちは' }] }];
    await x.connect({ voice: 'willow', history });
    expect(x.post).toHaveBeenCalledWith('live/sessions', expect.objectContaining({
      session: expect.objectContaining({ input: history, audio: { output: { voice: 'willow' } } }),
    }), expect.any(AbortSignal));
    x.transport.disconnect();
  });

  it('mutes capture immediately and keeps media alive until final session usage arrives', async () => {
    const x = setup(); await x.connect();
    x.transport.mute(true);
    expect(x.track.enabled).toBe(false);
    expect(JSON.parse(x.channel.send.mock.calls.at(-1)![0]).type).toBe('session.input_audio.mute');
    const closing = x.transport.close();
    expect(x.peer.close).not.toHaveBeenCalled();
    expect(x.transport.send({ type: 'session.commentary.append' })).toBe(false);
    x.channel.emit('message', { data: JSON.stringify({ type: 'session.closed', usage: { seconds: 42 } }) });
    await expect(closing).resolves.toBe(true);
    expect(x.callbacks.onEvent).toHaveBeenCalledWith({ type: 'session.closed', usage: { seconds: 42 } });
    expect(x.track.stop).toHaveBeenCalled(); expect(x.peer.close).toHaveBeenCalled(); expect(x.runtime.stopAudio).toHaveBeenCalled();
  });

  it('releases the microphone on close timeout while honestly reporting unconfirmed final usage', async () => {
    const x = setup(); await x.connect();
    const closing = x.transport.close(100);
    await jest.advanceTimersByTimeAsync(101);
    await expect(closing).resolves.toBe(false);
    expect(x.track.stop).toHaveBeenCalled(); expect(x.peer.close).toHaveBeenCalled();
  });

  it('stops a permission stream that resolves after cancellation', async () => {
    const x = setup();
    let grant!: (stream: typeof x.stream) => void;
    x.runtime.getMicrophone = () => new Promise((resolve) => { grant = resolve; });
    const controller = new AbortController();
    const pending = x.transport.connect(x.api, '', { signal: controller.signal });
    const rejection = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort(); await rejection;
    grant(x.stream); await Promise.resolve(); await Promise.resolve();
    expect(x.track.stop).toHaveBeenCalled(); expect(x.post).not.toHaveBeenCalled();
  });

  it('ignores a previous connection’s delayed transcript after disconnect', async () => {
    const x = setup(); await x.connect(); x.transport.disconnect();
    const calls = (x.callbacks.onEvent as jest.Mock).mock.calls.length;
    x.channel.emit('message', { data: JSON.stringify({ type: 'session.input_transcript.delta', delta: 'late' }) });
    expect(x.callbacks.onEvent).toHaveBeenCalledTimes(calls);
  });

  it('fails a sustained network disconnect but allows a transient reconnection', async () => {
    const x = setup(); await x.connect();
    x.peer.connectionState = 'disconnected'; x.peer.emit('connectionstatechange');
    await jest.advanceTimersByTimeAsync(4000);
    x.peer.connectionState = 'connected'; x.peer.emit('connectionstatechange');
    await jest.advanceTimersByTimeAsync(2000);
    expect(x.callbacks.onFailure).not.toHaveBeenCalled();
    x.peer.connectionState = 'disconnected'; x.peer.emit('connectionstatechange');
    await jest.advanceTimersByTimeAsync(5001);
    expect(x.callbacks.onFailure).toHaveBeenCalledTimes(1);
    x.transport.disconnect();
  });
});
