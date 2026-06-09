import AsyncStorage from '@react-native-async-storage/async-storage';
import { analyzeCacheStorage, formatBytes } from './cacheAnalyzer';

interface CacheEntry {
  timestamp: number;
  data: any;
  dataUpdatedAt: string;
}

export interface CacheOptimizationResult {
  sizeBefore: number;
  sizeAfter: number;
  savedSpace: number;
  savedSpaceFormatted: string;
  itemsRemoved: number;
  optimizationsApplied: string[];
}

export async function optimizeCache(options: {
  maxSizeMB?: number;
  maxAgeDays?: number;
  removeIncompleteCollections?: boolean;
} = {}): Promise<CacheOptimizationResult> {
  const {
    maxSizeMB = 50,
    maxAgeDays = 30,
    removeIncompleteCollections = true
  } = options;

  console.log('🔧 Starting cache optimization...');
  
  const initialAnalysis = await analyzeCacheStorage();
  const sizeBefore = initialAnalysis.totalSize;
  
  const optimizationsApplied: string[] = [];
  let itemsRemoved = 0;

  // 1. Remove expired cache entries
  if (maxAgeDays > 0) {
    const removed = await removeExpiredEntries(maxAgeDays);
    if (removed > 0) {
      optimizationsApplied.push(`Removed ${removed} expired entries (>${maxAgeDays} days old)`);
      itemsRemoved += removed;
    }
  }

  // 2. Remove incomplete collection caches (they'll be refetched properly)
  if (removeIncompleteCollections) {
    const removed = await removeIncompleteCollectionCaches();
    if (removed > 0) {
      optimizationsApplied.push(`Removed ${removed} incomplete collection caches`);
      itemsRemoved += removed;
    }
  }

  // 3. Remove old individual subject caches (no longer needed with consolidated system)
  const removedIndividual = await removeOldIndividualCaches();
  if (removedIndividual > 0) {
    optimizationsApplied.push(`Removed ${removedIndividual} old individual subject caches`);
    itemsRemoved += removedIndividual;
  }

  // 4. Enforce size limit by removing largest/oldest entries
  const afterCleanup = await analyzeCacheStorage();
  if (afterCleanup.totalSize > maxSizeMB * 1024 * 1024) {
    const removed = await enforceStorageLimit(maxSizeMB);
    if (removed > 0) {
      optimizationsApplied.push(`Removed ${removed} large entries to stay under ${maxSizeMB}MB`);
      itemsRemoved += removed;
    }
  }

  const finalAnalysis = await analyzeCacheStorage();
  const sizeAfter = finalAnalysis.totalSize;
  const savedSpace = sizeBefore - sizeAfter;

  const result: CacheOptimizationResult = {
    sizeBefore,
    sizeAfter,
    savedSpace,
    savedSpaceFormatted: formatBytes(savedSpace),
    itemsRemoved,
    optimizationsApplied
  };

  console.log(`✅ Cache optimization complete:`);
  console.log(`   Size: ${formatBytes(sizeBefore)} → ${formatBytes(sizeAfter)}`);
  console.log(`   Saved: ${formatBytes(savedSpace)} (${itemsRemoved} items removed)`);
  
  return result;
}

async function removeExpiredEntries(maxAgeDays: number): Promise<number> {
  const allKeys = await AsyncStorage.getAllKeys();
  const keyValuePairs = await AsyncStorage.multiGet(allKeys);
  
  const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
  const keysToRemove: string[] = [];
  
  for (const [key, value] of keyValuePairs) {
    if (value === null) continue;
    
    try {
      const parsed: CacheEntry = JSON.parse(value);
      if (parsed.timestamp && parsed.timestamp < cutoffTime) {
        keysToRemove.push(key);
      }
    } catch (error) {
      // If we can't parse it, it might be old format - remove if very old
      continue;
    }
  }
  
  if (keysToRemove.length > 0) {
    await AsyncStorage.multiRemove(keysToRemove);
    console.log(`🗑️ Removed ${keysToRemove.length} expired cache entries`);
  }
  
  return keysToRemove.length;
}

async function removeIncompleteCollectionCaches(): Promise<number> {
  const allKeys = await AsyncStorage.getAllKeys();
  const collectionKeys = allKeys.filter(key => key.startsWith('subjects_'));
  
  if (collectionKeys.length === 0) return 0;
  
  const keyValuePairs = await AsyncStorage.multiGet(collectionKeys);
  const keysToRemove: string[] = [];
  
  for (const [key, value] of keyValuePairs) {
    if (value === null) continue;
    
    try {
      const parsed = JSON.parse(value);
      const data = parsed.data?.data || parsed.data;
      
      // Remove if it has a next_url (incomplete) or seems corrupted
      if (data?.pages?.next_url || !data?.data || !Array.isArray(data.data)) {
        keysToRemove.push(key);
      }
    } catch (error) {
      // Remove corrupted entries
      keysToRemove.push(key);
    }
  }
  
  if (keysToRemove.length > 0) {
    await AsyncStorage.multiRemove(keysToRemove);
    console.log(`🧹 Removed ${keysToRemove.length} incomplete/corrupted collections`);
  }
  
  return keysToRemove.length;
}

async function removeOldIndividualCaches(): Promise<number> {
  const allKeys = await AsyncStorage.getAllKeys();
  const individualKeys = allKeys.filter(key => key.startsWith('wanikani_subjects_cache_'));
  
  if (individualKeys.length === 0) return 0;
  
  const keysToRemove: string[] = [];
  
  for (const key of individualKeys) {
    keysToRemove.push(key);
  }
  
  if (keysToRemove.length > 0) {
    await AsyncStorage.multiRemove(keysToRemove);
    console.log(`🗑️ Removed ${keysToRemove.length} old individual subject caches`);
  }
  
  return keysToRemove.length;
}

async function enforceStorageLimit(maxSizeMB: number): Promise<number> {
  const analysis = await analyzeCacheStorage();
  const maxBytes = maxSizeMB * 1024 * 1024;
  
  if (analysis.totalSize <= maxBytes) return 0;
  
  // Sort by size (largest first) and age (oldest first)
  const sortedItems = analysis.largestItems.sort((a, b) => {
    // Prioritize removing large collection caches over individual items
    const aIsCollection = a.key.startsWith('subjects_');
    const bIsCollection = b.key.startsWith('subjects_');
    
    if (aIsCollection && !bIsCollection) return -1;
    if (!aIsCollection && bIsCollection) return 1;
    
    return b.size - a.size;
  });
  
  const keysToRemove: string[] = [];
  let currentSize = analysis.totalSize;
  
  for (const item of sortedItems) {
    if (currentSize <= maxBytes) break;
    
    keysToRemove.push(item.key);
    currentSize -= item.size;
  }
  
  if (keysToRemove.length > 0) {
    await AsyncStorage.multiRemove(keysToRemove);
    console.log(`📏 Removed ${keysToRemove.length} items to enforce ${maxSizeMB}MB limit`);
  }
  
  return keysToRemove.length;
}

// Quick function to run optimization with sensible defaults
export async function quickOptimize(): Promise<CacheOptimizationResult> {
  return optimizeCache({
    maxSizeMB: 30,        // Reduce from ~100MB to 30MB
    maxAgeDays: 14,       // Remove cache older than 2 weeks
    removeIncompleteCollections: true
  });
} 