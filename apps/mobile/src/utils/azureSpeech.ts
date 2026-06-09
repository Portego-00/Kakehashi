import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from '@/src/utils/expoAvCompat';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import AudioSessionManager from '../modules/AudioSessionManager';
import {
  azureSpeechKeyService,
  type AzureSpeechActiveKey,
} from '../services/azureSpeechKeyService';

const AZURE_DEFAULTS = {
  region: 'eastus',
  defaultVoice: 'ja-JP-NanamiNeural',
};

class AzureSpeechHttpError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: string;

  constructor(
    message: string,
    status: number,
    statusText: string,
    body: string
  ) {
    super(message);
    this.name = 'AzureSpeechHttpError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

export interface AzureVoice {
  name: string;
  displayName: string;
  localName: string;
  shortName: string;
  gender: string;
  locale: string;
  styleList?: string[];
}

export interface AzureConfig {
  subscriptionKey: string;
  region: string;
  selectedVoice: string;
  activeKeyId?: string;
  keyVersion?: number;
}

export interface AzureSpeechOptions {
  speedMultiplier?: number;
}

// High-quality Japanese Neural voices from Azure
export const JAPANESE_VOICES: AzureVoice[] = [
  {
    name: 'Microsoft Server Speech Text to Speech Voice (ja-JP, NanamiNeural)',
    displayName: 'Nanami (Female)',
    localName: 'ななみ',
    shortName: 'ja-JP-NanamiNeural',
    gender: 'Female',
    locale: 'ja-JP',
    styleList: ['general'],
  },
  {
    name: 'Microsoft Server Speech Text to Speech Voice (ja-JP, KeitaNeural)',
    displayName: 'Keita (Male)',
    localName: 'けいた',
    shortName: 'ja-JP-KeitaNeural',
    gender: 'Male',
    locale: 'ja-JP',
    styleList: ['general'],
  },
  {
    name: 'Microsoft Server Speech Text to Speech Voice (ja-JP, AoiNeural)',
    displayName: 'Aoi (Female)',
    localName: 'あおい',
    shortName: 'ja-JP-AoiNeural',
    gender: 'Female',
    locale: 'ja-JP',
    styleList: ['general'],
  },
  {
    name: 'Microsoft Server Speech Text to Speech Voice (ja-JP, DaichiNeural)',
    displayName: 'Daichi (Male)',
    localName: 'だいち',
    shortName: 'ja-JP-DaichiNeural',
    gender: 'Male',
    locale: 'ja-JP',
    styleList: ['general'],
  },
  {
    name: 'Microsoft Server Speech Text to Speech Voice (ja-JP, MayuNeural)',
    displayName: 'Mayu (Female)',
    localName: 'まゆ',
    shortName: 'ja-JP-MayuNeural',
    gender: 'Female',
    locale: 'ja-JP',
    styleList: ['general'],
  },
  {
    name: 'Microsoft Server Speech Text to Speech Voice (ja-JP, NaokiNeural)',
    displayName: 'Naoki (Male)',
    localName: 'なおき',
    shortName: 'ja-JP-NaokiNeural',
    gender: 'Male',
    locale: 'ja-JP',
    styleList: ['general'],
  },
  {
    name: 'Microsoft Server Speech Text to Speech Voice (ja-JP, ShioriNeural)',
    displayName: 'Shiori (Female)',
    localName: 'しおり',
    shortName: 'ja-JP-ShioriNeural',
    gender: 'Female',
    locale: 'ja-JP',
    styleList: ['general'],
  },
];

export class AzureSpeechService {
  private config: AzureConfig;
  private currentSound: any = null;
  private isSpeaking = false;
  private hasLoadedSelectedVoice = false;
  private selectedVoiceLoadPromise: Promise<void> | null = null;
  private activeKeyLoadPromise: Promise<void> | null = null;

  constructor() {
    this.config = {
      subscriptionKey: '',
      region: AZURE_DEFAULTS.region,
      selectedVoice: AZURE_DEFAULTS.defaultVoice,
    };

    // Load selected voice eagerly for existing UI behavior.
    void this.loadSelectedVoice();
  }

  async initialize(): Promise<void> {
    await Promise.all([
      this.loadSelectedVoice(),
      this.ensureActiveKeyLoaded(),
    ]);
  }

  async loadSelectedVoice(): Promise<void> {
    if (this.hasLoadedSelectedVoice) {
      return;
    }

    if (this.selectedVoiceLoadPromise) {
      return this.selectedVoiceLoadPromise;
    }

    this.selectedVoiceLoadPromise = (async () => {
      try {
        const savedVoice = await AsyncStorage.getItem('azure_selected_voice');
        if (savedVoice) {
          this.config.selectedVoice = savedVoice;
        }
      } catch {
        console.log(
          'No saved voice found, using default:',
          AZURE_DEFAULTS.defaultVoice
        );
      } finally {
        this.hasLoadedSelectedVoice = true;
      }
    })();

    try {
      await this.selectedVoiceLoadPromise;
    } finally {
      this.selectedVoiceLoadPromise = null;
    }
  }

  async saveSelectedVoice(voiceShortName: string): Promise<void> {
    try {
      await AsyncStorage.setItem('azure_selected_voice', voiceShortName);
      this.config.selectedVoice = voiceShortName;
      console.log('Selected voice saved:', voiceShortName);
    } catch (error) {
      console.error('Error saving selected voice:', error);
    }
  }

  getConfig(): AzureConfig {
    return {
      ...this.config,
    };
  }

  private async ensureActiveKeyLoaded(forceRefresh: boolean = false): Promise<void> {
    const hasKey = Boolean(
      this.config.subscriptionKey &&
        this.config.activeKeyId &&
        typeof this.config.keyVersion === 'number'
    );

    if (!forceRefresh && hasKey) {
      return;
    }

    if (this.activeKeyLoadPromise) {
      return this.activeKeyLoadPromise;
    }

    this.activeKeyLoadPromise = (async () => {
      const activeKey = forceRefresh
        ? await azureSpeechKeyService.refreshActiveKeyFromServer()
        : await azureSpeechKeyService.getActiveKey();
      this.applyActiveKey(activeKey);
    })();

    try {
      await this.activeKeyLoadPromise;
    } finally {
      this.activeKeyLoadPromise = null;
    }
  }

  private applyActiveKey(activeKey: AzureSpeechActiveKey): void {
    this.config.subscriptionKey = activeKey.subscriptionKey;
    this.config.region = activeKey.region;
    this.config.activeKeyId = activeKey.keyId;
    this.config.keyVersion = activeKey.version;
  }

  private async getAccessToken(): Promise<string> {
    await this.ensureActiveKeyLoaded();

    if (!this.config.subscriptionKey) {
      throw new Error('Azure Speech key is not configured.');
    }

    const tokenEndpoint = `https://${this.config.region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;

    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) {
          throw new AzureSpeechHttpError(
            'Azure subscription key may be expired or invalid.',
            response.status,
            response.statusText,
            errorText
          );
        }

        throw new AzureSpeechHttpError(
          `Token request failed: ${response.status} ${response.statusText}`,
          response.status,
          response.statusText,
          errorText
        );
      }

      return await response.text();
    } catch (error) {
      console.error('Error getting access token:', error);
      throw error;
    }
  }

  async validateConfiguration(): Promise<boolean> {
    try {
      await this.initialize();
      await this.getAccessToken();
      return true;
    } catch (error) {
      console.warn('Azure Speech configuration validation failed:', error);
      return false;
    }
  }

  async speak(
    text: string,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (error: unknown) => void,
    options?: AzureSpeechOptions
  ): Promise<void> {
    let playbackCompleted = false;
    let hasStartedPlayback = false;

    try {
      await this.initialize();

      console.log(
        `Azure Speech: Starting to speak "${text}" with voice ${this.config.selectedVoice}`
      );

      // Stop any currently playing audio
      await this.stop();

      onStart?.();
      hasStartedPlayback = true;
      this.isSpeaking = true;

      await this.synthesizeWithRotationRetry(text, options);
      playbackCompleted = true;
    } catch (error) {
      console.error('Azure Speech Error. Falling back to expo-speech:', error);

      try {
        await this.stop();

        if (!hasStartedPlayback) {
          onStart?.();
          hasStartedPlayback = true;
        }

        this.isSpeaking = true;
        await this.speakWithExpoFallback(text, options);
        playbackCompleted = true;
      } catch (fallbackError) {
        console.error('Expo speech fallback failed:', fallbackError);
        onError?.(fallbackError);
      }
    } finally {
      this.isSpeaking = false;

      if (playbackCompleted) {
        console.log('TTS playback completed');
        onEnd?.();
      }
    }
  }

  private async synthesizeWithRotationRetry(
    text: string,
    options?: AzureSpeechOptions
  ): Promise<void> {
    try {
      await this.synthesizeAndPlay(text, options);
      return;
    } catch (error) {
      if (!this.isQuotaExceededError(error)) {
        throw error;
      }

      const failedKeyId = this.config.activeKeyId;
      const observedVersion = this.config.keyVersion;

      if (!failedKeyId || typeof observedVersion !== 'number') {
        throw error;
      }

      const rotateResult = await azureSpeechKeyService.rotateAfterQuotaExceeded(
        observedVersion,
        failedKeyId
      );

      const keyChanged =
        rotateResult.key.keyId !== failedKeyId ||
        rotateResult.key.version !== observedVersion;

      if (!rotateResult.rotated && !keyChanged) {
        throw new Error(
          'Azure Speech quota exceeded and no standby API key is available.'
        );
      }

      this.applyActiveKey(rotateResult.key);

      console.warn(
        `Azure Speech quota exceeded. Rotated key to ${rotateResult.key.keyId} (version ${rotateResult.key.version}). Retrying synthesis.`
      );

      await this.synthesizeAndPlay(text, options);
    }
  }

  private isQuotaExceededError(error: unknown): boolean {
    if (error instanceof AzureSpeechHttpError) {
      return error.status === 429;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('429') || message.includes('quota exceeded');
    }

    return false;
  }

  private async synthesizeAndPlay(
    text: string,
    options?: AzureSpeechOptions
  ): Promise<void> {
    const accessToken = await this.getAccessToken();
    console.log('Azure Speech: Access token obtained');

    const ssml = this.buildSsml(text, options);
    console.log('Azure Speech: Generated SSML:', ssml);

    const speechEndpoint =
      `https://${this.config.region}.tts.speech.microsoft.com/cognitiveservices/v1`;

    const response = await fetch(speechEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-160kbitrate-mono-mp3',
        'User-Agent': 'WaniKani-RN-App',
      },
      body: ssml,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AzureSpeechHttpError(
        `Speech synthesis failed: ${response.status} ${response.statusText}`,
        response.status,
        response.statusText,
        errorText
      );
    }

    console.log('Azure Speech: Speech synthesis successful');

    const audioBlob = await response.blob();
    const base64Audio = await this.blobToBase64(audioBlob);
    await this.playAudio(base64Audio);
  }

  private getClampedSpeechRate(options?: AzureSpeechOptions): number {
    const speedMultiplier = options?.speedMultiplier ?? 1;
    return Math.max(0.5, Math.min(1.8, 0.9 * speedMultiplier));
  }

  private async speakWithExpoFallback(
    text: string,
    options?: AzureSpeechOptions
  ): Promise<void> {
    const fallbackText =
      text.length > Speech.maxSpeechInputLength
        ? text.slice(0, Speech.maxSpeechInputLength)
        : text;

    if (fallbackText.length !== text.length) {
      console.warn(
        `expo-speech fallback text was truncated to ${Speech.maxSpeechInputLength} characters.`
      );
    }

    const rate = this.getClampedSpeechRate(options);

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const safeResolve = () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      };

      const safeReject = (error: unknown) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(error);
      };

      try {
        Speech.speak(fallbackText, {
          language: 'ja-JP',
          rate,
          onDone: safeResolve,
          onStopped: safeResolve,
          onError: (error) => safeReject(error),
        });
      } catch (error) {
        safeReject(error);
      }
    });
  }

  private buildSsml(text: string, options?: AzureSpeechOptions): string {
    const clampedRate = this.getClampedSpeechRate(options);
    const ratePercentage = Math.round((clampedRate - 1) * 100);
    const rateValue = `${ratePercentage >= 0 ? '+' : ''}${ratePercentage}%`;

    return `
        <speak version='1.0' xml:lang='ja-JP'>
          <voice xml:lang='ja-JP' xml:gender='Female' name='${this.config.selectedVoice}'>
            <prosody rate='${rateValue}' pitch='0%'>
              ${text}
            </prosody>
          </voice>
        </speak>
      `;
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private async playAudio(base64Audio: string): Promise<void> {
    try {
      if (Platform.OS === 'ios') {
        try {
          await AudioSessionManager.overrideSpeaker();
          console.log(
            'Audio session overridden to use speaker before Azure TTS playback'
          );
        } catch (error) {
          console.warn('Failed to override audio session:', error);
        }
      }

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mp3;base64,${base64Audio}` },
        { shouldPlay: true }
      );

      this.currentSound = sound;

      return new Promise((resolve, reject) => {
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            if (status.didJustFinish) {
              console.log('Azure Speech: Audio playback finished');
              resolve();
            }
          } else if (!status.isLoaded && status.error) {
            console.error('Azure Speech: Audio playback error:', status.error);
            reject(new Error(status.error));
          }
        });
      });
    } catch (error) {
      console.error('Azure Speech: Audio playback error:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.speak('テスト');
      return true;
    } catch (error) {
      console.error('Azure Speech connection test failed:', error);
      return false;
    }
  }

  async stop(): Promise<void> {
    try {
      await Speech.stop();
    } catch (error) {
      console.error('Error stopping expo speech fallback:', error);
    }

    if (this.currentSound) {
      try {
        await this.currentSound.stopAsync();
        await this.currentSound.unloadAsync();
        this.currentSound = null;
        console.log('Azure Speech: Stopped and unloaded current audio');
      } catch (error) {
        console.error('Error stopping Azure speech audio:', error);
      }
    }

    this.isSpeaking = false;
  }

  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }
}

export const azureSpeechService = new AzureSpeechService();
