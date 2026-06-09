import AsyncStorage from '@react-native-async-storage/async-storage';
import { startPerformanceTimer } from './performanceLogger';
import { 
  saveToPermanentStorage, 
  getFromPermanentStorage, 
  PERMANENT_KEYS,
  removeFromPermanentStorage,
} from './permanentStorage';

// Constants
const DASHBOARD_CACHE_KEY = 'wanikani_dashboard_cache';
export const DASHBOARD_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Save dashboard data to permanent cache (survives iOS cache clearing)
 * @param data The dashboard data to cache
 */
export async function saveDashboardCache(data: any): Promise<void> {
  const timer = startPerformanceTimer('saveDashboardCache', 'dashboardCache.ts');
  
  try {
    // Minify dashboard payload before saving to avoid duplicating massive arrays
    const safeData = (() => {
      try {
        if (!data || typeof data !== 'object') return data;
        const {
          subjects: _subjects,
          assignments: _assignments,
          ...rest
        } = data;
        return {
          ...rest,
          // Preserve shape but drop heavy arrays; they can be rebuilt from consolidated caches
          subjects: Array.isArray(_subjects) ? [] : _subjects,
          assignments: Array.isArray(_assignments) ? [] : _assignments,
        };
      } catch {
        return data;
      }
    })();

    // Save to permanent storage (primary - survives iOS cache clearing)
    await saveToPermanentStorage(
      PERMANENT_KEYS.DASHBOARD_DATA, 
      safeData, 
      new Date().toISOString()
    );

    // Remove legacy snapshot so stale oversized payloads cannot be rehydrated.
    await AsyncStorage.removeItem(DASHBOARD_CACHE_KEY).catch(() => {});

    timer.end({ result: 'saved', storageType: 'permanent' });
  } catch (error: any) {
    timer.end({ error: error.message, storageType: 'permanent' }, false);
  }
}

/**
 * Get cached dashboard data from permanent storage (survives iOS cache clearing)
 * @param maxAge Optional maximum age in milliseconds (defaults to DASHBOARD_CACHE_TTL)
 * @returns The cached dashboard data or null if no valid cache exists
 */
export async function getDashboardCache(maxAge: number = DASHBOARD_CACHE_TTL): Promise<any | null> {
  const timer = startPerformanceTimer('getDashboardCache', 'dashboardCache.ts');
  
  try {
    // Try permanent storage first (new, reliable storage)
    const permanent = await getFromPermanentStorage<any>(
      PERMANENT_KEYS.DASHBOARD_DATA,
      { maxAge }
    );
    if (permanent) {
      timer.end({ result: 'hit', storageType: 'permanent', age: Date.now() - permanent.timestamp });
      return permanent.data;
    }

    // Ignore legacy AsyncStorage payloads on startup to avoid expensive JSON
    // parsing and stale-cache loops on upgraded installs.
    timer.end({ result: 'miss', storageType: 'none' });
    return null;
  } catch (error: any) {
    timer.end({ error: error.message, storageType: 'error' }, false);
    return null;
  }
}

/**
 * Clear the dashboard cache
 */
export async function clearDashboardCache(): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.removeItem(DASHBOARD_CACHE_KEY),
      removeFromPermanentStorage(PERMANENT_KEYS.DASHBOARD_DATA),
    ]);
  } catch {
    // Silent failure for cache clearing
  }
}
