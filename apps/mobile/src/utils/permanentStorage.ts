import { MMKV } from 'react-native-mmkv';
import { startPerformanceTimer } from './performanceLogger';

// Initialize MMKV instance for permanent storage
// Data stored here persists even during iOS low storage conditions
const permanentStorage = new MMKV({
  id: 'wanikani-permanent-storage',
  encryptionKey: 'wanikani-app-storage-key', // Basic encryption for security
});

// Initialize separate MMKV instance for encrypted sensitive data
const secureStorage = new MMKV({
  id: 'wanikani-secure-storage', 
  encryptionKey: 'wanikani-secure-key-2024',
});

// Cache interface for permanent storage
interface PermanentCacheEntry<T> {
  timestamp: number;
  data: T;
  dataUpdatedAt: string;
}

// Keys for permanent storage (critical data that must persist)
export const PERMANENT_KEYS = {
  ALL_SUBJECTS: 'subjects_all',
  ALL_ASSIGNMENTS: 'assignments_all',
  DASHBOARD_DATA: 'dashboard_data',
  STUDY_MATERIALS: 'study_materials',
  SRS_SYSTEMS: 'srs_systems',
  USER_SETTINGS: 'user_settings',
  REVIEW_STATISTICS: 'review_statistics',
  LEVEL_PROGRESSIONS: 'level_progressions',
  ANKI_ONBOARDING: 'anki_onboarding',
  ANKI_SETTINGS: 'anki_settings',
  LESSON_SESSION: 'lesson_session',
  SUBJECTS_METADATA: 'subjects_metadata', // Stores expected count and other metadata
} as const;

// Metadata for subjects cache validation
export interface SubjectsMetadata {
  expectedCount: number;
  lastUpdated: string;
  dataUpdatedAt: string;
}

// Keys for secure storage (sensitive data)
export const SECURE_KEYS = {
  API_TOKEN: 'api_token',
  USER_CREDENTIALS: 'user_credentials',
} as const;

/**
 * Save data to permanent storage (survives iOS low storage conditions)
 * Use this for critical app data like subjects, assignments, etc.
 */
export async function saveToPermanentStorage<T>(
  key: string, 
  data: T, 
  dataUpdatedAt: string
): Promise<void> {
  const timer = startPerformanceTimer('saveToPermanentStorage', 'permanentStorage.ts');
  
  try {
    const cacheEntry: PermanentCacheEntry<T> = {
      timestamp: Date.now(),
      data,
      dataUpdatedAt
    };
    
    // MMKV is synchronous, but we'll wrap it for consistency with async patterns
    permanentStorage.set(key, JSON.stringify(cacheEntry));

    timer.end({ key, result: 'saved', storageType: 'permanent' });
  } catch (error: any) {
    timer.end({ key, error: error.message, storageType: 'permanent' }, false);
    throw error;
  }
}

/**
 * Get data from permanent storage
 * Returns null if not found or expired (unless ignoreTTL is true)
 */
export async function getFromPermanentStorage<T>(
  key: string,
  options: { ignoreTTL?: boolean; maxAge?: number } = {}
): Promise<PermanentCacheEntry<T> | null> {
  const timer = startPerformanceTimer('getFromPermanentStorage', 'permanentStorage.ts');
  
  try {
    const cachedData = permanentStorage.getString(key);
    
    if (!cachedData) {
      timer.end({ key, result: 'miss', storageType: 'permanent' });
      return null;
    }
    
    const parsedCache: PermanentCacheEntry<T> = JSON.parse(cachedData);
    
    // Check if cache is expired (unless caller wants the stale entry)
    const now = Date.now();
    const age = now - parsedCache.timestamp;
    const maxAge = options.maxAge || (24 * 60 * 60 * 1000); // Default 24h TTL
    const isExpired = !options.ignoreTTL && age > maxAge;
    
    if (isExpired) {
      timer.end({ key, result: 'expired', age, maxAge, storageType: 'permanent' });
      return null;
    }
    
    timer.end({ 
      key, 
      result: 'hit', 
      age, 
      ignoreTTL: options.ignoreTTL,
      storageType: 'permanent'
    });
    return parsedCache;
  } catch (error: any) {
    timer.end({ key, error: error.message, storageType: 'permanent' }, false);
    return null;
  }
}

/**
 * Save sensitive data to encrypted permanent storage
 * Use this for API tokens, user credentials, etc.
 */
export async function saveToSecureStorage(key: string, data: string): Promise<void> {
  const timer = startPerformanceTimer('saveToSecureStorage', 'permanentStorage.ts');
  
  try {
    secureStorage.set(key, data);
    timer.end({ key, result: 'saved', storageType: 'secure' });
  } catch (error: any) {
    timer.end({ key, error: error.message, storageType: 'secure' }, false);
    throw error;
  }
}

/**
 * Get sensitive data from encrypted permanent storage
 */
