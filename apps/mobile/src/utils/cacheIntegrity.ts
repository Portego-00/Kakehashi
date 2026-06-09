/**
 * Cache Integrity Service
 *
 * Provides comprehensive cache validation, health checking, and automatic repair
 * for the subjects cache used by search and offline mode.
 */

import {
  getFromPermanentStorage,
  getSubjectsMetadata,
  PERMANENT_KEYS,
  removeFromPermanentStorage,
  saveToPermanentStorage
} from './permanentStorage';
import { startPerformanceTimer } from './performanceLogger';

// Types
export interface CacheHealthStatus {
  isHealthy: boolean;
  totalSubjects: number;
  expectedSubjects: number | null;
  validSubjects: number;
  invalidSubjects: number;
  issues: CacheIssue[];
  timestamp: number;
  cacheAge: number | null;
  dataUpdatedAt: string | null;
}

export interface CacheIssue {
  type: CacheIssueType;
  description: string;
  severity: 'warning' | 'error' | 'critical';
  affectedCount?: number;
}

export type CacheIssueType =
  | 'no_cache'
  | 'empty_cache'
  | 'malformed_structure'
  | 'missing_ids'
  | 'missing_object_type'
  | 'missing_data'
  | 'missing_level'
  | 'missing_meanings'
  | 'missing_characters'
  | 'duplicate_ids'
  | 'insufficient_subjects'
  | 'incomplete_cache'
  | 'high_corruption_rate'
  | 'json_parse_error';

export interface CacheRepairResult {
  success: boolean;
  action: 'none' | 'cleared' | 'refetched' | 'failed';
  message: string;
  previousStatus: CacheHealthStatus;
  newStatus?: CacheHealthStatus;
}

// Constants
const MIN_EXPECTED_SUBJECTS = 100; // WaniKani has ~9000 subjects, having less than 100 is suspicious
const MAX_CORRUPTION_RATE = 0.05; // 5% corruption rate is the threshold
const SUBJECT_TYPES = ['radical', 'kanji', 'vocabulary', 'kana_vocabulary'];

/**
 * Validates a single subject object for required fields and structure
 */
