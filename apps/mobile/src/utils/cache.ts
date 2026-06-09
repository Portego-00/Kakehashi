import AsyncStorage from '@react-native-async-storage/async-storage';
import { startPerformanceTimer } from './performanceLogger';
import {
    getFromPermanentStorage,
    getSubjectsMetadata,
    PERMANENT_KEYS,
    permanentStorage,
    removeFromPermanentStorage,
    saveSubjectsMetadata,
    saveToPermanentStorage,
    type SubjectsMetadata
} from './permanentStorage';
import {
    checkCacheHealth,
    ensureCacheHealth,
    repairCache,
    formatHealthStatus,
    type CacheHealthStatus,
    type CacheRepairResult
} from './cacheIntegrity';

// Constants
export const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
export const ALL_SUBJECTS_CACHE_KEY = 'wanikani_all_subjects_cache';
const BATCH_SIZE = 150; // Process subjects in batches to avoid blocking UI
const ASSIGNMENTS_CACHE_KEY = 'wanikani_assignments_cache';
const STUDY_MATERIALS_CACHE_KEY = 'wanikani_study_materials_cache';
const SRS_SYSTEMS_CACHE_KEY = 'wanikani_srs_systems_cache';
const ETAGS_CACHE_KEY = 'wanikani_etags_cache';
const LAST_MODIFIED_CACHE_KEY = 'wanikani_last_modified_cache';
const DATA_UPDATED_AT_CACHE_KEY = 'wanikani_data_updated_at_cache';

// Cache interface
interface CacheEntry<T> {
  timestamp: number;
  data: T;
  dataUpdatedAt: string;
}

interface ETagsCache {
  [url: string]: string;
}

interface LastModifiedCache {
  [url: string]: string;
}

// In-memory cache for fast subject lookups
let subjectsMemoryCache: Map<number, any> | null = null;
let memoryCacheTimestamp: number = 0;
let subjectsMemoryLoadPromise: Promise<void> | null = null;
let lastMemoryLoadAttemptAt: number = 0;
let lastMemoryLoadHadData = false;
const MEMORY_CACHE_RELOAD_BACKOFF_MS = 10 * 1000;

function hasSubjectsPayloadInPermanentStorage(): boolean {
  try {
    const storage = permanentStorage as any;
    if (typeof storage?.contains === 'function') {
      return storage.contains(PERMANENT_KEYS.ALL_SUBJECTS);
    }
    return Boolean(storage?.getString?.(PERMANENT_KEYS.ALL_SUBJECTS));
  } catch {
    return false;
  }
}

