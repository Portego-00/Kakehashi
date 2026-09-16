import { abortError, object, type ConversationAPI, type JSONObject } from './api';
import { normalizeLiveVoice, type LiveVoice } from './voices';

export type ConnectionState = 'idle' | 'connecting' | 'active' | 'closing' | 'ended' | 'failed';
export interface LiveCallbacks {
  onEvent(event: JSONObject): void;
  onLevels(input: number, output: number): void;
  onFailure(message: string): void;
}
interface RTCEvent { data?: unknown; track?: AudioTrack; streams?: AudioStream[] }
interface RTCEvents {
  addEventListener(type: string, listener: (event: RTCEvent) => void): void;
  removeEventListener(type: string, listener: (event: RTCEvent) => void): void;
}
export interface AudioTrack { enabled: boolean; kind?: string; stop(): void }
export interface AudioStream { getTracks(): AudioTrack[]; getAudioTracks(): AudioTrack[] }
export interface DataChannel extends RTCEvents { readyState: string; send(value: string): void; close(): void }
export interface PeerConnection extends RTCEvents {
  connectionState?: string;
  iceConnectionState: string;
  iceGatheringState: string;
  localDescription: { sdp?: string } | null;
  addTrack(track: AudioTrack, stream: AudioStream): unknown;
  createDataChannel(label: string, options: { ordered: boolean }): DataChannel;
  createOffer(options: { offerToReceiveAudio: boolean; offerToReceiveVideo: boolean }): Promise<{ type: string; sdp?: string }>;
  setLocalDescription(description: { type: string; sdp?: string }): Promise<void>;
  setRemoteDescription(description: { type: string; sdp: string }): Promise<void>;
  getStats(): Promise<{ forEach(callback: (value: Record<string, unknown>) => void): void }>;
  close(): void;
}
export interface LiveRuntime {
  createPeer(): PeerConnection;
  getMicrophone(signal?: AbortSignal): Promise<AudioStream>;
  startAudio?(): void;
  stopAudio?(): void;
  attachRemote?(event: RTCEvent): void;
  onInterruption?(callback: () => void): () => void;
}
export interface LiveConnectOptions {
  history?: unknown[];
  voice?: LiveVoice;
  signal?: AbortSignal;
}
export interface LiveTransport {
  readonly started: boolean;
  connect(api: ConversationAPI, instructions: string, options?: LiveConnectOptions): Promise<void>;
  send(event: JSONObject): boolean;
  mute(muted: boolean): boolean;
  close(timeoutMS?: number): Promise<boolean>;
  disconnect(): void;
}

function waitUntil(predicate: () => boolean, signal: AbortSignal, timeoutMS: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const finish = (error?: Error) => {
      clearInterval(timer); signal.removeEventListener('abort', cancelled);
      if (error) reject(error); else resolve();
    };
    const cancelled = () => finish(abortError());
    const check = () => {
      if (signal.aborted) cancelled();
      else if (predicate()) finish();
      else if (Date.now() - started >= timeoutMS) finish(new Error('The voice connection took too long. Please try again.'));
    };
    const timer = setInterval(check, 50);
    signal.addEventListener('abort', cancelled, { once: true });
    check();
  });
}

/** Shared protocol implementation; the runtime owns platform audio details only. */
export class WebRTCLiveTransport implements LiveTransport {
  started = false;
  private attempt = 0;
  private peer?: PeerConnection;
  private channel?: DataChannel;
  private stream?: AudioStream;
  private controller?: AbortController;
  private meter?: ReturnType<typeof setInterval>;
  private networkTimer?: ReturnType<typeof setTimeout>;
  private closeTimer?: ReturnType<typeof setTimeout>;
  private interruptionCleanup?: () => void;
  private closing = true;
  private muted = false;
  private closingPromise?: Promise<boolean>;
  private resolveClose?: (final: boolean) => void;
  private inputLevel = 0;
  private outputLevel = 0;
  private audioActive = false;

  constructor(private readonly runtime: LiveRuntime, private readonly callbacks: LiveCallbacks) {}

