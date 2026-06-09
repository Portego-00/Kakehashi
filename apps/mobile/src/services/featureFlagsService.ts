import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const FEATURE_FLAGS_CACHE_KEY = 'feature_flags_cache';
const USER_OVERRIDES_CACHE_KEY = 'feature_flags_user_overrides_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export interface FeatureFlag {
  id: string;
  flag_key: string;
  enabled: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeatureFlagUserOverride {
  id: string;
  flag_key: string;
  user_email: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface FeatureFlagsCache {
  flags: Record<string, boolean>;
  timestamp: number;
}

interface UserOverridesCache {
  overrides: FeatureFlagUserOverride[];
  timestamp: number;
}

// Default feature flags (fallback if network fails or table doesn't exist)
const DEFAULT_FLAGS: Record<string, boolean> = {
  show_songs_tab: true,
  cache_management: true, // Default true until Supabase overrides it
};

type FlagChangeListener = (flags: Record<string, boolean>) => void;

class FeatureFlagsService {
  private cache: Record<string, boolean> = { ...DEFAULT_FLAGS };
  private userOverrides: FeatureFlagUserOverride[] = [];
  private lastFetch: number = 0;
  private lastOverridesFetch: number = 0;
  private isFetching: boolean = false;
  private listeners: Set<FlagChangeListener> = new Set();

  /**
   * Subscribe to flag changes
   */
  subscribe(listener: FlagChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of flag changes
   */
  private notifyListeners(): void {
    const currentFlags = { ...this.cache };
    this.listeners.forEach(listener => {
      try {
        listener(currentFlags);
      } catch {
        // Silent failure for listener errors
      }
    });
  }

  /**
   * Initialize the service by loading cached flags
   */
  async initialize(): Promise<void> {
    try {
      // Load cached global flags
      const cached = await this.loadFromCache();
      if (cached) {
        this.cache = cached.flags;
        this.lastFetch = cached.timestamp;
      }

      // Load cached user overrides
      const cachedOverrides = await this.loadUserOverridesFromCache();
      if (cachedOverrides) {
        this.userOverrides = cachedOverrides.overrides;
        this.lastOverridesFetch = cachedOverrides.timestamp;
      }

      // Fetch fresh flags immediately
      await this.fetchFlags(true);
      await this.fetchUserOverrides(true);
    } catch {
      // Silent failure for initialization errors
    }
  }

  /**
   * Get a feature flag value (global, not user-specific)
   */
  isEnabled(flagKey: string): boolean {
    return this.cache[flagKey] ?? DEFAULT_FLAGS[flagKey] ?? false;
  }

  /**
   * Get a feature flag value for a specific user
   * Checks user overrides first, then falls back to global flag
   *
   * @param flagKey - The feature flag key
   * @param userEmail - The user's email (gravatar email) to check for overrides
   * @returns true if the flag is enabled for this user
   */
  isEnabledForUser(flagKey: string, userEmail: string | null | undefined): boolean {
    // Check user override first
    if (userEmail) {
      const normalizedEmail = userEmail.toLowerCase().trim();
      const override = this.userOverrides.find(
        (o) => o.flag_key === flagKey && o.user_email.toLowerCase().trim() === normalizedEmail
      );

      if (override) {
        return override.enabled;
      }
    }

    // Fall back to global flag
    return this.isEnabled(flagKey);
  }

  /**
   * Fetch feature flags from Supabase
   */
  async fetchFlags(forceRefresh: boolean = false): Promise<void> {
    // Prevent multiple simultaneous fetches
    if (this.isFetching) {
      return;
    }

    // Check if cache is still valid
    const now = Date.now();
    if (!forceRefresh && now - this.lastFetch < CACHE_DURATION) {
      return;
    }

    try {
      this.isFetching = true;

      const { data, error } = await supabase
        .from('feature_flags')
        .select('*');

      if (error) {
        throw error;
      }

      if (data) {
        // Convert array to key-value map
        const flagsMap: Record<string, boolean> = {};
        data.forEach((flag: FeatureFlag) => {
          flagsMap[flag.flag_key] = flag.enabled;
        });

        this.cache = { ...DEFAULT_FLAGS, ...flagsMap };
        this.lastFetch = now;

        // Save to cache
        await this.saveToCache({
          flags: this.cache,
          timestamp: now,
        });

        // Notify listeners
        this.notifyListeners();
      }
    } catch {
      // Keep using cached values on error
    } finally {
      this.isFetching = false;
    }
  }

  /**
   * Fetch user overrides from Supabase
   */
  async fetchUserOverrides(forceRefresh: boolean = false): Promise<void> {
    // Check if cache is still valid
    const now = Date.now();
    if (!forceRefresh && now - this.lastOverridesFetch < CACHE_DURATION) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('feature_flag_user_overrides')
        .select('*');

      if (error) {
        // Table might not exist yet - this is fine, just continue
        return;
      }

      if (data) {
        this.userOverrides = data as FeatureFlagUserOverride[];
        this.lastOverridesFetch = now;

        // Save to cache
        await this.saveUserOverridesToCache({
          overrides: this.userOverrides,
          timestamp: now,
        });

        // Notify listeners
        this.notifyListeners();
      }
    } catch {
      // Keep using cached values on error
    }
  }

  /**
   * Refresh flags (force fetch from server)
   */
  async refresh(): Promise<void> {
    await Promise.all([
      this.fetchFlags(true),
      this.fetchUserOverrides(true),
    ]);
  }

  /**
   * Get all current flags
   */
  getAllFlags(): Record<string, boolean> {
    return { ...this.cache };
  }

  /**
   * Get all user overrides
   */
  getAllUserOverrides(): FeatureFlagUserOverride[] {
    return [...this.userOverrides];
  }

  /**
   * Load flags from AsyncStorage cache
   */
  private async loadFromCache(): Promise<FeatureFlagsCache | null> {
    try {
      const cached = await AsyncStorage.getItem(FEATURE_FLAGS_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Silent failure for cache loading
    }
    return null;
  }

  /**
   * Save flags to AsyncStorage cache
   */
  private async saveToCache(cache: FeatureFlagsCache): Promise<void> {
    try {
      await AsyncStorage.setItem(FEATURE_FLAGS_CACHE_KEY, JSON.stringify(cache));
    } catch {
      // Silent failure for cache saving
    }
  }

  /**
   * Load user overrides from AsyncStorage cache
   */
  private async loadUserOverridesFromCache(): Promise<UserOverridesCache | null> {
    try {
      const cached = await AsyncStorage.getItem(USER_OVERRIDES_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Silent failure for cache loading
    }
    return null;
  }

  /**
   * Save user overrides to AsyncStorage cache
   */
  private async saveUserOverridesToCache(cache: UserOverridesCache): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_OVERRIDES_CACHE_KEY, JSON.stringify(cache));
    } catch {
      // Silent failure for cache saving
    }
  }
}

// Export singleton instance
export const featureFlagsService = new FeatureFlagsService();
