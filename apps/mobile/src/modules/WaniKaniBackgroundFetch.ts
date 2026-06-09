import { NativeModules, Platform } from 'react-native';
import { isIOSOnMac } from '../utils/platformSupport';

interface BackgroundFetchStatus {
  lastFetchTime: string;
  timeSinceLastFetch: string;
  currentReviewCount: number;
  hasApiToken: boolean;
  badgeEnabled: boolean;
}

interface BackgroundFetchResult {
  result: 'newData' | 'noData' | 'failed';
  reviewCount: number;
  timestamp: string;
}

interface WaniKaniBackgroundFetchModule {
  storeApiToken(apiToken: string): void;
  updateNotificationSettings(settings: {
    badgeEnabled: boolean;
    alertsEnabled: boolean;
    soundsEnabled: boolean;
  }): void;
  getBackgroundFetchStatus(): BackgroundFetchStatus;
  triggerBackgroundFetchManually(): Promise<BackgroundFetchResult>;
}

const { WaniKaniBackgroundFetch } = NativeModules;

// Export module with platform check
export default (
  Platform.OS === 'ios' && !isIOSOnMac() ? WaniKaniBackgroundFetch : null
) as WaniKaniBackgroundFetchModule | null;
