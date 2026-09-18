import { DeviceEventEmitter, NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { abortError } from './api';
import { WebRTCLiveTransport, type LiveCallbacks, type LiveRuntime, type PeerConnection, type AudioStream } from './live-transport-core';

export type { ConnectionState, LiveTransport, LiveCallbacks, LiveConnectOptions } from './live-transport-core';

export function createLiveTransport(callbacks: LiveCallbacks): WebRTCLiveTransport {
  // Load native modules only on Start so an older installed binary can still open
  // the app, view its learning archive and receive a useful rebuild message.
  let rtc: typeof import('react-native-webrtc');
  let audio: typeof import('react-native-incall-manager').default;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Avoid loading absent native modules before Start.
    rtc = require('react-native-webrtc');
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Must share the lazy native build check above.
    audio = require('react-native-incall-manager').default;
    if (!rtc.RTCPeerConnection || !audio) throw new Error('Unavailable native audio');
  } catch {
    throw new Error('Voice conversations need the updated Kakehashi development build. Install a new iOS or Android build with WebRTC support; Expo Go cannot run live voice.');
  }
  const runtime: LiveRuntime = {
    createPeer: () => new rtc.RTCPeerConnection({ iceServers: [] }) as unknown as PeerConnection,
    // Native WebRTC's voice audio source provides echo cancellation and gain
    // control; unlike browsers this library does not accept audio constraints.
    getMicrophone: async (signal) => {
      if (Platform.OS === 'android' && Number(Platform.Version) >= 31) {
        const permission = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT;
        try {
          if (!await PermissionsAndroid.check(permission) && !signal?.aborted) {
            // Bluetooth routing is optional. A declined Nearby devices prompt
            // still permits a conversation through the phone speaker.
            await PermissionsAndroid.request(permission);
          }
        } catch { /* An unavailable Bluetooth permission never blocks the speaker. */ }
      }
      if (signal?.aborted) throw abortError();
      return await rtc.mediaDevices.getUserMedia({ audio: true, video: false }) as unknown as AudioStream;
    },
    startAudio: () => { audio.start({ media: 'audio', auto: true }); audio.setSpeakerphoneOn(true); },
    stopAudio: () => audio.stop(),
    onInterruption: (callback) => {
      const emitter = Platform.OS === 'ios' ? new NativeEventEmitter(NativeModules.InCallManager) : DeviceEventEmitter;
      const listeners = [
        emitter.addListener('onAudioFocusChange', (event) => {
          if (event.eventText === 'AUDIOFOCUS_LOSS' || event.eventText === 'AUDIOFOCUS_LOSS_TRANSIENT') callback();
        }),
      ];
      return () => listeners.forEach((listener) => listener.remove());
    },
  };
  return new WebRTCLiveTransport(runtime, callbacks);
}