// Helper functions for subjects cache using permanent storage
async function getSubjectsFromPermanentStorage(options: { ignoreTTL?: boolean } = {}) {
  try {
    // Try permanent storage first (new, reliable storage)
    const permanent = await getFromPermanentStorage<any[]>(PERMANENT_KEYS.ALL_SUBJECTS, options);
    if (permanent) {
      if (Array.isArray((permanent as any).data)) {
        return permanent;
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

async function saveSubjectsToPermanentStorage(
  subjects: any[],
  dataUpdatedAt: string,
  expectedCount?: number
) {
  try {
    // Save to permanent storage (primary)
    await saveToPermanentStorage(PERMANENT_KEYS.ALL_SUBJECTS, subjects, dataUpdatedAt);

    // Save metadata with expected count for validation
    const metadata: SubjectsMetadata = {
      expectedCount: expectedCount ?? subjects.length,
      lastUpdated: new Date().toISOString(),
      dataUpdatedAt,
    };
    await saveSubjectsMetadata(metadata);

    // Remove legacy consolidated cache so old payloads cannot be rehydrated.
    await AsyncStorage.removeItem(ALL_SUBJECTS_CACHE_KEY).catch(() => {});
  } catch (error) {
    throw error;
  }
}

// Get from cache
export async function getFromCache<T>(
  key: string,
  id?: number,
  options: { ignoreTTL?: boolean } = {}
): Promise<CacheEntry<T> | null> {
  const timer = startPerformanceTimer('getFromCache', 'cache.ts');
  
  try {
    const cacheKey = id ? `${key}_${id}` : key;
    const cachedData = await AsyncStorage.getItem(cacheKey);
    
    if (!cachedData) {
      timer.end({ cacheKey, result: 'miss' });
      return null;
    }
    
    const parsedCache: CacheEntry<T> = JSON.parse(cachedData);
    
    // Check if cache is expired (unless caller wants the stale entry)
    const now = Date.now();
    const isExpired = !options.ignoreTTL && now - parsedCache.timestamp > CACHE_TTL;
    
    if (isExpired) {
      timer.end({ cacheKey, result: 'expired', age: now - parsedCache.timestamp });
      return null;
    }
    
    timer.end({ 
      cacheKey, 
      result: 'hit', 
      age: now - parsedCache.timestamp,
      ignoreTTL: options.ignoreTTL 
    });
    return parsedCache;
  } catch (error: any) {
    timer.end({ cacheKey: key, error: error.message }, false);
    return null;
  }
}

// Save to cache
export async function saveToCache<T>(key: string, data: T, dataUpdatedAt: string, id?: number): Promise<void> {
  const timer = startPerformanceTimer('saveToCache', 'cache.ts');
  
  try {
    const cacheKey = id ? `${key}_${id}` : key;
    const cacheEntry: CacheEntry<T> = {
      timestamp: Date.now(),
      data,
      dataUpdatedAt
    };
    await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
    timer.end({ cacheKey, result: 'saved' });
  } catch (error: any) {
    timer.end({ cacheKey: key, error: error.message }, false);
  }
}

// Get ETag for a URL
export async function getETag(url: string): Promise<string | null> {
  try {
    const etagsData = await AsyncStorage.getItem(ETAGS_CACHE_KEY);
    if (!etagsData) return null;
    
    const etags: ETagsCache = JSON.parse(etagsData);
    return etags[url] || null;
  } catch (error) {
    return null;
  }
}

// Save ETag for a URL
export async function saveETag(url: string, etag: string): Promise<void> {
  try {
    const etagsData = await AsyncStorage.getItem(ETAGS_CACHE_KEY);
    const etags: ETagsCache = etagsData ? JSON.parse(etagsData) : {};
    
    etags[url] = etag;
    await AsyncStorage.setItem(ETAGS_CACHE_KEY, JSON.stringify(etags));
  } catch (error) {
    // Silent failure for ETag saving
  }
}

// Get Last-Modified for a URL
export async function getLastModified(url: string): Promise<string | null> {
  try {
    const lastModifiedData = await AsyncStorage.getItem(LAST_MODIFIED_CACHE_KEY);
    if (!lastModifiedData) return null;
    
    const lastModified: LastModifiedCache = JSON.parse(lastModifiedData);
    return lastModified[url] || null;
  } catch (error) {
    return null;
  }
}

// Save Last-Modified for a URL
export async function saveLastModified(url: string, lastModified: string): Promise<void> {
  try {
    const lastModifiedData = await AsyncStorage.getItem(LAST_MODIFIED_CACHE_KEY);
    const lastModifiedCache: LastModifiedCache = lastModifiedData ? JSON.parse(lastModifiedData) : {};
    
    lastModifiedCache[url] = lastModified;
    await AsyncStorage.setItem(LAST_MODIFIED_CACHE_KEY, JSON.stringify(lastModifiedCache));
  } catch (error) {
    // Silent failure for Last-Modified saving
  }
}

// Get data_updated_at timestamp for an endpoint (for updated_after filter)
export async function getDataUpdatedAt(endpoint: string): Promise<string | null> {
  try {
    const dataUpdatedAtData = await AsyncStorage.getItem(DATA_UPDATED_AT_CACHE_KEY);
    if (!dataUpdatedAtData) return null;
    
    const dataUpdatedAtCache: { [endpoint: string]: string } = JSON.parse(dataUpdatedAtData);
    return dataUpdatedAtCache[endpoint] || null;
  } catch (error) {
    return null;
  }
}

// Save data_updated_at timestamp for an endpoint
export async function saveDataUpdatedAt(endpoint: string, dataUpdatedAt: string): Promise<void> {
  try {
    const dataUpdatedAtData = await AsyncStorage.getItem(DATA_UPDATED_AT_CACHE_KEY);
    const dataUpdatedAtCache: { [endpoint: string]: string } = dataUpdatedAtData ? JSON.parse(dataUpdatedAtData) : {};
    
    dataUpdatedAtCache[endpoint] = dataUpdatedAt;
    await AsyncStorage.setItem(DATA_UPDATED_AT_CACHE_KEY, JSON.stringify(dataUpdatedAtCache));
  } catch (error) {
    // Silent failure for data_updated_at saving
  }
}

// Validate cached subjects data for integrity
function validateSubjectsData(subjects: any[]): { isValid: boolean; invalidCount: number; validCount: number } {
  if (!Array.isArray(subjects)) {
    return { isValid: false, invalidCount: 0, validCount: 0 };
  }

  let validCount = 0;
  let invalidCount = 0;

  subjects.forEach(subject => {
    // Check if subject has required fields
    if (subject &&
        typeof subject.id === 'number' &&
        subject.object &&
        subject.data &&
        typeof subject.data.level === 'number') {
      validCount++;
    } else {
      invalidCount++;
    }
  });

  // Consider data valid if at least 95% of subjects are valid and we have a reasonable number
  const totalCount = validCount + invalidCount;
  const isValid = validCount > 100 && (invalidCount / totalCount) < 0.05;

  return { isValid, invalidCount, validCount };
}

// Load all subjects into memory cache for fast access
async function loadSubjectsIntoMemory(): Promise<void> {
  if (subjectsMemoryLoadPromise) {
    await subjectsMemoryLoadPromise;
    return;
  }

  subjectsMemoryLoadPromise = (async () => {
    lastMemoryLoadAttemptAt = Date.now();
    lastMemoryLoadHadData = false;

    try {
      // Try to get any cached data (fresh or stale) from permanent storage
      let cached = await getSubjectsFromPermanentStorage();
      if (!cached) {
        // If no fresh cache, try stale cache from permanent storage
        cached = await getSubjectsFromPermanentStorage({ ignoreTTL: true });
      }

      if (!(cached && cached.data && Array.isArray(cached.data))) {
        subjectsMemoryCache = null;
        memoryCacheTimestamp = 0;
        return;
      }

      // Validate cache integrity
      const validation = validateSubjectsData(cached.data);

      if (!validation.isValid) {
        // Clear corrupted cache + metadata so startup does not trust phantom cache.
        await Promise.all([
          removeFromPermanentStorage(PERMANENT_KEYS.ALL_SUBJECTS).catch(() => {}),
          removeFromPermanentStorage(PERMANENT_KEYS.SUBJECTS_METADATA).catch(
            () => {}
          ),
        ]);
        subjectsMemoryCache = null;
        memoryCacheTimestamp = 0;
        return;
      }

      subjectsMemoryCache = new Map();

      cached.data.forEach(subject => {
        if (subject && subject.id) {
          subjectsMemoryCache!.set(subject.id, subject);
        }
      });

      memoryCacheTimestamp = Date.now(); // Use current time for memory cache
      lastMemoryLoadHadData = true;
    } catch (error) {
      // Silent failure for memory loading
    }
  })();

  try {
    await subjectsMemoryLoadPromise;
  } finally {
    subjectsMemoryLoadPromise = null;
  }
}

// Optimized batch save function for large datasets
async function saveBatchedSubjects(
  subjects: any[],
  dataUpdatedAt: string,
  onProgress?: (progress: number) => void,
  expectedCount?: number
): Promise<boolean> {
  const timer = startPerformanceTimer('saveBatchedSubjects', 'cache.ts');

  try {
    // Save main subjects array to permanent storage (survives iOS cache clearing)
    // With retry logic for resilience
    let saveSuccess = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!saveSuccess && attempts < maxAttempts) {
      attempts++;
      try {
        await saveSubjectsToPermanentStorage(subjects, dataUpdatedAt, expectedCount);
        saveSuccess = true;
      } catch (saveError: any) {
        if (attempts < maxAttempts) {
          // Wait briefly before retrying
          await new Promise(resolve => setTimeout(resolve, 100 * attempts));
        } else {
          throw saveError; // Give up after max attempts
        }
      }
    }

    // Previously: we also saved each subject under per-subject keys.
    // Those keys duplicate data and balloon storage. We now skip writing
    // per-subject entries and rely on the consolidated array plus the
    // in-memory Map for fast lookups.
    const totalBatches = 1;
    if (onProgress) onProgress(100);

    timer.end({ totalSubjects: subjects.length, totalBatches, attempts });
    return true;
  } catch (error: any) {
    timer.end({ error: error.message }, false);
    return false;
  }
}

// Type for fetch all subjects function
type FetchAllSubjectsFunction = (
  token: string,
  onProgress?: (progress: number) => void
) => Promise<{
  data: any[];
  data_updated_at: string;
  total_count?: number;
}>;

// Ensure all subjects are cached (call this on app startup)
export async function ensureAllSubjectsCached(
  apiToken: string,
  fetchAllSubjects: FetchAllSubjectsFunction,
  onProgress?: (progress: number) => void
): Promise<boolean> {
  const timer = startPerformanceTimer('ensureAllSubjectsCached', 'cache.ts');

  try {
    // First, perform a quick health check on existing cache
    const healthStatus = await checkCacheHealth();

    if (!healthStatus.isHealthy && healthStatus.totalSubjects > 0) {
      // If we have critical issues and API token, attempt auto-repair
      const hasCriticalIssues = healthStatus.issues.some(i => i.severity === 'critical');
      if (hasCriticalIssues) {
        try {
          const repairResult = await repairCache(apiToken, fetchAllSubjects);
          if (repairResult.success) {
            timer.end({ result: 'repaired', count: repairResult.newStatus?.validSubjects || 0 });
            return true;
          }
        } catch (repairError) {
          // Continue to try loading what we have
        }
      }
    }

    // Check permanent storage with TTL ignored to see if we have any cached data
    const staleCached = await getSubjectsFromPermanentStorage({ ignoreTTL: true });
    const freshCached = await getSubjectsFromPermanentStorage();

    // If we have fresh cache, use it immediately
    if (freshCached && freshCached.data && freshCached.data.length > 0) {
      await loadSubjectsIntoMemory();
      timer.end({ result: 'fresh_cache', count: freshCached.data.length });
      return true;
    }

    // If we have stale cache but no fresh cache, use stale for immediate loading
    if (staleCached && staleCached.data && staleCached.data.length > 0) {
      await loadSubjectsIntoMemory();

      // Background refresh: try to update cache but don't block the app
      refreshCacheInBackground(apiToken, fetchAllSubjects, staleCached.data.length, onProgress);
      timer.end({ result: 'stale_cache', count: staleCached.data.length });
      return true;
    }

    // No cache available - must fetch from API
    try {
      if (onProgress) onProgress(10); // Show initial progress

      const allSubjects = await fetchAllSubjects(apiToken, (fetchProgress) => {
        if (!onProgress) return;
        const clampedProgress = Math.max(0, Math.min(100, fetchProgress));
        // Map API pagination fetch to 10% -> 80% for a smoother first-load UX.
        onProgress(10 + Math.round(clampedProgress * 0.7));
      });
      
      if (allSubjects && allSubjects.data && allSubjects.data.length > 0) {
        if (onProgress) onProgress(80); // API fetch complete

        // Use optimized batch save with expected count for validation
        const saveSuccess = await saveBatchedSubjects(
          allSubjects.data,
          allSubjects.data_updated_at || new Date().toISOString(),
          (progress) => {
            // Map save progress to 80% -> 95%.
            if (onProgress) onProgress(80 + Math.round(progress * 0.15));
          },
          allSubjects.total_count ?? allSubjects.data.length
        );
        
        if (!saveSuccess) {
          timer.end({ result: 'save_failed' }, false);
          return false;
        }

        if (onProgress) onProgress(95); // Cache save complete

        // Load into memory cache
        await loadSubjectsIntoMemory();

        if (onProgress) onProgress(100); // Complete

        timer.end({ result: 'api_fetch', count: allSubjects.data.length });
        return true;
      }

      timer.end({ result: 'api_no_data' }, false);
      return false;
    } catch (apiError) {
      // If API fails and we have stale cache, fall back to it
      if (staleCached && staleCached.data && staleCached.data.length > 0) {
        await loadSubjectsIntoMemory();
        timer.end({ result: 'api_failed_fallback_stale', count: staleCached.data.length });
        return true;
      }

      timer.end({ result: 'api_failed_no_fallback', error: (apiError as any).message }, false);
      return false;
    }
  } catch (error: any) {
    timer.end({ error: error.message }, false);
    return false;
  }
}

// Background cache refresh function
async function refreshCacheInBackground(
  apiToken: string,
  fetchAllSubjects: FetchAllSubjectsFunction,
  currentCount: number,
  onProgress?: (progress: number) => void
): Promise<void> {
  try {
    const allSubjects = await fetchAllSubjects(apiToken);

    if (allSubjects && allSubjects.data && allSubjects.data.length > 0) {
      const expectedCount = allSubjects.total_count ?? allSubjects.data.length;

      // Validate that we got all the data (pagination didn't fail silently)
      if (allSubjects.total_count && allSubjects.data.length < allSubjects.total_count) {
        return; // Don't save incomplete data
      }

      await saveBatchedSubjects(
        allSubjects.data,
        allSubjects.data_updated_at || new Date().toISOString(),
        onProgress,
        expectedCount
      );
      await loadSubjectsIntoMemory();
    }
  } catch (error) {
    // Silent failure for background refresh
  }
}

// Utility function to check cache status (for debugging)
export async function getCacheStatus(): Promise<{
  hasFreshCache: boolean;
  hasStaleCache: boolean;
  subjectCount: number;
  cacheAge: number;
  memoryLoaded: boolean;
}> {
  try {
    // Fast path: rely on metadata saved alongside subjects to avoid parsing the
    // full subjects payload during startup.
    const metadata = getSubjectsMetadata();
    if (metadata && metadata.expectedCount > 0) {
      if (!hasSubjectsPayloadInPermanentStorage()) {
        // Metadata can outlive payload in partial/failed repairs. Drop it so we
        // do not take the "cache hit" startup path with missing subject data.
        void removeFromPermanentStorage(PERMANENT_KEYS.SUBJECTS_METADATA).catch(
          () => {}
        );
      } else {
        const age = Math.max(
          0,
          Date.now() - Date.parse(metadata.lastUpdated || "")
        );
        const hasFreshCache = Number.isFinite(age) ? age <= CACHE_TTL : false;

        return {
          hasFreshCache,
          hasStaleCache: true,
          subjectCount: metadata.expectedCount,
          cacheAge: Number.isFinite(age) ? age : 0,
          memoryLoaded: !!(subjectsMemoryCache && subjectsMemoryCache.size > 0)
        };
      }
    }

    // Fallback for older installs where metadata is missing. Only read from
    // permanent storage here to keep startup lightweight and avoid parsing
    // large legacy AsyncStorage payloads on the hot path.
    if (!hasSubjectsPayloadInPermanentStorage()) {
      return {
        hasFreshCache: false,
        hasStaleCache: false,
        subjectCount: 0,
        cacheAge: 0,
        memoryLoaded: !!(subjectsMemoryCache && subjectsMemoryCache.size > 0)
      };
    }

    const staleCached = await getFromPermanentStorage<any[]>(
      PERMANENT_KEYS.ALL_SUBJECTS,
      { ignoreTTL: true }
    );
    const cacheAge = staleCached ? Date.now() - staleCached.timestamp : 0;
    const hasFreshCache = staleCached ? cacheAge <= CACHE_TTL : false;
    
    return {
      hasFreshCache: hasFreshCache && !!(staleCached?.data?.length),
      hasStaleCache: !!(staleCached && staleCached.data && staleCached.data.length > 0),
      subjectCount: staleCached?.data?.length || 0,
      cacheAge,
      memoryLoaded: !!(subjectsMemoryCache && subjectsMemoryCache.size > 0)
    };
  } catch (error) {
    return {
      hasFreshCache: false,
      hasStaleCache: false,
      subjectCount: 0,
      cacheAge: 0,
      memoryLoaded: false
    };
  }
}

// Get a subject by ID (fast memory lookup)
export async function getSubjectById(id: number): Promise<any | null> {
  try {
    // If memory cache is not loaded or is stale, load it
    if (!subjectsMemoryCache || Date.now() - memoryCacheTimestamp > CACHE_TTL) {
      const now = Date.now();
      if (
        !lastMemoryLoadHadData &&
        now - lastMemoryLoadAttemptAt < MEMORY_CACHE_RELOAD_BACKOFF_MS
      ) {
        return null;
      }
      await loadSubjectsIntoMemory();
    }
    
    // Return from memory cache
    return subjectsMemoryCache?.get(id) || null;
  } catch (error) {
    return null;
  }
}

// Get all subjects (for search functionality)
export async function getAllSubjects(): Promise<any[]> {
  try {
    const cached = await getSubjectsFromPermanentStorage({ ignoreTTL: true });
    return cached?.data || [];
  } catch (error) {
    return [];
  }
}

// Get subjects by level
export async function getSubjectsByLevel(level: number): Promise<any[]> {
  try {
    const allSubjects = await getAllSubjects();
    return allSubjects.filter(subject => subject.data?.level === level);
  } catch (error) {
    return [];
  }
}

// Clear study materials cache for a specific subject
export async function clearStudyMaterialsCache(subjectId: number): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();

    // The cache key format is: study_materials_{URL with non-alphanumeric replaced with _}
    // URL format: https://api.wanikani.com/v2/study_materials?subject_ids=123
    // So we need to match keys that contain both 'study_materials_' and the subject ID
    const studyMaterialsKeys = keys.filter(key =>
      key.includes('study_materials_') &&
      (key.includes(`subject_ids_${subjectId}`) || key.includes(`subject_ids=${subjectId}`))
    );

    if (studyMaterialsKeys.length > 0) {
      await AsyncStorage.multiRemove(studyMaterialsKeys);
    }
  } catch (error) {
    // Silent failure for cache clearing
  }
}

// Clear all cache
export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const exactApiKeys = new Set([
      'user_data',
      'summary_data',
      'assignments_all',
      'review_statistics_all',
    ]);
    const prefixMatchers = [
      'wanikani_',
      'subjects_',
      'assignments_full_',
      'study_materials_',
      'srs_systems_',
      'review_statistics_',
    ];
    const wanikaniKeys = keys.filter((key) =>
      exactApiKeys.has(key) ||
      prefixMatchers.some((prefix) => key.startsWith(prefix))
    );
    
    if (wanikaniKeys.length > 0) {
      await AsyncStorage.multiRemove(wanikaniKeys);
    }

    // Clear memory cache
    subjectsMemoryCache = null;
    memoryCacheTimestamp = 0;
  } catch (error) {
    // Silent failure for cache clearing
  }
}