function validateSubject(subject: any): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!subject || typeof subject !== 'object') {
    return { isValid: false, issues: ['Subject is null or not an object'] };
  }

  // Required: id (number)
  if (typeof subject.id !== 'number' || isNaN(subject.id)) {
    issues.push('Missing or invalid id');
  }

  // Required: object type (string, must be one of known types)
  if (typeof subject.object !== 'string') {
    issues.push('Missing object type');
  } else if (!SUBJECT_TYPES.includes(subject.object)) {
    issues.push(`Unknown object type: ${subject.object}`);
  }

  // Required: data object
  if (!subject.data || typeof subject.data !== 'object') {
    issues.push('Missing data object');
  } else {
    // Required: data.level (number)
    if (typeof subject.data.level !== 'number' || isNaN(subject.data.level)) {
      issues.push('Missing or invalid data.level');
    }

    // Required: data.meanings (array with at least one meaning)
    if (!Array.isArray(subject.data.meanings) || subject.data.meanings.length === 0) {
      issues.push('Missing or empty meanings array');
    }

    // For kanji and vocabulary, characters should exist
    if ((subject.object === 'kanji' || subject.object === 'vocabulary' || subject.object === 'kana_vocabulary') &&
        !subject.data.characters) {
      issues.push('Missing characters for kanji/vocabulary');
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * Performs comprehensive health check on the subjects cache
 */
export async function checkCacheHealth(): Promise<CacheHealthStatus> {
  const timer = startPerformanceTimer('checkCacheHealth', 'cacheIntegrity.ts');

  const status: CacheHealthStatus = {
    isHealthy: true,
    totalSubjects: 0,
    expectedSubjects: null,
    validSubjects: 0,
    invalidSubjects: 0,
    issues: [],
    timestamp: Date.now(),
    cacheAge: null,
    dataUpdatedAt: null
  };

  try {
    // Get metadata with expected count
    const metadata = getSubjectsMetadata();
    if (metadata) {
      status.expectedSubjects = metadata.expectedCount;
    }

    // Get cache with TTL ignored to check any existing data
    const cached = await getFromPermanentStorage<any[]>(PERMANENT_KEYS.ALL_SUBJECTS, { ignoreTTL: true });

    // Check 1: Cache exists
    if (!cached) {
      status.isHealthy = false;
      status.issues.push({
        type: 'no_cache',
        description: 'No subjects cache found in storage',
        severity: 'critical'
      });
      timer.end({ result: 'no_cache' });
      return status;
    }

    status.cacheAge = Date.now() - cached.timestamp;
    status.dataUpdatedAt = cached.dataUpdatedAt;

    // Check 2: Cache structure is valid
    if (!cached.data) {
      status.isHealthy = false;
      status.issues.push({
        type: 'malformed_structure',
        description: 'Cache entry exists but data property is missing',
        severity: 'critical'
      });
      timer.end({ result: 'malformed_structure' });
      return status;
    }

    if (!Array.isArray(cached.data)) {
      status.isHealthy = false;
      status.issues.push({
        type: 'malformed_structure',
        description: 'Cache data is not an array',
        severity: 'critical'
      });
      timer.end({ result: 'malformed_structure' });
      return status;
    }

    // Check 3: Cache is not empty
    if (cached.data.length === 0) {
      status.isHealthy = false;
      status.issues.push({
        type: 'empty_cache',
        description: 'Cache is empty (0 subjects)',
        severity: 'critical'
      });
      timer.end({ result: 'empty_cache' });
      return status;
    }

    status.totalSubjects = cached.data.length;

    // Check 4: Validate each subject
    const issuesByType: Map<CacheIssueType, number> = new Map();
    const seenIds = new Set<number>();
    let duplicateCount = 0;

    for (const subject of cached.data) {
      const validation = validateSubject(subject);

      if (validation.isValid) {
        status.validSubjects++;
      } else {
        status.invalidSubjects++;

        // Track specific issues
        for (const issue of validation.issues) {
          if (issue.includes('id')) {
            issuesByType.set('missing_ids', (issuesByType.get('missing_ids') || 0) + 1);
          } else if (issue.includes('object type')) {
            issuesByType.set('missing_object_type', (issuesByType.get('missing_object_type') || 0) + 1);
          } else if (issue.includes('data object')) {
            issuesByType.set('missing_data', (issuesByType.get('missing_data') || 0) + 1);
          } else if (issue.includes('level')) {
            issuesByType.set('missing_level', (issuesByType.get('missing_level') || 0) + 1);
          } else if (issue.includes('meanings')) {
            issuesByType.set('missing_meanings', (issuesByType.get('missing_meanings') || 0) + 1);
          } else if (issue.includes('characters')) {
            issuesByType.set('missing_characters', (issuesByType.get('missing_characters') || 0) + 1);
          }
        }
      }

      // Check for duplicate IDs
      if (subject?.id) {
        if (seenIds.has(subject.id)) {
          duplicateCount++;
        } else {
          seenIds.add(subject.id);
        }
      }
    }

    // Add aggregated issues
    for (const [type, count] of issuesByType) {
      status.issues.push({
        type,
        description: `${count} subjects with ${type.replace(/_/g, ' ')}`,
        severity: count > status.totalSubjects * 0.1 ? 'error' : 'warning',
        affectedCount: count
      });
    }

    if (duplicateCount > 0) {
      status.issues.push({
        type: 'duplicate_ids',
        description: `${duplicateCount} duplicate subject IDs found`,
        severity: duplicateCount > 10 ? 'error' : 'warning',
        affectedCount: duplicateCount
      });
    }

    // Check 5: Sufficient subjects
    if (status.totalSubjects < MIN_EXPECTED_SUBJECTS) {
      status.issues.push({
        type: 'insufficient_subjects',
        description: `Only ${status.totalSubjects} subjects in cache (expected at least ${MIN_EXPECTED_SUBJECTS})`,
        severity: 'error',
        affectedCount: status.totalSubjects
      });
    }

    // Check 6: Incomplete cache (compare against expected count from metadata)
    if (status.expectedSubjects !== null && status.totalSubjects < status.expectedSubjects) {
      const missingCount = status.expectedSubjects - status.totalSubjects;
      const missingPercentage = (missingCount / status.expectedSubjects) * 100;

      // Consider it critical if more than 5% is missing, error if more than 1%
      const severity = missingPercentage > 5 ? 'critical' : missingPercentage > 1 ? 'error' : 'warning';

      status.issues.push({
        type: 'incomplete_cache',
        description: `Cache is incomplete: ${status.totalSubjects} subjects cached but ${status.expectedSubjects} expected (missing ${missingCount}, ${missingPercentage.toFixed(1)}%)`,
        severity,
        affectedCount: missingCount
      });
    }

    // Check 7: Corruption rate
    const corruptionRate = status.invalidSubjects / status.totalSubjects;
    if (corruptionRate > MAX_CORRUPTION_RATE) {
      status.issues.push({
        type: 'high_corruption_rate',
        description: `${(corruptionRate * 100).toFixed(1)}% of subjects are corrupted (threshold: ${MAX_CORRUPTION_RATE * 100}%)`,
        severity: 'critical',
        affectedCount: status.invalidSubjects
      });
    }

    // Determine overall health
    const hasCriticalIssue = status.issues.some(i => i.severity === 'critical');
    const hasMultipleErrors = status.issues.filter(i => i.severity === 'error').length >= 2;

    status.isHealthy = !hasCriticalIssue && !hasMultipleErrors && status.validSubjects >= MIN_EXPECTED_SUBJECTS;

    timer.end({
      result: status.isHealthy ? 'healthy' : 'unhealthy',
      totalSubjects: status.totalSubjects,
      expectedSubjects: status.expectedSubjects,
      validSubjects: status.validSubjects,
      invalidSubjects: status.invalidSubjects,
      issueCount: status.issues.length
    });

    return status;

  } catch (error: any) {
    // JSON parse errors or other unexpected issues
    status.isHealthy = false;
    status.issues.push({
      type: 'json_parse_error',
      description: `Failed to read cache: ${error.message}`,
      severity: 'critical'
    });

    timer.end({ result: 'error', error: error.message }, false);
    return status;
  }
}

/**
 * Attempts to repair a corrupted cache by clearing it and optionally refetching
 * @param apiToken - Optional API token for refetching data
 * @param fetchAllSubjects - Optional function to fetch all subjects from API
 * @param options - Additional options
 * @param options.force - Force repair even if cache appears healthy (useful for incomplete caches)
 */
export async function repairCache(
  apiToken?: string,
  fetchAllSubjects?: (token: string) => Promise<{ data: any[]; data_updated_at: string; total_count?: number }>,
  options?: { force?: boolean }
): Promise<CacheRepairResult> {
  const timer = startPerformanceTimer('repairCache', 'cacheIntegrity.ts');

  // Get current status
  const previousStatus = await checkCacheHealth();

  // If already healthy and not forcing, no repair needed
  if (previousStatus.isHealthy && !options?.force) {
    timer.end({ result: 'already_healthy' });
    return {
      success: true,
      action: 'none',
      message: 'Cache is already healthy, no repair needed',
      previousStatus
    };
  }


  try {
    // Step 1: Clear corrupted cache
    await removeFromPermanentStorage(PERMANENT_KEYS.ALL_SUBJECTS);

    // Step 2: If we have API token and fetch function, refetch data
    if (apiToken && fetchAllSubjects) {

      try {
        const response = await fetchAllSubjects(apiToken);

        if (response && response.data && Array.isArray(response.data) && response.data.length > 0) {
          const expectedCount = response.total_count ?? response.data.length;
          const dataUpdatedAt = response.data_updated_at || new Date().toISOString();

          await saveToPermanentStorage(
            PERMANENT_KEYS.ALL_SUBJECTS,
            response.data,
            dataUpdatedAt
          );

          // Save metadata with expected count for future validation
          const { saveSubjectsMetadata } = await import('./permanentStorage');
          await saveSubjectsMetadata({
            expectedCount,
            lastUpdated: new Date().toISOString(),
            dataUpdatedAt
          });

          // Verify the repair
          const newStatus = await checkCacheHealth();

          timer.end({
            result: newStatus.isHealthy ? 'repaired' : 'partial_repair',
            newSubjectCount: response.data.length
          });

          return {
            success: newStatus.isHealthy,
            action: 'refetched',
            message: newStatus.isHealthy
              ? `Successfully repaired cache with ${response.data.length} subjects`
              : `Refetched ${response.data.length} subjects but cache still has issues`,
            previousStatus,
            newStatus
          };
        } else {
          timer.end({ result: 'api_empty' }, false);

          return {
            success: false,
            action: 'failed',
            message: 'API returned empty or invalid data during repair',
            previousStatus
          };
        }
      } catch (fetchError: any) {
        timer.end({ result: 'fetch_failed', error: fetchError.message }, false);

        return {
          success: false,
          action: 'cleared',
          message: `Cache cleared but refetch failed: ${fetchError.message}. App will retry on next load.`,
          previousStatus
        };
      }
    } else {
      // No API token/fetch function - just clear the cache
      timer.end({ result: 'cleared_only' });

      return {
        success: true,
        action: 'cleared',
        message: 'Corrupted cache cleared. Fresh data will be fetched on next app load.',
        previousStatus
      };
    }
  } catch (error: any) {
    timer.end({ result: 'error', error: error.message }, false);

    return {
      success: false,
      action: 'failed',
      message: `Cache repair failed: ${error.message}`,
      previousStatus
    };
  }
}

/**
 * Quick health check - returns true if cache is healthy, false otherwise
 * Use this for fast checks where detailed status isn't needed
 */
export async function isCacheHealthy(): Promise<boolean> {
  const status = await checkCacheHealth();
  return status.isHealthy;
}

/**
 * Check cache and repair if needed (convenience function)
 * Returns true if cache is healthy (either was healthy or successfully repaired)
 */
export async function ensureCacheHealth(
  apiToken?: string,
  fetchAllSubjects?: (token: string) => Promise<{ data: any[]; data_updated_at: string; total_count?: number }>,
  options?: { force?: boolean }
): Promise<{ healthy: boolean; wasRepaired: boolean; status: CacheHealthStatus }> {
  const status = await checkCacheHealth();

  if (status.isHealthy && !options?.force) {
    return { healthy: true, wasRepaired: false, status };
  }

  const repairResult = await repairCache(apiToken, fetchAllSubjects, options);

  return {
    healthy: repairResult.success,
    wasRepaired: repairResult.action !== 'none' && repairResult.success,
    status: repairResult.newStatus || status
  };
}

/**
 * Format cache health status for logging/display
 */
export function formatHealthStatus(status: CacheHealthStatus): string {
  const lines: string[] = [];

  lines.push(`Cache Health: ${status.isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
  lines.push(`Total Subjects: ${status.totalSubjects}${status.expectedSubjects ? ` / ${status.expectedSubjects} expected` : ''}`);
  lines.push(`Valid: ${status.validSubjects} | Invalid: ${status.invalidSubjects}`);

  if (status.cacheAge !== null) {
    const ageHours = Math.round(status.cacheAge / (1000 * 60 * 60) * 10) / 10;
    lines.push(`Cache Age: ${ageHours} hours`);
  }

  if (status.issues.length > 0) {
    lines.push('Issues:');
    for (const issue of status.issues) {
      const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'error' ? '🟠' : '🟡';
      lines.push(`  ${icon} ${issue.description}`);
    }
  }

  return lines.join('\n');
}
