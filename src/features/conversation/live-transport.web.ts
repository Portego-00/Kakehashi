import { WebRTCLiveTransport, type LiveCallbacks, type PeerConnection, type AudioStream } from './live-transport-core';

export type { ConnectionState, LiveTransport, LiveCallbacks, LiveConnectOptions } from './live-transport-core';

export function createLiveTransport(callbacks: LiveCallbacks): WebRTCLiveTransport {
  if (typeof RTCPeerConnection === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Use a browser with microphone support on HTTPS or localhost to start a voice conversation.');
  }
  const audio = document.createElement('audio');
  audio.autoplay = true;
  audio.setAttribute('playsinline', '');
  audio.setAttribute('aria-label', 'Conversation voice playback');
  return new WebRTCLiveTransport({
    createPeer: () => new RTCPeerConnection() as unknown as PeerConnection,
    getMicrophone: async () => await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false,
    }) as unknown as AudioStream,
    startAudio: () => { document.body.appendChild(audio); },
    attachRemote: (event) => {
      if (!event.track) return;
      audio.srcObject = new MediaStream([event.track as MediaStreamTrack]);
      audio.play().catch(() => {
        // If autoplay is blocked, expose the actual playback control rather than
        // claiming speech is audible or silently losing the remote track.
        audio.controls = true;
        audio.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:99999;max-width:calc(100% - 24px)';
      });
    },
    stopAudio: () => { audio.pause(); audio.srcObject = null; audio.remove(); },
  }, callbacks);
}
