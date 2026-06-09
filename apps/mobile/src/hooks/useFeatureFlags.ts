import { useEffect, useState } from 'react';
import { featureFlagsService } from '../services/featureFlagsService';

/**
 * Hook to check if a feature flag is enabled
 * @param flagKey - The feature flag key to check
 * @returns boolean indicating if the flag is enabled
 */
export function useFeatureFlag(flagKey: string): boolean {
  const [isEnabled, setIsEnabled] = useState(() =>
    featureFlagsService.isEnabled(flagKey)
  );

  useEffect(() => {
    // Subscribe to flag changes
    const unsubscribe = featureFlagsService.subscribe((flags) => {
      const newValue = flags[flagKey] ?? featureFlagsService.isEnabled(flagKey);
      setIsEnabled(newValue);
    });

    // Update immediately with current value
    setIsEnabled(featureFlagsService.isEnabled(flagKey));

    // Set up periodic refresh (check every 10 seconds for faster updates during testing)
    const interval = setInterval(() => {
      featureFlagsService.fetchFlags().catch(() => {
        // Silent failure for periodic refresh
      });
    }, 10000);

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [flagKey]);

  return isEnabled;
}

/**
 * Hook to get all feature flags
 * @returns Record of all feature flags
 */
export function useAllFeatureFlags(): Record<string, boolean> {
  const [flags, setFlags] = useState(() => featureFlagsService.getAllFlags());

  useEffect(() => {
    // Subscribe to flag changes
    const unsubscribe = featureFlagsService.subscribe((newFlags) => {
      setFlags(newFlags);
    });

    // Update immediately with current flags
    setFlags(featureFlagsService.getAllFlags());

    // Set up periodic refresh (check every 10 seconds)
    const interval = setInterval(() => {
      featureFlagsService.fetchFlags().catch(() => {
        // Silent failure for periodic refresh
      });
    }, 10000);

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  return flags;
}
