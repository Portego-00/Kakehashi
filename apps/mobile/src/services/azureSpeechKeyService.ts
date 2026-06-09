import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const AZURE_SPEECH_KEY_CACHE_KEY = 'azure_speech_active_key_cache_v1';

interface AzureSpeechKeyRpcRow {
  key_id: string;
  subscription_key: string;
  region: string;
  version: number;
  rotated?: boolean;
}

interface AzureSpeechKeyCachePayload {
  keyId: string;
  subscriptionKey: string;
  region: string;
  version: number;
  cachedAt: number;
}

export interface AzureSpeechActiveKey {
  keyId: string;
  subscriptionKey: string;
  region: string;
  version: number;
}

export interface AzureSpeechRotateResult {
  key: AzureSpeechActiveKey;
  rotated: boolean;
}

class AzureSpeechKeyService {
  private activeKey: AzureSpeechActiveKey | null = null;
  private loadPromise: Promise<AzureSpeechActiveKey> | null = null;
  private rotationPromise: Promise<AzureSpeechRotateResult> | null = null;

  async initialize(): Promise<void> {
    await this.getActiveKey();
  }

  async getActiveKey(): Promise<AzureSpeechActiveKey> {
    if (this.activeKey) {
      return this.activeKey;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = (async () => {
      const cached = await this.loadFromCache();
      if (cached) {
        this.activeKey = cached;
        // Keep startup fast: refresh in background when cache exists.
        void this.refreshActiveKeyFromServer().catch((error) => {
          console.warn('Azure Speech key background refresh failed:', error);
        });
        return cached;
      }

      return this.refreshActiveKeyFromServer();
    })();

    try {
      return await this.loadPromise;
    } finally {
      this.loadPromise = null;
    }
  }

  async refreshActiveKeyFromServer(): Promise<AzureSpeechActiveKey> {
    const { data, error } = await supabase.rpc('get_active_azure_speech_key');

    if (error) {
      throw new Error(
        `Failed to fetch active Azure Speech key: ${error.message}`
      );
    }

    const { key } = this.parseRpcResult(data, 'get_active_azure_speech_key');
    await this.saveActiveKey(key);
    return key;
  }

  async rotateAfterQuotaExceeded(
    observedVersion: number,
    failedKeyId: string
  ): Promise<AzureSpeechRotateResult> {
    if (this.rotationPromise) {
      return this.rotationPromise;
    }

    this.rotationPromise = (async () => {
      try {
        const { data, error } = await supabase.rpc(
          'rotate_azure_speech_key_on_quota',
          {
            p_observed_version: observedVersion,
            p_failed_key_id: failedKeyId,
          }
        );

        if (error) {
          throw new Error(
            `Failed to rotate Azure Speech key: ${error.message}`
          );
        }

        const { key, rotated } = this.parseRpcResult(
          data,
          'rotate_azure_speech_key_on_quota'
        );

        await this.saveActiveKey(key);

        return {
          key,
          rotated,
        };
      } catch (error) {
        console.warn('Azure Speech key rotation RPC failed, forcing refresh:', error);

        const key = await this.refreshActiveKeyFromServer();
        const changed =
          key.keyId !== failedKeyId || key.version !== observedVersion;

        return {
          key,
          rotated: changed,
        };
      }
    })();

    try {
      return await this.rotationPromise;
    } finally {
      this.rotationPromise = null;
    }
  }

  private async saveActiveKey(key: AzureSpeechActiveKey): Promise<void> {
    this.activeKey = key;

    const cachePayload: AzureSpeechKeyCachePayload = {
      keyId: key.keyId,
      subscriptionKey: key.subscriptionKey,
      region: key.region,
      version: key.version,
      cachedAt: Date.now(),
    };

    try {
      await AsyncStorage.setItem(
        AZURE_SPEECH_KEY_CACHE_KEY,
        JSON.stringify(cachePayload)
      );
    } catch (error) {
      console.warn('Failed to cache Azure Speech key:', error);
    }
  }

  private async loadFromCache(): Promise<AzureSpeechActiveKey | null> {
    try {
      const cachedRaw = await AsyncStorage.getItem(AZURE_SPEECH_KEY_CACHE_KEY);
      if (!cachedRaw) {
        return null;
      }

      const cachedParsed: unknown = JSON.parse(cachedRaw);
      if (!this.isValidCachePayload(cachedParsed)) {
        return null;
      }

      return {
        keyId: cachedParsed.keyId,
        subscriptionKey: cachedParsed.subscriptionKey,
        region: cachedParsed.region,
        version: cachedParsed.version,
      };
    } catch (error) {
      console.warn('Failed to load cached Azure Speech key:', error);
      return null;
    }
  }

  private parseRpcResult(
    payload: unknown,
    rpcName: string
  ): { key: AzureSpeechActiveKey; rotated: boolean } {
    const row = this.extractSingleRow(payload, rpcName);

    const version = this.parseVersion(row.version, rpcName);
    const rotated = typeof row.rotated === 'boolean' ? row.rotated : false;

    return {
      key: {
        keyId: row.key_id,
        subscriptionKey: row.subscription_key,
        region: row.region,
        version,
      },
      rotated,
    };
  }

  private extractSingleRow(payload: unknown, rpcName: string): AzureSpeechKeyRpcRow {
    const candidate = Array.isArray(payload) ? payload[0] : payload;

    if (!candidate || typeof candidate !== 'object') {
      throw new Error(`${rpcName} returned an unexpected payload.`);
    }

    const row = candidate as Record<string, unknown>;

    if (
      typeof row.key_id !== 'string' ||
      typeof row.subscription_key !== 'string' ||
      typeof row.region !== 'string' ||
      !this.isVersionValue(row.version)
    ) {
      throw new Error(`${rpcName} returned incomplete key data.`);
    }

    const parsed: AzureSpeechKeyRpcRow = {
      key_id: row.key_id,
      subscription_key: row.subscription_key,
      region: row.region,
      version:
        typeof row.version === 'number'
          ? row.version
          : Number(row.version),
      rotated: typeof row.rotated === 'boolean' ? row.rotated : undefined,
    };

    return parsed;
  }

  private parseVersion(versionValue: unknown, rpcName: string): number {
    const parsedVersion =
      typeof versionValue === 'number' ? versionValue : Number(versionValue);

    if (!Number.isFinite(parsedVersion)) {
      throw new Error(`${rpcName} returned a non-numeric key version.`);
    }

    return Math.trunc(parsedVersion);
  }

  private isVersionValue(value: unknown): value is number | string {
    if (typeof value === 'number') {
      return Number.isFinite(value);
    }

    if (typeof value === 'string') {
      return value.trim().length > 0 && Number.isFinite(Number(value));
    }

    return false;
  }

  private isValidCachePayload(value: unknown): value is AzureSpeechKeyCachePayload {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const payload = value as Record<string, unknown>;
    return (
      typeof payload.keyId === 'string' &&
      typeof payload.subscriptionKey === 'string' &&
      typeof payload.region === 'string' &&
      typeof payload.version === 'number' &&
      Number.isFinite(payload.version) &&
      typeof payload.cachedAt === 'number' &&
      Number.isFinite(payload.cachedAt)
    );
  }
}

export const azureSpeechKeyService = new AzureSpeechKeyService();