export async function getFromSecureStorage(key: string): Promise<string | null> {
  const timer = startPerformanceTimer('getFromSecureStorage', 'permanentStorage.ts');
  
  try {
    const data = secureStorage.getString(key);
    timer.end({ 
      key, 
      result: data ? 'hit' : 'miss', 
      storageType: 'secure' 
    });
    return data || null;
  } catch (error: any) {
    timer.end({ key, error: error.message, storageType: 'secure' }, false);
    return null;
  }
}

/**
 * Remove data from permanent storage
 */
export async function removeFromPermanentStorage(key: string): Promise<void> {
  try {
    permanentStorage.delete(key);
  } catch (error) {
    throw error;
  }
}

/**
 * Remove data from secure storage
 */
export async function removeFromSecureStorage(key: string): Promise<void> {
  try {
    secureStorage.delete(key);
  } catch (error) {
    throw error;
  }
}

/**
 * Clear all permanent storage (for debugging/testing)
 */
export async function clearAllPermanentStorage(): Promise<void> {
  try {
    permanentStorage.clearAll();
  } catch (error) {
    throw error;
  }
}

/**
 * Get storage statistics for debugging
 */
export function getPermanentStorageStats(): {
  permanentKeys: string[];
  secureKeys: string[];
  permanentSize: number;
  secureSize: number;
} {
  try {
    const permanentKeys = permanentStorage.getAllKeys();
    const secureKeys = secureStorage.getAllKeys();
    
    // Calculate approximate size by summing all values
    let permanentSize = 0;
    let secureSize = 0;
    
    permanentKeys.forEach(key => {
      const value = permanentStorage.getString(key);
      if (value) permanentSize += value.length;
    });
    
    secureKeys.forEach(key => {
      const value = secureStorage.getString(key);
      if (value) secureSize += value.length;
    });
    
    return {
      permanentKeys,
      secureKeys,
      permanentSize,
      secureSize,
    };
  } catch {
    return {
      permanentKeys: [],
      secureKeys: [],
      permanentSize: 0,
      secureSize: 0,
    };
  }
}

/**
 * Check if permanent storage is available and working
 */
export function testPermanentStorage(): boolean {
  try {
    const testKey = '__test_key__';
    const testValue = 'test_value';
    
    // Test write
    permanentStorage.set(testKey, testValue);
    
    // Test read
    const retrieved = permanentStorage.getString(testKey);
    
    // Test delete
    permanentStorage.delete(testKey);
    
    return retrieved === testValue;
  } catch {
    return false;
  }
}

/**
 * Save assignments data to permanent storage
 */
export async function saveAssignmentsToPermanentStorage(
  assignments: any[],
  dataUpdatedAt: string
): Promise<void> {
  await saveToPermanentStorage(PERMANENT_KEYS.ALL_ASSIGNMENTS, assignments, dataUpdatedAt);
}

/**
 * Get assignments data from permanent storage
 */
export async function getAssignmentsFromPermanentStorage(
  options: { ignoreTTL?: boolean; maxAge?: number } = {}
): Promise<any[] | null> {
  try {
    const cached = await getFromPermanentStorage<any[]>(PERMANENT_KEYS.ALL_ASSIGNMENTS, options);
    if (cached && Array.isArray(cached.data)) {
      return cached.data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get dashboard data with full assignments and subjects from permanent storage
 * This function reconstructs the full dashboard data even if the dashboard cache was minified
 */
export async function getFullDashboardDataFromPermanentStorage(): Promise<any | null> {
  try {
    // Get dashboard data (minified)
    const dashboardCache = await getFromPermanentStorage<any>(PERMANENT_KEYS.DASHBOARD_DATA, { ignoreTTL: true });
    
    // Get full assignments and subjects
    const assignments = await getAssignmentsFromPermanentStorage({ ignoreTTL: true });
    const subjects = await getFromPermanentStorage<any[]>(PERMANENT_KEYS.ALL_SUBJECTS, { ignoreTTL: true });
    
    if (!dashboardCache) {
      return null;
    }
    
    // Reconstruct full dashboard data
    const fullDashboardData = {
      ...dashboardCache.data,
      assignments: assignments || [],
      subjects: subjects?.data || [],
    };

    return fullDashboardData;
  } catch {
    return null;
  }
}

/**
 * Save subjects metadata (expected count, etc.) for cache validation
 */
export async function saveSubjectsMetadata(metadata: SubjectsMetadata): Promise<void> {
  try {
    permanentStorage.set(PERMANENT_KEYS.SUBJECTS_METADATA, JSON.stringify(metadata));
  } catch (error) {
    throw error;
  }
}

/**
 * Get subjects metadata for cache validation
 */
export function getSubjectsMetadata(): SubjectsMetadata | null {
  try {
    const data = permanentStorage.getString(PERMANENT_KEYS.SUBJECTS_METADATA);
    if (!data) return null;
    return JSON.parse(data) as SubjectsMetadata;
  } catch {
    return null;
  }
}

// Export storage instances for direct access if needed
export { permanentStorage, secureStorage };