  async connect(api: ConversationAPI, instructions: string, options: LiveConnectOptions = {}): Promise<void> {
    // Capture startup configuration before microphone permission or network waits.
    const { history = [], signal } = options;
    const voice = normalizeLiveVoice(options.voice);
    this.disconnect();
    const attempt = this.attempt;
    const controller = new AbortController();
    this.controller = controller;
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
    const check = () => { if (this.attempt !== attempt || controller.signal.aborted) throw abortError(); };
    this.closing = false; this.muted = false; this.closingPromise = undefined;
    const connectionTimer = setTimeout(cancel, 65_000);
    try {
      check();
      // A permission prompt can resolve after navigation. Stop that late stream too.
      const mediaRequest = this.runtime.getMicrophone(controller.signal).then((stream) => {
        if (this.attempt !== attempt || controller.signal.aborted) {
          stream.getTracks().forEach((track) => track.stop());
          throw abortError();
        }
        this.stream = stream;
        return stream;
      });
      let media: AudioStream | undefined;
      let mediaError: unknown;
      mediaRequest.then((value) => { media = value; }, (error) => { mediaError = error; });
      await waitUntil(() => !!media || !!mediaError, controller.signal, 30_000);
      if (mediaError) throw mediaError;
      check();
      this.stream = media!;
      this.audioActive = true; this.runtime.startAudio?.();
      this.interruptionCleanup = this.runtime.onInterruption?.(() => {
        if (this.attempt === attempt && !this.closing) this.callbacks.onFailure('Audio was interrupted. Your conversation has been saved.');
      });
      const peer = this.runtime.createPeer();
      this.peer = peer;
      peer.addEventListener('track', (event) => {
        if (this.attempt === attempt) this.runtime.attachRemote?.(event);
      });
      const stateChanged = () => {
        if (this.attempt !== attempt || this.closing) return;
        const state = peer.connectionState || peer.iceConnectionState;
        if (state === 'failed') this.callbacks.onFailure('The network connection was lost. Start a new conversation when you are connected.');
        if (state === 'disconnected' && !this.networkTimer) {
          this.networkTimer = setTimeout(() => {
            this.networkTimer = undefined;
            if (this.attempt === attempt && !this.closing && (peer.connectionState === 'disconnected' || peer.iceConnectionState === 'disconnected')) {
              this.callbacks.onFailure('The voice connection was interrupted. Your conversation has been saved.');
            }
          }, 5_000);
        } else if (state !== 'disconnected') { clearTimeout(this.networkTimer); this.networkTimer = undefined; }
      };
      peer.addEventListener('connectionstatechange', stateChanged);
      peer.addEventListener('iceconnectionstatechange', stateChanged);
      this.stream.getAudioTracks().forEach((track) => peer.addTrack(track, this.stream!));
      const channel = peer.createDataChannel('oai-events', { ordered: true });
      this.channel = channel;
      channel.addEventListener('message', (message) => {
        if (this.attempt !== attempt || typeof message.data !== 'string') return;
        let event: JSONObject;
        try { event = object(JSON.parse(message.data)); } catch { return; }
        if (typeof event.type !== 'string') return;
        if (event.type === 'session.started') this.started = true;
        if (event.type === 'session.closed') {
          this.closing = true;
          // Deliver final usage before teardown resolves the close promise.
          this.settleClose(true);
          this.callbacks.onEvent(event);
          this.disconnect();
          return;
        }
        this.callbacks.onEvent(event);
      });
      channel.addEventListener('close', () => {
        if (this.attempt !== attempt) return;
        if (!this.closing) this.callbacks.onFailure('The voice connection ended unexpectedly. Your conversation has been saved.');
        else { this.settleClose(false); this.disconnect(); }
      });
      const offer = await peer.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false }); check();
      await peer.setLocalDescription(offer); check();
      await waitUntil(() => peer.iceGatheringState === 'complete', controller.signal, 10_000); check();
      const sdp = peer.localDescription?.sdp;
      if (!sdp) throw new Error('Could not create the voice connection. Please try again.');
      const result = await api.post('live/sessions', {
        session: { model: 'gpt-live-1', instructions, input: history, store: false, delegation: { type: 'client' }, audio: { output: { voice } } },
        transport: { type: 'webrtc', sdp },
      }, controller.signal);
      check();
      const answer = object(result.transport).sdp;
      if (typeof answer !== 'string' || !answer) throw new Error('OpenAI did not return a valid voice connection. Please try again.');
      this.callbacks.onEvent({ type: 'mural.session.created', session: result.session });
      await peer.setRemoteDescription({ type: 'answer', sdp: answer }); check();
      await waitUntil(() => this.started, controller.signal, 20_000); check();
      this.startMetering(attempt);
    } catch (error) {
      if (this.attempt === attempt) this.disconnect();
      if (error instanceof Error && /NotAllowed|Permission|denied/i.test(`${error.name} ${error.message}`)) {
        throw new Error('Allow microphone access in your device or browser settings to start a conversation.');
      }
      throw error;
    } finally { clearTimeout(connectionTimer); signal?.removeEventListener('abort', cancel); }
  }

  send(event: JSONObject): boolean {
    if (!this.started || this.closing || this.channel?.readyState !== 'open') return false;
    try { this.channel.send(JSON.stringify(event)); return true; } catch { return false; }
  }

  mute(muted: boolean): boolean {
    this.muted = muted;
    this.stream?.getAudioTracks().forEach((track) => { track.enabled = !muted; });
    return this.send({ type: muted ? 'session.input_audio.mute' : 'session.input_audio.unmute', event_id: `mute-${Date.now()}` });
  }

  close(timeoutMS = 15_000): Promise<boolean> {
    if (this.closingPromise) return this.closingPromise;
    if (!this.started || this.channel?.readyState !== 'open') { this.disconnect(); return Promise.resolve(false); }
    this.closing = true;
    this.muted = true;
    this.stream?.getAudioTracks().forEach((track) => { track.enabled = false; });
    const promise = new Promise<boolean>((resolve) => { this.resolveClose = resolve; });
    this.closingPromise = promise;
    this.closeTimer = setTimeout(() => { this.settleClose(false); this.disconnect(); }, timeoutMS);
    try { this.channel.send(JSON.stringify({ type: 'session.close', event_id: `close-${Date.now()}` })); }
    catch { this.settleClose(false); this.disconnect(); }
    return promise;
  }

  private settleClose(final: boolean) {
    clearTimeout(this.closeTimer); this.closeTimer = undefined;
    const resolve = this.resolveClose; this.resolveClose = undefined; resolve?.(final);
  }

  disconnect(): void {
    this.attempt++; this.closing = true; this.started = false;
    this.controller?.abort(); this.controller = undefined;
    clearInterval(this.meter); this.meter = undefined;
    clearTimeout(this.networkTimer); this.networkTimer = undefined;
    this.settleClose(false);
    this.interruptionCleanup?.(); this.interruptionCleanup = undefined;
    this.stream?.getTracks().forEach((track) => { track.enabled = false; track.stop(); });
    this.stream = undefined;
    this.channel?.close(); this.channel = undefined;
    this.peer?.close(); this.peer = undefined;
    if (this.audioActive) { this.runtime.stopAudio?.(); this.audioActive = false; }
    this.inputLevel = 0; this.outputLevel = 0; this.callbacks.onLevels(0, 0);
  }

  private startMetering(attempt: number) {
    let pending = false;
    this.meter = setInterval(async () => {
      if (!this.peer || !this.started || pending) return;
      pending = true;
      try {
        const stats = await this.peer.getStats();
        if (this.attempt !== attempt) return;
        let input = 0, output = 0;
        stats.forEach((stat) => {
          const level = typeof stat.audioLevel === 'number' && Number.isFinite(stat.audioLevel) ? stat.audioLevel : 0;
          if (stat.type === 'inbound-rtp') output = Math.max(output, level);
          if (stat.type === 'media-source' || stat.type === 'track' && stat.remoteSource === false) input = Math.max(input, level);
        });
        this.inputLevel = this.inputLevel * .35 + Math.min(1, input * 4) * .65;
        this.outputLevel = this.outputLevel * .35 + Math.min(1, output * 4) * .65;
        this.callbacks.onLevels(this.muted ? 0 : this.inputLevel, this.outputLevel);
      } catch { /* Metering is optional; audio and connection errors have separate handlers. */ }
      finally { pending = false; }
    }, 120);
  }
}
