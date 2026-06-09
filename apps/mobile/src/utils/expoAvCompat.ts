import {
  createAudioPlayer,
  setAudioModeAsync as setExpoAudioModeAsync,
  type AudioMode as ExpoAudioMode,
  type AudioPlayer,
  type AudioPlayerOptions,
  type AudioSource,
  type AudioStatus as ExpoAudioStatus,
  type InterruptionMode,
} from 'expo-audio';

export const InterruptionModeIOS = {
  MixWithOthers: 'mixWithOthers',
  DoNotMix: 'doNotMix',
  DuckOthers: 'duckOthers',
} as const;

export const InterruptionModeAndroid = {
  MixWithOthers: 'mixWithOthers',
  DoNotMix: 'doNotMix',
  DuckOthers: 'duckOthers',
} as const;

type LegacyAudioMode = Partial<ExpoAudioMode> & {
  allowsRecordingIOS?: boolean;
  interruptionModeIOS?: InterruptionMode;
  playsInSilentModeIOS?: boolean;
  staysActiveInBackground?: boolean;
  shouldDuckAndroid?: boolean;
  playThroughEarpieceAndroid?: boolean;
};

export type AVPlaybackSource = AudioSource;

type AVPlaybackStatusSuccess = {
  isLoaded: true;
  progressUpdateIntervalMillis: number;
  shouldPlay: boolean;
  isPlaying: boolean;
  isBuffering: boolean;
  rate: number;
  shouldCorrectPitch: boolean;
  volume: number;
  isMuted: boolean;
  isLooping: boolean;
  didJustFinish: boolean;
  positionMillis: number;
  durationMillis: number | null;
};

type AVPlaybackStatusError = {
  isLoaded: false;
  error?: string;
};

export type AVPlaybackStatus = AVPlaybackStatusSuccess | AVPlaybackStatusError;

type AVPlaybackStatusToSet = {
  shouldPlay?: boolean;
  duckOthers?: boolean;
  isLooping?: boolean;
  isMuted?: boolean;
  volume?: number;
  rate?: number;
  shouldCorrectPitch?: boolean;
  positionMillis?: number;
  progressUpdateIntervalMillis?: number;
};

const DEFAULT_PROGRESS_UPDATE_INTERVAL_MS = 100;
const DEFAULT_DUCK_OTHERS = true;

let configuredAudioMode: LegacyAudioMode = {};
let audioModeUpdateChain: Promise<void> = Promise.resolve();
let nextSoundId = 1;
const activeAutoDuckSoundIds = new Set<number>();