// Legacy function for backward compatibility - now just calls getSubjectById
export async function getCachedSubjectFromAnyCache(id: number): Promise<any | null> {
  return getSubjectById(id);
}

// Legacy function for backward compatibility
export async function prefetchSubjectsByLevel(apiToken: string, level: number, fetchFunction: Function): Promise<void> {
  // This is now handled by ensureAllSubjectsCached, so this is a no-op
}

// Legacy function for backward compatibility
export async function getCachedSubject(_apiToken: string, id: number, fetchFunction: Function): Promise<any> {
  const subject = await getSubjectById(id);
  if (subject) {
    return subject;
  }

  // Fallback to API if not in cache
  return fetchFunction(_apiToken, id);
}

// Debug function to show storage status
export async function debugStorageStatus(): Promise<void> {
  // No-op - debug function disabled for production
}

// ============================================================================
// Cache Integrity - Check and repair corrupted cache
// ============================================================================

/**
 * Check the health of the subjects cache
 * Returns detailed status including any issues found
 */
export async function checkSubjectsCacheHealth(): Promise<CacheHealthStatus> {
  return checkCacheHealth();
}

/**
 * Repair corrupted subjects cache
 * Clears the cache and optionally refetches from API
 *
 * @param apiToken - Optional API token for refetching data
 * @param fetchAllSubjects - Optional function to fetch all subjects from API
 * @param options - Additional options
 * @param options.force - Force repair even if cache appears healthy
 * @returns Result of the repair operation
 */
