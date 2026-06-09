/**
 * Feature Flags Utility
 *
 * Provides convenient access to feature flags from Supabase.
 * Feature flags can be targeted to specific users by their gravatar email.
 *
 * Usage:
 *   import { hasFeatureAccess } from '../utils/featureFlags';
 *
 *   // In a component:
 *   const { gravatarEmail } = useSettingsStore();
 *   if (hasFeatureAccess('cache_management', gravatarEmail)) {
 *     // Show the feature
 *   }
 *
 * To configure flags:
 *   1. Add/update flags in Supabase `feature_flags` table for global defaults
 *   2. Add user-specific overrides in `feature_flag_user_overrides` table
 */

import { featureFlagsService } from '../services/featureFlagsService';

/**
 * Known feature flag names for type safety
 */
/**
 * Known feature flag names (snake_case to match Supabase)
 */
export type FeatureFlagName =
  | 'show_songs_tab'
  | 'cache_management'
  | string; // Allow unknown flags for flexibility

/**
 * Check if a user has access to a specific feature
 *
 * @param featureName - The name of the feature flag
 * @param userEmail - The user's gravatar email (or null if not set)
 * @returns true if the user has access to the feature
 */
export function hasFeatureAccess(
  featureName: FeatureFlagName,
  userEmail: string | null | undefined
): boolean {
  return featureFlagsService.isEnabledForUser(featureName, userEmail);
}

/**
 * Check if a feature flag is globally enabled (ignoring user overrides)
 *
 * @param featureName - The name of the feature flag
 * @returns true if the flag is globally enabled
 */
export function isFeatureEnabled(featureName: FeatureFlagName): boolean {
  return featureFlagsService.isEnabled(featureName);
}

/**
 * Force refresh feature flags from Supabase
 */
export async function refreshFeatureFlags(): Promise<void> {
  return featureFlagsService.refresh();
}

/**
 * Get all current feature flags
 */
export function getAllFeatureFlags(): Record<string, boolean> {
  return featureFlagsService.getAllFlags();
}