function toNumberOrDefault(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getLegacyDuckInterruptionMode(shouldDuck: boolean): InterruptionMode {
  return shouldDuck
    ? InterruptionModeAndroid.DuckOthers
    : InterruptionModeAndroid.DoNotMix;
}

function mapAudioMode(mode: LegacyAudioMode): Partial<ExpoAudioMode> {
  const mapped: Partial<ExpoAudioMode> = {};

  if (typeof mode.playsInSilentMode === 'boolean') {
    mapped.playsInSilentMode = mode.playsInSilentMode;
  } else if (typeof mode.playsInSilentModeIOS === 'boolean') {
    mapped.playsInSilentMode = mode.playsInSilentModeIOS;
  }

  if (mode.interruptionMode) {
    mapped.interruptionMode = mode.interruptionMode;
  } else if (mode.interruptionModeIOS) {
    mapped.interruptionMode = mode.interruptionModeIOS;
  } else if (mode.interruptionModeAndroid) {
    mapped.interruptionMode = mode.interruptionModeAndroid;
  } else {
    mapped.interruptionMode = InterruptionModeIOS.MixWithOthers;
  }

  if (mode.interruptionModeAndroid) {
    mapped.interruptionModeAndroid = mode.interruptionModeAndroid;
  } else if (typeof mode.shouldDuckAndroid === 'boolean') {
    mapped.interruptionModeAndroid = getLegacyDuckInterruptionMode(mode.shouldDuckAndroid);
  }

  if (typeof mode.allowsRecording === 'boolean') {
    mapped.allowsRecording = mode.allowsRecording;
  } else if (typeof mode.allowsRecordingIOS === 'boolean') {
    mapped.allowsRecording = mode.allowsRecordingIOS;
  }

  if (typeof mode.shouldPlayInBackground === 'boolean') {
    mapped.shouldPlayInBackground = mode.shouldPlayInBackground;
  } else if (typeof mode.staysActiveInBackground === 'boolean') {
    mapped.shouldPlayInBackground = mode.staysActiveInBackground;
  }

  if (typeof mode.shouldRouteThroughEarpiece === 'boolean') {
    mapped.shouldRouteThroughEarpiece = mode.shouldRouteThroughEarpiece;
  } else if (typeof mode.playThroughEarpieceAndroid === 'boolean') {
    mapped.shouldRouteThroughEarpiece = mode.playThroughEarpieceAndroid;
  }

  if (typeof mode.allowsBackgroundRecording === 'boolean') {
    mapped.allowsBackgroundRecording = mode.allowsBackgroundRecording;
  }

  return mapped;
}

function getManagedAudioMode(): LegacyAudioMode {
  const shouldDuck = activeAutoDuckSoundIds.size > 0;

  return {
    ...configuredAudioMode,
    interruptionMode: shouldDuck
      ? InterruptionModeIOS.DuckOthers
      : InterruptionModeIOS.MixWithOthers,
    interruptionModeIOS: shouldDuck
      ? InterruptionModeIOS.DuckOthers
      : InterruptionModeIOS.MixWithOthers,
    interruptionModeAndroid: shouldDuck
      ? InterruptionModeAndroid.DuckOthers
      : InterruptionModeAndroid.MixWithOthers,
    shouldDuckAndroid: shouldDuck,
  };
}

function queueAudioModeUpdate(): void {
  audioModeUpdateChain = audioModeUpdateChain
    .catch(() => undefined)
    .then(async () => {
      await setExpoAudioModeAsync(mapAudioMode(getManagedAudioMode()));
    })
    .catch((error) => {
      console.warn('[Audio] Failed to update audio mode:', error);
    });
}

function updateAutoDuckPlayback(soundId: number, isPlaying: boolean): void {
  const currentlyPlaying = activeAutoDuckSoundIds.has(soundId);
  if (currentlyPlaying === isPlaying) {
    return;
  }

  if (isPlaying) {
    activeAutoDuckSoundIds.add(soundId);
  } else {
    activeAutoDuckSoundIds.delete(soundId);
  }

  queueAudioModeUpdate();
}

function unregisterAutoDuckSound(soundId: number): void {
  if (!activeAutoDuckSoundIds.delete(soundId)) {
    return;
  }
  queueAudioModeUpdate();
}

function toPlaybackStatus(
  status: ExpoAudioStatus,
  progressUpdateIntervalMillis: number,
  player: AudioPlayer,
): AVPlaybackStatus {
  if (!status.isLoaded) {
    return {
      isLoaded: false,
    };
  }

  const durationMillis =
    typeof status.duration === 'number' && status.duration > 0
      ? Math.round(status.duration * 1000)
      : null;

  return {
    isLoaded: true,
    progressUpdateIntervalMillis,
    shouldPlay: status.playing,
    isPlaying: status.playing,
    isBuffering: status.isBuffering,
    rate: status.playbackRate,
    shouldCorrectPitch: status.shouldCorrectPitch,
    volume: player.volume,
    isMuted: status.mute,
    isLooping: status.loop,
    didJustFinish: status.didJustFinish,
    positionMillis: Math.round(status.currentTime * 1000),
    durationMillis,
  };
}

class AudioSoundCompat {
  private readonly soundId = nextSoundId++;
  private readonly duckOthers: boolean;
  private isMarkedPlaying = false;
  private player: AudioPlayer | null;
  private statusSubscription: { remove: () => void } | null = null;
  private statusListener: ((status: AVPlaybackStatus) => void) | null = null;
  private progressUpdateIntervalMillis = DEFAULT_PROGRESS_UPDATE_INTERVAL_MS;

  constructor(
    source: AVPlaybackSource,
    initialStatus: AVPlaybackStatusToSet = {},
    onPlaybackStatusUpdate: ((status: AVPlaybackStatus) => void) | null = null,
    duckOthers = DEFAULT_DUCK_OTHERS,
  ) {
    this.duckOthers = duckOthers;

    this.progressUpdateIntervalMillis = Math.max(
      50,
      toNumberOrDefault(
        initialStatus.progressUpdateIntervalMillis,
        DEFAULT_PROGRESS_UPDATE_INTERVAL_MS,
      ),
    );

    const options: AudioPlayerOptions = {
      updateInterval: this.progressUpdateIntervalMillis,
      keepAudioSessionActive: true,
    };

    this.player = createAudioPlayer(source ?? null, options);

    if (typeof initialStatus.isLooping === 'boolean') {
      this.player.loop = initialStatus.isLooping;
    }
    if (typeof initialStatus.isMuted === 'boolean') {
      this.player.muted = initialStatus.isMuted;
    }
    if (typeof initialStatus.volume === 'number') {
      this.player.volume = initialStatus.volume;
    }
    if (typeof initialStatus.rate === 'number') {
      try {
        this.player.playbackRate = initialStatus.rate;
      } catch {
        // Some sources reject playback rate changes before they are fully loaded.
      }
    }
    if (typeof initialStatus.shouldCorrectPitch === 'boolean') {
      try {
        this.player.shouldCorrectPitch = initialStatus.shouldCorrectPitch;
      } catch {
        // Ignore pitch-correction assignment failures for early-loading states.
      }
    }
    if (typeof initialStatus.positionMillis === 'number') {
      void this.seekToAsync(this.player, initialStatus.positionMillis);
    }

    this.statusSubscription = this.player.addListener('playbackStatusUpdate', (status) => {
      const currentPlayer = this.player;
      if (!currentPlayer) {
        return;
      }
      const playbackStatus = toPlaybackStatus(
        status,
        this.progressUpdateIntervalMillis,
        currentPlayer,
      );
      this.syncPlayingState(playbackStatus);
      this.emitStatus(playbackStatus);
    });

    this.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
  }

  static async createAsync(
    source: AVPlaybackSource,
    initialStatus: AVPlaybackStatusToSet = {},
    onPlaybackStatusUpdate: ((status: AVPlaybackStatus) => void) | null = null,
  ): Promise<{ sound: AudioSoundCompat; status: AVPlaybackStatus }> {
    const {
      shouldPlay = false,
      duckOthers = DEFAULT_DUCK_OTHERS,
      ...initialStatusWithoutCreateFlags
    } = initialStatus;
    const sound = new AudioSoundCompat(
      source,
      initialStatusWithoutCreateFlags,
      onPlaybackStatusUpdate,
      duckOthers,
    );

    if (shouldPlay) {
      await sound.playAsync();
    }

    const status = await sound.getStatusAsync();
    sound.emitStatus(status);
    return { sound, status };
  }

  setOnPlaybackStatusUpdate(
    callback: ((status: AVPlaybackStatus) => void) | null,
  ): void {
    this.statusListener = callback;
    if (callback) {
      void this.getStatusAsync().then((status) => {
        this.syncPlayingState(status);
        this.emitStatus(status);
      });
    }
  }

  async playAsync(): Promise<AVPlaybackStatus> {
    const player = this.getPlayer();
    if (!player) {
      return this.getUnloadedStatus('Sound is unloaded');
    }
    player.play();

    const status = await this.getStatusAsync();
    this.syncPlayingState(status);
    this.emitStatus(status);
    return status;
  }

  async pauseAsync(): Promise<AVPlaybackStatus> {
    const player = this.getPlayer();
    if (!player) {
      return this.getUnloadedStatus('Sound is unloaded');
    }
    player.pause();
    const status = await this.getStatusAsync();
    this.syncPlayingState(status);
    this.emitStatus(status);
    return status;
  }

  async stopAsync(): Promise<AVPlaybackStatus> {
    const player = this.getPlayer();
    if (!player) {
      return this.getUnloadedStatus('Sound is unloaded');
    }
    player.pause();
    await this.seekToAsync(player, 0);
    const status = await this.getStatusAsync();
    this.syncPlayingState(status);
    this.emitStatus(status);
    return status;
  }

  async setPositionAsync(positionMillis: number): Promise<AVPlaybackStatus> {
    const player = this.getPlayer();
    if (!player) {
      return this.getUnloadedStatus('Sound is unloaded');
    }
    await this.seekToAsync(player, positionMillis);
    const status = await this.getStatusAsync();
    this.emitStatus(status);
    return status;
  }

  async getStatusAsync(): Promise<AVPlaybackStatus> {
    const player = this.getPlayer();
    if (!player) {
      return this.getUnloadedStatus('Sound is unloaded');
    }
    return toPlaybackStatus(player.currentStatus, this.progressUpdateIntervalMillis, player);
  }

  async unloadAsync(): Promise<void> {
    if (this.duckOthers) {
      this.isMarkedPlaying = false;
      unregisterAutoDuckSound(this.soundId);
    }
    this.statusSubscription?.remove();
    this.statusSubscription = null;
    this.player?.remove();
    this.player = null;
    this.emitStatus(this.getUnloadedStatus());
  }

  private emitStatus(status: AVPlaybackStatus): void {
    this.statusListener?.(status);
  }

  private getPlayer(): AudioPlayer | null {
    return this.player;
  }

  private getUnloadedStatus(error?: string): AVPlaybackStatusError {
    return {
      isLoaded: false,
      error,
    };
  }

  private syncPlayingState(status: AVPlaybackStatus): void {
    if (!this.duckOthers) {
      return;
    }

    const isPlaying = status.isLoaded && status.isPlaying;
    if (this.isMarkedPlaying === isPlaying) {
      return;
    }

    this.isMarkedPlaying = isPlaying;
    updateAutoDuckPlayback(this.soundId, isPlaying);
  }

  private async seekToAsync(player: AudioPlayer, positionMillis: number): Promise<void> {
    const targetSeconds = Math.max(0, positionMillis) / 1000;

    try {
      await player.seekTo(targetSeconds);
    } catch {
      // Fallback for platforms where seekTo may reject while transitioning.
      try {
        player.currentTime = targetSeconds;
      } catch {
        // No-op: seeking is best effort for compatibility.
      }
    }
  }

}

export type AudioSound = AudioSoundCompat;

export async function setAudioModeAsync(mode: LegacyAudioMode): Promise<void> {
  configuredAudioMode = { ...mode };
  queueAudioModeUpdate();
  await audioModeUpdateChain;
}

export const Audio = {
  Sound: AudioSoundCompat,
  setAudioModeAsync,
} as const;