export async function repairSubjectsCache(
  apiToken?: string,
  fetchAllSubjects?: (token: string) => Promise<{ data: any[]; data_updated_at: string; total_count?: number }>,
  options?: { force?: boolean }
): Promise<CacheRepairResult> {
  const result = await repairCache(apiToken, fetchAllSubjects, options);

  // If repair was successful, reload into memory
  if (result.success && result.action === 'refetched') {
    await loadSubjectsIntoMemory();
  }

  // Clear memory cache if repair cleared the cache
  if (result.action === 'cleared' || result.action === 'failed') {
    subjectsMemoryCache = null;
    memoryCacheTimestamp = 0;
  }

  return result;
}

/**
 * Check cache health and repair if needed
 * This is the main function to call for automatic cache maintenance
 *
 * @param apiToken - Optional API token for refetching data
 * @param fetchAllSubjects - Optional function to fetch all subjects from API
 * @param options - Additional options
 * @param options.force - Force repair even if cache appears healthy
 * @returns Object with health status and whether repair was performed
 */
export async function ensureSubjectsCacheHealthy(
  apiToken?: string,
  fetchAllSubjects?: (token: string) => Promise<{ data: any[]; data_updated_at: string; total_count?: number }>,
  options?: { force?: boolean }
): Promise<{ healthy: boolean; wasRepaired: boolean; status: CacheHealthStatus }> {
  const result = await ensureCacheHealth(apiToken, fetchAllSubjects, options);

  // Reload into memory if repair was successful
  if (result.wasRepaired) {
    await loadSubjectsIntoMemory();
  }

  return result;
}

/**
 * Get a formatted string representation of cache health for logging/display
 */
export function getFormattedCacheHealth(status: CacheHealthStatus): string {
  return formatHealthStatus(status);
}

// Re-export types for convenience
export type { CacheHealthStatus, CacheRepairResult };
